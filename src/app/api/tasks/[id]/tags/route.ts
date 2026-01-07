import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess } from "@/lib/auth";
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

    const taskTags = await prisma.taskTag.findMany({
      where: { taskId: id },
      include: {
        tag: true,
      },
    });

    return NextResponse.json(taskTags);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch task tags";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { tagId } = body;

    if (!tagId) {
      return NextResponse.json(
        { error: "tagId is required" },
        { status: 400 }
      );
    }

    const task = await prisma.task.findUnique({
      where: { id },
      select: { boardId: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await requireBoardAccess(task.boardId, "MEMBER");

    // Check if association already exists
    const existing = await prisma.taskTag.findUnique({
      where: {
        taskId_tagId: {
          taskId: id,
          tagId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Tag already associated with this task" },
        { status: 400 }
      );
    }

    const taskTag = await prisma.taskTag.create({
      data: {
        taskId: id,
        tagId,
      },
      include: {
        tag: true,
      },
    });

    await triggerPusherEvent(`board-${task.boardId}`, "task-tag-added", {
      taskId: id,
      taskTag,
    });

    return NextResponse.json(taskTag);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to add tag to task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const tagId = searchParams.get("tagId");

    if (!tagId) {
      return NextResponse.json(
        { error: "tagId is required" },
        { status: 400 }
      );
    }

    const task = await prisma.task.findUnique({
      where: { id },
      select: { boardId: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await requireBoardAccess(task.boardId, "MEMBER");

    await prisma.taskTag.delete({
      where: {
        taskId_tagId: {
          taskId: id,
          tagId,
        },
      },
    });

    await triggerPusherEvent(`board-${task.boardId}`, "task-tag-removed", {
      taskId: id,
      tagId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to remove tag from task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

