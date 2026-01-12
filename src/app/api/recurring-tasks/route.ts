import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaskPriority, RecurrencePattern } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get("boardId");

    if (!boardId) {
      return NextResponse.json(
        { error: "boardId is required" },
        { status: 400 }
      );
    }

    await requireBoardAccess(boardId, "VIEWER");

    const recurringTasks = await prisma.recurringTask.findMany({
      where: { boardId },
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
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(recurringTasks);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch recurring tasks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      boardId,
      title,
      description,
      priority,
      assigneeId,
      estimatedHours,
      pattern,
      interval,
      dayOfWeek,
      dayOfMonth,
      monthOfYear,
      startDate,
      endDate,
    } = body;

    if (!boardId || !title || !pattern || !startDate) {
      return NextResponse.json(
        { error: "boardId, title, pattern, and startDate are required" },
        { status: 400 }
      );
    }

    await requireBoardAccess(boardId, "MEMBER");

    // Validate priority
    const validPriorities = Object.values(TaskPriority);
    const taskPriority = priority && validPriorities.includes(priority) ? priority : TaskPriority.MEDIUM;

    // Validate pattern
    const validPatterns = Object.values(RecurrencePattern);
    if (!validPatterns.includes(pattern)) {
      return NextResponse.json(
        { error: "Invalid recurrence pattern" },
        { status: 400 }
      );
    }

    // Calculate next occurrence based on pattern
    const start = new Date(startDate);
    let nextOccurrence = new Date(start);

    const recurringTask = await prisma.recurringTask.create({
      data: {
        boardId,
        title,
        description: description || null,
        priority: taskPriority,
        assigneeId: assigneeId || null,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
        pattern: pattern as RecurrencePattern,
        interval: interval || 1,
        dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : null,
        dayOfMonth: dayOfMonth !== undefined ? dayOfMonth : null,
        monthOfYear: monthOfYear !== undefined ? monthOfYear : null,
        startDate: start,
        endDate: endDate ? new Date(endDate) : null,
        nextOccurrence: start, // Will be calculated properly by worker
        isActive: true,
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
      },
    });

    return NextResponse.json(recurringTask);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create recurring task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
