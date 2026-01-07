import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { triggerPusherEvent } from "@/lib/pusher";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: { id },
      select: { boardId: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await requireBoardAccess(task.boardId, "VIEWER");

    const watchers = await prisma.taskWatcher.findMany({
      where: { taskId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(watchers);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch watchers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id },
      select: { boardId: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await requireBoardAccess(task.boardId, "VIEWER");

    // Check if already watching
    const existing = await prisma.taskWatcher.findUnique({
      where: {
        taskId_userId: {
          taskId: id,
          userId: user.id,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Already watching this task" },
        { status: 400 }
      );
    }

    const watcher = await prisma.taskWatcher.create({
      data: {
        taskId: id,
        userId: user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await triggerPusherEvent(`board-${task.boardId}`, "task-watcher-added", {
      taskId: id,
      watcher,
    });

    return NextResponse.json(watcher);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to add watcher";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id },
      select: { boardId: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await requireBoardAccess(task.boardId, "VIEWER");

    await prisma.taskWatcher.delete({
      where: {
        taskId_userId: {
          taskId: id,
          userId: user.id,
        },
      },
    });

    await triggerPusherEvent(`board-${task.boardId}`, "task-watcher-removed", {
      taskId: id,
      userId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to remove watcher";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

