import { prisma } from "./prisma";
import { triggerPusherEvent } from "./pusher";

export interface NotificationData {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
}

export async function createNotification(data: NotificationData) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        link: data.link || null,
        metadata: data.metadata ? (data.metadata as any) : null,
      },
    });

    // Trigger real-time update
    await triggerPusherEvent(`user-${data.userId}`, "notification-created", notification);

    return notification;
  } catch (error) {
    console.error("Failed to create notification:", error);
    return null;
  }
}

export async function notifyTaskWatchers(
  taskId: string,
  type: string,
  title: string,
  message: string,
  link?: string
) {
  try {
    const watchers = await prisma.taskWatcher.findMany({
      where: { taskId },
      select: { userId: true },
    });

    for (const watcher of watchers) {
      await createNotification({
        userId: watcher.userId,
        type,
        title,
        message,
        link,
      });
    }
  } catch (error) {
    console.error("Failed to notify task watchers:", error);
  }
}

