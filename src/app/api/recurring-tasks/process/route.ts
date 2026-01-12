import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TaskStatus, RecurrencePattern } from "@prisma/client";
import { triggerPusherEvent } from "@/lib/pusher";

// This endpoint should be called periodically (e.g., via cron job)
// It processes recurring tasks that are due to be created
export async function POST(request: NextRequest) {
  try {
    // Optional: Add API key authentication for security
    const authHeader = request.headers.get("authorization");
    const apiKey = process.env.CRON_SECRET;
    
    if (apiKey && authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    
    // Find all active recurring tasks that are due
    const dueRecurringTasks = await prisma.recurringTask.findMany({
      where: {
        isActive: true,
        nextOccurrence: {
          lte: now,
        },
        OR: [
          { endDate: null },
          { endDate: { gte: now } },
        ],
      },
      include: {
        board: {
          select: {
            id: true,
            organizationId: true,
          },
        },
      },
    });

    const createdTasks = [];

    for (const recurringTask of dueRecurringTasks) {
      // Check if we've already created a task for this occurrence
      // (to prevent duplicates if the cron runs multiple times)
      const existingTask = await prisma.task.findFirst({
        where: {
          recurringTaskId: recurringTask.id,
          createdAt: {
            gte: new Date(recurringTask.nextOccurrence.getTime() - 60000), // Within last minute
          },
        },
      });

      if (existingTask) {
        // Already created, just update nextOccurrence
        const nextOccurrence = calculateNextOccurrence(recurringTask);
        await prisma.recurringTask.update({
          where: { id: recurringTask.id },
          data: { nextOccurrence },
        });
        continue;
      }

      // Get the status column for TODO status
      const statusColumn = await prisma.taskStatusColumn.findFirst({
        where: {
          boardId: recurringTask.boardId,
          status: TaskStatus.TODO,
        },
      });

      // Get max order for tasks in TODO status
      const maxOrderTask = await prisma.task.findFirst({
        where: {
          boardId: recurringTask.boardId,
          status: TaskStatus.TODO,
        },
        orderBy: { order: "desc" },
      });

      // Create the task
      const task = await prisma.task.create({
        data: {
          title: recurringTask.title,
          description: recurringTask.description,
          boardId: recurringTask.boardId,
          status: TaskStatus.TODO,
          priority: recurringTask.priority,
          assigneeId: recurringTask.assigneeId,
          estimatedHours: recurringTask.estimatedHours,
          statusColumnId: statusColumn?.id || null,
          order: maxOrderTask ? maxOrderTask.order + 1 : 0,
          recurringTaskId: recurringTask.id,
        },
        include: {
          assignee: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          statusColumn: true,
        },
      });

      createdTasks.push(task);

      // Calculate and update next occurrence
      const nextOccurrence = calculateNextOccurrence(recurringTask);
      await prisma.recurringTask.update({
        where: { id: recurringTask.id },
        data: { nextOccurrence },
      });

      // Trigger real-time update
      await triggerPusherEvent(`board-${recurringTask.boardId}`, "task-created", task);
    }

    return NextResponse.json({
      success: true,
      processed: dueRecurringTasks.length,
      created: createdTasks.length,
    });
  } catch (error) {
    console.error("Error processing recurring tasks:", error);
    const message =
      error instanceof Error ? error.message : "Failed to process recurring tasks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function calculateNextOccurrence(recurringTask: any): Date {
  const current = new Date(recurringTask.nextOccurrence);
  const next = new Date(current);

  switch (recurringTask.pattern) {
    case RecurrencePattern.DAILY:
      next.setDate(next.getDate() + recurringTask.interval);
      break;
    case RecurrencePattern.WEEKLY:
      next.setDate(next.getDate() + (7 * recurringTask.interval));
      if (recurringTask.dayOfWeek !== null) {
        // Adjust to specific day of week
        const daysUntil = (recurringTask.dayOfWeek - next.getDay() + 7) % 7;
        if (daysUntil > 0) {
          next.setDate(next.getDate() + daysUntil);
        } else if (daysUntil === 0 && recurringTask.interval === 1) {
          next.setDate(next.getDate() + 7);
        }
      }
      break;
    case RecurrencePattern.MONTHLY:
      next.setMonth(next.getMonth() + recurringTask.interval);
      if (recurringTask.dayOfMonth !== null) {
        next.setDate(recurringTask.dayOfMonth);
      }
      break;
    case RecurrencePattern.YEARLY:
      next.setFullYear(next.getFullYear() + recurringTask.interval);
      if (recurringTask.monthOfYear !== null) {
        next.setMonth(recurringTask.monthOfYear);
      }
      if (recurringTask.dayOfMonth !== null) {
        next.setDate(recurringTask.dayOfMonth);
      }
      break;
    default:
      // CUSTOM - just add interval days
      next.setDate(next.getDate() + recurringTask.interval);
  }

  return next;
}
