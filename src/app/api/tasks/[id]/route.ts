import { NextRequest, NextResponse } from "next/server";
import { requireMember, requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { triggerPusherEvent } from "@/lib/pusher";
import { TaskStatus } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        statusColumn: true,
        board: {
          include: {
            organization: true,
          },
        },
        comments: {
          orderBy: { createdAt: "asc" },
        },
        attachments: true,
        subtasks: {
          include: {
            assignee: {
              select: {
                id: true,
                userId: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Check board access - need at least VIEWER role to see tasks
    await requireBoardAccess(task.boardId, "VIEWER");

    return NextResponse.json(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch task";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        board: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Check board access - need MEMBER role to update tasks (including status changes and assignments)
    await requireBoardAccess(task.boardId, "MEMBER");

    // Handle status change - update status column
    let statusColumnId = task.statusColumnId;
    if (body.status && body.status !== task.status) {
      const statusColumn = await prisma.taskStatusColumn.findFirst({
        where: {
          boardId: task.boardId,
          status: body.status as TaskStatus,
        },
      });
      statusColumnId = statusColumn?.id || null;
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        status: body.status,
        priority: body.priority,
        assigneeId: body.assigneeId,
        sprintId: body.sprintId !== undefined ? body.sprintId : undefined,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        estimatedHours: body.estimatedHours,
        actualHours: body.actualHours,
        order: body.order,
        statusColumnId,
        version: {
          increment: 1,
        },
      },
      include: {
        assignee: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        statusColumn: true,
      },
    });

    // Emit Pusher event for real-time updates
    try {
      await triggerPusherEvent(`board-${task.boardId}`, "task-updated", {
        taskId: updatedTask.id,
        boardId: updatedTask.boardId,
        status: updatedTask.status,
      });
    } catch (pusherError) {
      // Error already logged in triggerPusherEvent
      // Don't fail the request if Pusher fails
    }

    return NextResponse.json(updatedTask);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update task";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        board: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Check board access - need MEMBER role to delete tasks
    await requireBoardAccess(task.boardId, "MEMBER");

    await prisma.task.delete({
      where: { id },
    });

    // Emit Pusher event for real-time updates
    try {
      await triggerPusherEvent(`board-${task.boardId}`, "task-deleted", {
        taskId: id,
      });
    } catch (pusherError) {
      // Error already logged in triggerPusherEvent
      // Don't fail the request if Pusher fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete task";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

