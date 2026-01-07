import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { triggerPusherEvent } from "@/lib/pusher";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
        const {
          targetBoardId,
          includeSubtasks = true,
          includeComments = false,
          includeAttachments: _includeAttachments = false,
          includeChecklist = true,
          includeTags = true,
        } = body;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        subtasks: true,
        comments: true,
        attachments: true,
        tags: {
          include: {
            tag: true,
          },
        },
        checklistItems: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const sourceBoardId = task.boardId;
    await requireBoardAccess(sourceBoardId, "MEMBER");

    const targetBoard = targetBoardId
      ? await prisma.board.findUnique({
          where: { id: targetBoardId },
        })
      : null;

    if (targetBoardId && !targetBoard) {
      return NextResponse.json(
        { error: "Target board not found" },
        { status: 404 }
      );
    }

    if (targetBoardId) {
      await requireBoardAccess(targetBoardId, "MEMBER");
    }

    const finalBoardId = targetBoardId || sourceBoardId;

    // Get status column for the target board
    const statusColumn = await prisma.taskStatusColumn.findFirst({
      where: {
        boardId: finalBoardId,
        status: task.status,
      },
    });

    // Get max order for the target board
    const maxOrderTask = await prisma.task.findFirst({
      where: { boardId: finalBoardId },
      orderBy: { order: "desc" },
    });

    // Create cloned task
    const clonedTask = await prisma.task.create({
      data: {
        title: `${task.title} (Copy)`,
        description: task.description,
        boardId: finalBoardId,
        status: task.status,
        priority: task.priority,
        assigneeId: null, // Don't clone assignee
        statusColumnId: statusColumn?.id || null,
        dueDate: task.dueDate,
        estimatedHours: task.estimatedHours,
        order: maxOrderTask ? maxOrderTask.order + 1 : 0,
      },
    });

    // Clone subtasks if requested
    if (includeSubtasks && task.subtasks.length > 0) {
      const subtaskMap = new Map<string, string>();

      for (const subtask of task.subtasks) {
        const subtaskStatusColumn = await prisma.taskStatusColumn.findFirst({
          where: {
            boardId: finalBoardId,
            status: subtask.status,
          },
        });

        const clonedSubtask = await prisma.task.create({
          data: {
            title: subtask.title,
            description: subtask.description,
            boardId: finalBoardId,
            status: subtask.status,
            priority: subtask.priority,
            parentTaskId: clonedTask.id,
            statusColumnId: subtaskStatusColumn?.id || null,
            dueDate: subtask.dueDate,
            estimatedHours: subtask.estimatedHours,
            order: subtask.order,
          },
        });

        subtaskMap.set(subtask.id, clonedSubtask.id);
      }
    }

    // Clone checklist items if requested
    if (includeChecklist && task.checklistItems.length > 0) {
      await prisma.checklistItem.createMany({
        data: task.checklistItems.map((item) => ({
          taskId: clonedTask.id,
          text: item.text,
          isCompleted: false, // Reset completion status
          order: item.order,
        })),
      });
    }

    // Clone tags if requested
    if (includeTags && task.tags.length > 0) {
      for (const taskTag of task.tags) {
        // Check if tag exists in target board, create if not
        let targetTag = await prisma.tag.findFirst({
          where: {
            name: taskTag.tag.name,
            organizationId: null,
            boardId: finalBoardId,
          },
        });

        if (!targetTag) {
          targetTag = await prisma.tag.create({
            data: {
              name: taskTag.tag.name,
              color: taskTag.tag.color,
              boardId: finalBoardId,
            },
          });
        }

        await prisma.taskTag.create({
          data: {
            taskId: clonedTask.id,
            tagId: targetTag.id,
          },
        });
      }
    }

    // Clone comments if requested
    if (includeComments && task.comments.length > 0) {
      await prisma.comment.createMany({
        data: task.comments.map((comment) => ({
          taskId: clonedTask.id,
          userId: comment.userId,
          content: comment.content,
        })),
      });
    }

    // Note: Attachments are not cloned as they reference file storage paths
    // This would require file copying logic

    await triggerPusherEvent(`board-${finalBoardId}`, "task-cloned", {
      originalTaskId: id,
      clonedTaskId: clonedTask.id,
    });

    return NextResponse.json({
      task: clonedTask,
      message: "Task cloned successfully",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to clone task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

