import { prisma } from "./prisma";

export interface CloneOptions {
  includeSubtasks?: boolean;
  includeComments?: boolean;
  includeAttachments?: boolean;
  includeChecklist?: boolean;
  includeTags?: boolean;
  targetBoardId?: string;
}

export async function cloneTask(taskId: string, options: CloneOptions = {}) {
  const {
    includeSubtasks = true,
    includeComments = false,
    includeAttachments: _includeAttachments = false,
    includeChecklist = true,
    includeTags = true,
    targetBoardId,
  } = options;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
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
    throw new Error("Task not found");
  }

  const finalBoardId = targetBoardId || task.boardId;

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
      assigneeId: null,
      statusColumnId: statusColumn?.id || null,
      dueDate: task.dueDate,
      estimatedHours: task.estimatedHours,
      order: maxOrderTask ? maxOrderTask.order + 1 : 0,
    },
  });

  // Clone subtasks if requested
  if (includeSubtasks && task.subtasks.length > 0) {
    for (const subtask of task.subtasks) {
      const subtaskStatusColumn = await prisma.taskStatusColumn.findFirst({
        where: {
          boardId: finalBoardId,
          status: subtask.status,
        },
      });

      await prisma.task.create({
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
    }
  }

  // Clone checklist items if requested
  if (includeChecklist && task.checklistItems.length > 0) {
    await prisma.checklistItem.createMany({
      data: task.checklistItems.map((item) => ({
        taskId: clonedTask.id,
        text: item.text,
        isCompleted: false,
        order: item.order,
      })),
    });
  }

  // Clone tags if requested
  if (includeTags && task.tags.length > 0) {
    for (const taskTag of task.tags) {
      let targetTag = await prisma.tag.findFirst({
        where: {
          name: taskTag.tag.name,
          organizationId: taskTag.tag.organizationId,
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

  return clonedTask;
}
