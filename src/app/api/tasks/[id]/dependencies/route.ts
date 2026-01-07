import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { triggerPusherEvent } from "@/lib/pusher";
import { hasCircularDependency } from "@/lib/task-dependencies";

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

    const dependencies = await prisma.taskDependency.findMany({
      where: { taskId: id },
      include: {
        dependsOn: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
          },
        },
      },
    });

    const blockedBy = await prisma.taskDependency.findMany({
      where: { dependsOnId: id },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
          },
        },
      },
    });

    return NextResponse.json({
      dependencies,
      blockedBy,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch dependencies";
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
    const { dependsOnId, type = "BLOCKS" } = body;

    if (!dependsOnId) {
      return NextResponse.json(
        { error: "dependsOnId is required" },
        { status: 400 }
      );
    }

    const validTypes = ["BLOCKS", "RELATED", "DUPLICATE"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `type must be one of: ${validTypes.join(", ")}` },
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

    // Check if dependency already exists
    const existing = await prisma.taskDependency.findUnique({
      where: {
        taskId_dependsOnId: {
          taskId: id,
          dependsOnId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Dependency already exists" },
        { status: 400 }
      );
    }

    // Check for circular dependencies
    const isCircular = await hasCircularDependency(id, dependsOnId);
    if (isCircular) {
      return NextResponse.json(
        { error: "This dependency would create a circular reference" },
        { status: 400 }
      );
    }

    const dependency = await prisma.taskDependency.create({
      data: {
        taskId: id,
        dependsOnId,
        type,
      },
      include: {
        dependsOn: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
          },
        },
      },
    });

    await triggerPusherEvent(`board-${task.boardId}`, "task-dependency-created", {
      taskId: id,
      dependency,
    });

    return NextResponse.json(dependency);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create dependency";
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
    const dependsOnId = searchParams.get("dependsOnId");

    if (!dependsOnId) {
      return NextResponse.json(
        { error: "dependsOnId is required" },
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

    await prisma.taskDependency.delete({
      where: {
        taskId_dependsOnId: {
          taskId: id,
          dependsOnId,
        },
      },
    });

    await triggerPusherEvent(`board-${task.boardId}`, "task-dependency-deleted", {
      taskId: id,
      dependsOnId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete dependency";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

