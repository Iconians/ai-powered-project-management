import { prisma } from "./prisma";
import { AutomationTrigger, AutomationAction } from "@prisma/client";
import { createNotification, notifyTaskWatchers } from "./notifications";
import { logActivity } from "./activity-logger";

export interface AutomationContext {
  taskId?: string;
  boardId?: string;
  organizationId?: string;
  userId?: string;
  oldStatus?: string;
  newStatus?: string;
  assigneeId?: string;
  sprintId?: string;
}

export async function executeAutomations(
  trigger: AutomationTrigger,
  context: AutomationContext
) {
  try {
    if (!context.organizationId) {
      return;
    }

    // Get all active automation rules for this organization
    const rules = await prisma.automationRule.findMany({
      where: {
        organizationId: context.organizationId,
        trigger,
        isActive: true,
      },
    });

    for (const rule of rules) {
      // Check conditions
      if (rule.conditions) {
        const conditions = rule.conditions as any;
        let shouldExecute = true;

        // Evaluate conditions based on context
        if (conditions.status && context.newStatus !== conditions.status) {
          shouldExecute = false;
        }
        if (conditions.priority && context.taskId) {
          const task = await prisma.task.findUnique({
            where: { id: context.taskId },
            select: { priority: true },
          });
          if (task?.priority !== conditions.priority) {
            shouldExecute = false;
          }
        }
        if (conditions.boardId && context.boardId !== conditions.boardId) {
          shouldExecute = false;
        }

        if (!shouldExecute) {
          continue;
        }
      }

      // Execute action
      await executeAction(rule.action, rule.actionParams as any, context);
    }
  } catch (error) {
    console.error("Failed to execute automations:", error);
  }
}

async function executeAction(
  action: AutomationAction,
  actionParams: any,
  context: AutomationContext
) {
  if (!context.taskId) {
    return;
  }

  switch (action) {
    case "ASSIGN_TASK":
      if (actionParams.assigneeId) {
        await prisma.task.update({
          where: { id: context.taskId },
          data: { assigneeId: actionParams.assigneeId },
        });
        await logActivity("TASK_ASSIGNED", actionParams.assigneeId, {
          taskId: context.taskId,
          boardId: context.boardId,
          organizationId: context.organizationId,
        });
      }
      break;

    case "CHANGE_STATUS":
      if (actionParams.status && context.boardId) {
        const statusColumn = await prisma.taskStatusColumn.findFirst({
          where: {
            boardId: context.boardId,
            status: actionParams.status,
          },
        });

        await prisma.task.update({
          where: { id: context.taskId },
          data: {
            status: actionParams.status,
            statusColumnId: statusColumn?.id || null,
          },
        });

        await logActivity("TASK_STATUS_CHANGED", context.userId || "", {
          taskId: context.taskId,
          boardId: context.boardId,
          organizationId: context.organizationId,
          metadata: {
            oldStatus: context.oldStatus,
            newStatus: actionParams.status,
          },
        });
      }
      break;

    case "SEND_NOTIFICATION":
      if (actionParams.userId) {
        await createNotification({
          userId: actionParams.userId,
          type: "AUTOMATION",
          title: actionParams.title || "Automation Notification",
          message: actionParams.message || "An automation rule was triggered",
          link: actionParams.link,
        });
      } else if (context.taskId) {
        // Notify all watchers
        await notifyTaskWatchers(
          context.taskId,
          "AUTOMATION",
          actionParams.title || "Task Updated",
          actionParams.message || "An automation rule was triggered"
        );
      }
      break;

    case "CREATE_SUBTASK":
      if (context.taskId && actionParams.title && context.boardId) {
        const parentTask = await prisma.task.findUnique({
          where: { id: context.taskId },
          select: { status: true },
        });

        const statusColumn = await prisma.taskStatusColumn.findFirst({
          where: {
            boardId: context.boardId,
            status: parentTask?.status || "TODO",
          },
        });

        await prisma.task.create({
          data: {
            title: actionParams.title,
            description: actionParams.description || null,
            boardId: context.boardId,
            parentTaskId: context.taskId,
            status: parentTask?.status || "TODO",
            priority: actionParams.priority || "MEDIUM",
            statusColumnId: statusColumn?.id || null,
          },
        });
      }
      break;

    case "ADD_COMMENT":
      if (context.taskId && actionParams.content && context.userId) {
        await prisma.comment.create({
          data: {
            taskId: context.taskId,
            userId: context.userId,
            content: actionParams.content,
          },
        });
      }
      break;
  }
}

