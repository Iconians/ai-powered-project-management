import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { triggerPusherEvent } from "@/lib/pusher";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; columnId: string }> }
) {
  try {
    const { id: boardId, columnId } = await params;
    const body = await request.json();
    const { name, order } = body;

    // Check board access - need MEMBER role to update columns
    await requireBoardAccess(boardId, "MEMBER");

    const column = await prisma.taskStatusColumn.findUnique({
      where: { id: columnId },
    });

    if (!column) {
      return NextResponse.json({ error: "Column not found" }, { status: 404 });
    }

    if (column.boardId !== boardId) {
      return NextResponse.json(
        { error: "Column does not belong to this board" },
        { status: 403 }
      );
    }

    const updateData: { name?: string; order?: number } = {};
    if (name !== undefined) {
      updateData.name = name.trim();
    }
    if (order !== undefined) {
      updateData.order = order;
    }

    const updatedColumn = await prisma.taskStatusColumn.update({
      where: { id: columnId },
      data: updateData,
    });

    await triggerPusherEvent(`board-${boardId}`, "column-updated", {
      id: updatedColumn.id,
      boardId: updatedColumn.boardId,
      name: updatedColumn.name,
      status: updatedColumn.status,
      order: updatedColumn.order,
    });

    return NextResponse.json(updatedColumn);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update column";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; columnId: string }> }
) {
  try {
    const { id: boardId, columnId } = await params;

    // Check board access - need MEMBER role to delete columns
    await requireBoardAccess(boardId, "MEMBER");

    const column = await prisma.taskStatusColumn.findUnique({
      where: { id: columnId },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    });

    if (!column) {
      return NextResponse.json({ error: "Column not found" }, { status: 404 });
    }

    if (column.boardId !== boardId) {
      return NextResponse.json(
        { error: "Column does not belong to this board" },
        { status: 403 }
      );
    }

    // Prevent deletion if column has tasks
    if (column._count.tasks > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete column with ${column._count.tasks} task(s). Please move or delete all tasks first.`,
        },
        { status: 400 }
      );
    }

    // Check if this is the last column
    const columnCount = await prisma.taskStatusColumn.count({
      where: { boardId },
    });

    if (columnCount <= 1) {
      return NextResponse.json(
        {
          error:
            "Cannot delete the last column. A board must have at least one column.",
        },
        { status: 400 }
      );
    }

    await prisma.taskStatusColumn.delete({
      where: { id: columnId },
    });

    await triggerPusherEvent(`board-${boardId}`, "column-deleted", {
      id: columnId,
      boardId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete column";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
