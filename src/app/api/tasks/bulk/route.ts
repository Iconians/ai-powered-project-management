import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { triggerPusherEvent } from "@/lib/pusher";
import { TaskStatus, TaskPriority } from "@prisma/client";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskIds, updates } = body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json(
        { error: "taskIds array is required" },
        { status: 400 }
      );
    }

    if (!updates || typeof updates !== "object") {
      return NextResponse.json(
        { error: "updates object is required" },
        { status: 400 }
      );
    }

    // Get first task to check board access
    const firstTask = await prisma.task.findUnique({
      where: { id: taskIds[0] },
      select: { boardId: true },
    });

    if (!firstTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await requireBoardAccess(firstTask.boardId, "MEMBER");

    // Verify all tasks are from the same board
    const tasks = await prisma.task.findMany({
      where: { id: { in: taskIds } },
      select: { id: true, boardId: true },
    });

    const boardIds = new Set(tasks.map((t) => t.boardId));
    if (boardIds.size > 1) {
      return NextResponse.json(
        { error: "All tasks must be from the same board" },
        { status: 400 }
      );
    }

    const updateData: any = {};

    if (updates.status) {
      const validStatuses = Object.values(TaskStatus);
      if (validStatuses.includes(updates.status)) {
        // Get status column for the new status
        const statusColumn = await prisma.taskStatusColumn.findFirst({
          where: {
            boardId: firstTask.boardId,
            status: updates.status,
          },
        });
        updateData.status = updates.status;
        updateData.statusColumnId = statusColumn?.id || null;
      }
    }

    if (updates.priority) {
      const validPriorities = Object.values(TaskPriority);
      if (validPriorities.includes(updates.priority)) {
        updateData.priority = updates.priority;
      }
    }

    if (updates.assigneeId !== undefined) {
      updateData.assigneeId = updates.assigneeId || null;
    }

    if (updates.dueDate !== undefined) {
      updateData.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
    }

    if (updates.sprintId !== undefined) {
      updateData.sprintId = updates.sprintId || null;
    }

    // Update all tasks
    const result = await prisma.task.updateMany({
      where: { id: { in: taskIds } },
      data: updateData,
    });

    // Trigger real-time updates
    await triggerPusherEvent(`board-${firstTask.boardId}`, "tasks-bulk-updated", {
      taskIds,
      updates: updateData,
    });

    return NextResponse.json({
      success: true,
      updated: result.count,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to bulk update tasks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskIds } = body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json(
        { error: "taskIds array is required" },
        { status: 400 }
      );
    }

    // Get first task to check board access
    const firstTask = await prisma.task.findUnique({
      where: { id: taskIds[0] },
      select: { boardId: true },
    });

    if (!firstTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await requireBoardAccess(firstTask.boardId, "MEMBER");

    // Verify all tasks are from the same board
    const tasks = await prisma.task.findMany({
      where: { id: { in: taskIds } },
      select: { id: true, boardId: true },
    });

    const boardIds = new Set(tasks.map((t) => t.boardId));
    if (boardIds.size > 1) {
      return NextResponse.json(
        { error: "All tasks must be from the same board" },
        { status: 400 }
      );
    }

    // Delete all tasks
    const result = await prisma.task.deleteMany({
      where: { id: { in: taskIds } },
    });

    // Trigger real-time updates
    await triggerPusherEvent(`board-${firstTask.boardId}`, "tasks-bulk-deleted", {
      taskIds,
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to bulk delete tasks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

