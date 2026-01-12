import { prisma } from "@/lib/prisma";
import { IntegrationProvider } from "@prisma/client";
import { sendSlackNotification } from "@/lib/integrations/slack";
import { createJiraIssue } from "@/lib/integrations/jira";
import { createLinearIssue } from "@/lib/integrations/linear";
import { sendZapierWebhook } from "@/lib/integrations/zapier";
import type { Task } from "@prisma/client";

interface IntegrationEvent {
  type: "task_created" | "task_updated" | "task_status_changed" | "task_assigned" | "task_due_date_changed";
  task: Task & {
    board?: { id: string; name: string; organizationId: string };
    assignee?: { user?: { name: string | null; email: string } };
  };
  organizationId: string;
  changes?: {
    status?: { from: string; to: string };
    assignee?: { from: string | null; to: string | null };
    dueDate?: { from: Date | null; to: Date | null };
  };
}

/**
 * Get active integrations for an organization
 */
export async function getActiveIntegrations(organizationId: string) {
  try {
    const integrations = await prisma.integration.findMany({
      where: {
        organizationId,
        isActive: true,
      },
    });
    return integrations;
  } catch (error) {
    console.error("Error fetching integrations:", error);
    return [];
  }
}

/**
 * Trigger integrations for a task event
 * This runs asynchronously and doesn't block the main request
 */
export async function triggerIntegrations(event: IntegrationEvent) {
  try {
    const integrations = await getActiveIntegrations(event.organizationId);

    // Run integrations in parallel, but don't await (fire and forget)
    Promise.all(
      integrations.map(async (integration) => {
        try {
          await triggerIntegration(integration, event);
        } catch (error) {
          // Log error but don't fail other integrations
          console.error(
            `Error triggering ${integration.provider} integration:`,
            error
          );
        }
      })
    ).catch((error) => {
      console.error("Error triggering integrations:", error);
    });
  } catch (error) {
    console.error("Error fetching integrations:", error);
  }
}

/**
 * Trigger a specific integration
 */
async function triggerIntegration(
  integration: {
    id: string;
    provider: IntegrationProvider;
    config: any;
  },
  event: IntegrationEvent
) {
  const { provider, config } = integration;

  switch (provider) {
    case IntegrationProvider.SLACK:
      await triggerSlackIntegration(config, event);
      break;

    case IntegrationProvider.JIRA:
      await triggerJiraIntegration(config, event);
      break;

    case IntegrationProvider.LINEAR:
      await triggerLinearIntegration(config, event);
      break;

    case IntegrationProvider.ZAPIER:
      await triggerZapierIntegration(config, event);
      break;

    default:
      console.warn(`Unsupported integration provider: ${provider}`);
  }
}

/**
 * Trigger Slack notification
 */
async function triggerSlackIntegration(config: any, event: IntegrationEvent) {
  // Only send notifications for certain events
  const shouldNotify =
    event.type === "task_created" ||
    event.type === "task_status_changed" ||
    event.type === "task_assigned";

  if (!shouldNotify) return;

  const task = event.task;
  const taskUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/boards/${task.boardId}/tasks/${task.id}`;
  const assigneeName = task.assignee?.user?.name || task.assignee?.user?.email || "Unassigned";

  let text = "";
  let title = "";
  let color: "good" | "warning" | "danger" = "good";

  switch (event.type) {
    case "task_created":
      title = `New Task: ${task.title}`;
      text = `A new task has been created${task.board ? ` in ${task.board.name}` : ""}`;
      if (task.assignee) {
        text += `\nAssigned to: ${assigneeName}`;
      }
      if (task.priority === "URGENT" || task.priority === "HIGH") {
        color = task.priority === "URGENT" ? "danger" : "warning";
      }
      break;

    case "task_status_changed":
      title = `Task Updated: ${task.title}`;
      text = `Status changed from ${event.changes?.status?.from} to ${event.changes?.status?.to}`;
      if (task.assignee) {
        text += `\nAssigned to: ${assigneeName}`;
      }
      break;

    case "task_assigned":
      title = `Task Assigned: ${task.title}`;
      text = `Task has been assigned to ${assigneeName}`;
      break;
  }

  await sendSlackNotification(config, {
    text,
    title,
    link: taskUrl,
    color,
  });
}

/**
 * Trigger Jira issue creation (only on task creation)
 */
async function triggerJiraIntegration(config: any, event: IntegrationEvent) {
  // Only create Jira issues when tasks are created
  if (event.type !== "task_created") return;

  const task = event.task;

  // Map priority
  const priorityMap: Record<string, string> = {
    LOW: "Lowest",
    MEDIUM: "Medium",
    HIGH: "High",
    URGENT: "Highest",
  };

  const result = await createJiraIssue(config, {
    summary: task.title,
    description: task.description || "",
    issueType: "Task",
    priority: priorityMap[task.priority] || "Medium",
  });

  if (result) {
    // Optionally store Jira issue key in task metadata
    console.log(`Created Jira issue ${result.key} for task ${task.id}`);
  }
}

/**
 * Trigger Linear issue creation (only on task creation)
 */
async function triggerLinearIntegration(config: any, event: IntegrationEvent) {
  // Only create Linear issues when tasks are created
  if (event.type !== "task_created") return;

  const task = event.task;

  // Map priority (Linear uses 0-4, where 0 = No priority, 4 = Urgent)
  const priorityMap: Record<string, number> = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    URGENT: 4,
  };

  const result = await createLinearIssue(config, {
    title: task.title,
    description: task.description || "",
    priority: priorityMap[task.priority] || 2,
  });

  if (result) {
    console.log(`Created Linear issue ${result.id} for task ${task.id}`);
  }
}

/**
 * Trigger Zapier webhook
 */
async function triggerZapierIntegration(config: any, event: IntegrationEvent) {
  const task = event.task;

  const payload = {
    event: event.type,
    data: {
      taskId: task.id,
      taskTitle: task.title,
      taskDescription: task.description,
      taskStatus: task.status,
      taskPriority: task.priority,
      boardId: task.boardId,
      organizationId: event.organizationId,
      assigneeEmail: task.assignee?.user?.email || null,
      assigneeName: task.assignee?.user?.name || null,
      dueDate: task.dueDate?.toISOString() || null,
      changes: event.changes,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    },
  };

  await sendZapierWebhook(config, payload);
}
