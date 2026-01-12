import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaskPriority, RecurrencePattern } from "@prisma/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const recurringTask = await prisma.recurringTask.findUnique({
      where: { id },
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
        board: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!recurringTask) {
      return NextResponse.json(
        { error: "Recurring task not found" },
        { status: 404 }
      );
    }

    await requireBoardAccess(recurringTask.boardId, "VIEWER");

    return NextResponse.json(recurringTask);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch recurring task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const recurringTask = await prisma.recurringTask.findUnique({
      where: { id },
      select: { boardId: true },
    });

    if (!recurringTask) {
      return NextResponse.json(
        { error: "Recurring task not found" },
        { status: 404 }
      );
    }

    await requireBoardAccess(recurringTask.boardId, "MEMBER");

    const updateData: any = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description || null;
    if (body.priority !== undefined) {
      const validPriorities = Object.values(TaskPriority);
      if (validPriorities.includes(body.priority)) {
        updateData.priority = body.priority;
      }
    }
    if (body.assigneeId !== undefined) updateData.assigneeId = body.assigneeId || null;
    if (body.estimatedHours !== undefined) updateData.estimatedHours = body.estimatedHours ? parseFloat(body.estimatedHours) : null;
    if (body.pattern !== undefined) {
      const validPatterns = Object.values(RecurrencePattern);
      if (validPatterns.includes(body.pattern)) {
        updateData.pattern = body.pattern;
      }
    }
    if (body.interval !== undefined) updateData.interval = body.interval;
    if (body.dayOfWeek !== undefined) updateData.dayOfWeek = body.dayOfWeek;
    if (body.dayOfMonth !== undefined) updateData.dayOfMonth = body.dayOfMonth;
    if (body.monthOfYear !== undefined) updateData.monthOfYear = body.monthOfYear;
    if (body.startDate !== undefined) updateData.startDate = new Date(body.startDate);
    if (body.endDate !== undefined) updateData.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const updated = await prisma.recurringTask.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json(updated);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update recurring task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const recurringTask = await prisma.recurringTask.findUnique({
      where: { id },
      select: { boardId: true },
    });

    if (!recurringTask) {
      return NextResponse.json(
        { error: "Recurring task not found" },
        { status: 404 }
      );
    }

    await requireBoardAccess(recurringTask.boardId, "MEMBER");

    await prisma.recurringTask.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete recurring task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
