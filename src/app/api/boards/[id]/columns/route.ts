import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@prisma/client";
import { triggerPusherEvent } from "@/lib/pusher";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: boardId } = await params;
    const body = await request.json();
    const { name, status, order } = body;

    // Check board access - need MEMBER role to create columns
    await requireBoardAccess(boardId, "MEMBER");

    if (!name || !status) {
      return NextResponse.json(
        { error: "Name and status are required" },
        { status: 400 }
      );
    }

    // Validate status enum
    const validStatuses = Object.values(TaskStatus);
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Check if status already exists for this board
    const existingColumn = await prisma.taskStatusColumn.findUnique({
      where: {
        boardId_status: {
          boardId,
          status: status as TaskStatus,
        },
      },
    });

    if (existingColumn) {
      return NextResponse.json(
        {
          error: `A column with status "${status}" already exists for this board`,
        },
        { status: 409 }
      );
    }

    // Get max order if order not provided
    let columnOrder = order;
    if (columnOrder === undefined) {
      const maxOrderColumn = await prisma.taskStatusColumn.findFirst({
        where: { boardId },
        orderBy: { order: "desc" },
      });
      columnOrder = maxOrderColumn ? maxOrderColumn.order + 1 : 0;
    }

    const column = await prisma.taskStatusColumn.create({
      data: {
        boardId,
        name: name.trim(),
        status: status as TaskStatus,
        order: columnOrder,
      },
    });

    await triggerPusherEvent(`board-${boardId}`, "column-created", {
      id: column.id,
      boardId: column.boardId,
      name: column.name,
      status: column.status,
      order: column.order,
    });

    return NextResponse.json(column, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create column";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: boardId } = await params;

    // Check board access - need VIEWER role to see columns
    await requireBoardAccess(boardId, "VIEWER");

    const columns = await prisma.taskStatusColumn.findMany({
      where: { boardId },
      orderBy: { order: "asc" },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    });

    return NextResponse.json(columns);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch columns";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
