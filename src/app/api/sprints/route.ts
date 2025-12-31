import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, boardId, startDate, endDate, goal } = body;

    if (!name || !boardId || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Name, boardId, startDate, and endDate are required" },
        { status: 400 }
      );
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    await requireMember(board.organizationId);

    // If this is set as active, deactivate other active sprints on this board
    const isActive = body.isActive === true;
    if (isActive) {
      await prisma.sprint.updateMany({
        where: {
          boardId,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });
    }

    const sprint = await prisma.sprint.create({
      data: {
        name,
        description: description || null,
        boardId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        goal: goal || null,
        isActive,
      },
      include: {
        board: true,
      },
    });

    // Emit Pusher event for real-time updates
    try {
      await pusherServer.trigger(`board-${boardId}`, "sprint-created", {
        sprint,
      });
    } catch (pusherError) {
      console.error("Pusher error:", pusherError);
      // Don't fail the request if Pusher fails
    }

    return NextResponse.json(sprint, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create sprint";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get("boardId");
    const isActive = searchParams.get("isActive");

    if (!boardId) {
      return NextResponse.json(
        { error: "boardId is required" },
        { status: 400 }
      );
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    await requireMember(board.organizationId);

    const sprints = await prisma.sprint.findMany({
      where: {
        boardId,
        ...(isActive !== null ? { isActive: isActive === "true" } : {}),
      },
      include: {
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            estimatedHours: true,
            actualHours: true,
          },
        },
      },
      orderBy: {
        startDate: "desc",
      },
    });

    return NextResponse.json(sprints);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sprints";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

