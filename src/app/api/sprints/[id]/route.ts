import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sprint = await prisma.sprint.findUnique({
      where: { id },
      include: {
        board: {
          include: {
            organization: true,
          },
        },
        tasks: {
          include: {
            assignee: {
              select: {
                id: true,
                userId: true,
                role: true,
              },
            },
            statusColumn: true,
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!sprint) {
      return NextResponse.json({ error: "Sprint not found" }, { status: 404 });
    }

    
    await requireBoardAccess(sprint.boardId, "VIEWER");

    return NextResponse.json(sprint);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch sprint";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const sprint = await prisma.sprint.findUnique({
      where: { id },
      include: {
        board: true,
      },
    });

    if (!sprint) {
      return NextResponse.json({ error: "Sprint not found" }, { status: 404 });
    }

    
    await requireBoardAccess(sprint.boardId, "MEMBER");

    
    if (body.isActive === true && !sprint.isActive) {
      await prisma.sprint.updateMany({
        where: {
          boardId: sprint.boardId,
          isActive: true,
          id: { not: id },
        },
        data: {
          isActive: false,
        },
      });
    }

    const updatedSprint = await prisma.sprint.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        goal: body.goal,
        capacityHours: body.capacityHours !== undefined ? (body.capacityHours ? parseFloat(body.capacityHours) : null) : undefined,
        isActive: body.isActive,
      },
      include: {
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    
    try {
      await pusherServer.trigger(`board-${sprint.boardId}`, "sprint-updated", {
        sprint: updatedSprint,
      });
    } catch (pusherError) {
      console.error("Pusher error:", pusherError);
    }

    return NextResponse.json(updatedSprint);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update sprint";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const sprint = await prisma.sprint.findUnique({
      where: { id },
      include: {
        board: true,
      },
    });

    if (!sprint) {
      return NextResponse.json({ error: "Sprint not found" }, { status: 404 });
    }

    
    await requireBoardAccess(sprint.boardId, "MEMBER");

    await prisma.sprint.delete({
      where: { id },
    });

    
    try {
      await pusherServer.trigger(`board-${sprint.boardId}`, "sprint-deleted", {
        sprintId: id,
      });
    } catch (pusherError) {
      console.error("Pusher error:", pusherError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete sprint";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
