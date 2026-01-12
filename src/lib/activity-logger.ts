import { prisma } from "./prisma";
import { triggerPusherEvent } from "./pusher";

export type ActivityType =
  | "TASK_CREATED"
  | "TASK_UPDATED"
  | "TASK_DELETED"
  | "TASK_STATUS_CHANGED"
  | "TASK_ASSIGNED"
  | "COMMENT_ADDED"
  | "COMMENT_UPDATED"
  | "BOARD_CREATED"
  | "BOARD_UPDATED"
  | "BOARD_DELETED"
  | "MEMBER_ADDED"
  | "MEMBER_REMOVED"
  | "SPRINT_CREATED"
  | "SPRINT_STARTED"
  | "SPRINT_ENDED";

export interface ActivityMetadata {
  [key: string]: any;
}

export async function logActivity(
  type: ActivityType,
  userId: string,
  options: {
    organizationId?: string;
    boardId?: string;
    taskId?: string;
    metadata?: ActivityMetadata;
  }
) {
  try {
    const activity = await prisma.activity.create({
      data: {
        type,
        userId,
        organizationId: options.organizationId || null,
        boardId: options.boardId || null,
        taskId: options.taskId || null,
        metadata: options.metadata ? (options.metadata as any) : null,
      },
    });

    // Trigger real-time update
    if (options.boardId) {
      await triggerPusherEvent(
        `board-${options.boardId}`,
        "activity-created",
        activity
      );
    }

    return activity;
  } catch (error) {
    console.error("Failed to log activity:", error);
    // Don't throw - activity logging should not break the main flow
    return null;
  }
}
