import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { triggerPusherEvent } from "@/lib/pusher";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: { id },
      select: { boardId: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await requireBoardAccess(task.boardId, "VIEWER");

    const timeEntries = await prisma.timeEntry.findMany({
      where: { taskId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { startTime: "desc" },
    });

    return NextResponse.json(timeEntries);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch time entries";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { description, startTime, endTime, duration, billable } = body;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id },
      select: { boardId: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await requireBoardAccess(task.boardId, "MEMBER");

    if (!startTime) {
      return NextResponse.json(
        { error: "startTime is required" },
        { status: 400 }
      );
    }

    const timeEntry = await prisma.timeEntry.create({
      data: {
        taskId: id,
        userId: user.id,
        description,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
        duration: duration || null,
        billable: billable || false,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Update task's actualHours
    const totalDuration = await prisma.timeEntry.aggregate({
      where: { taskId: id },
      _sum: {
        duration: true,
      },
    });

    if (totalDuration._sum.duration) {
      await prisma.task.update({
        where: { id },
        data: {
          actualHours: totalDuration._sum.duration / 3600, // Convert seconds to hours
        },
      });
    }

    await triggerPusherEvent(`board-${task.boardId}`, "time-entry-created", {
      taskId: id,
      timeEntry,
    });

    return NextResponse.json(timeEntry);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create time entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const entryId = searchParams.get("entryId");

    if (!entryId) {
      return NextResponse.json(
        { error: "entryId is required" },
        { status: 400 }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id },
      select: { boardId: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await requireBoardAccess(task.boardId, "MEMBER");

    // Check if user owns this entry or is admin
    const entry = await prisma.timeEntry.findUnique({
      where: { id: entryId },
      select: { userId: true },
    });

    if (!entry) {
      return NextResponse.json(
        { error: "Time entry not found" },
        { status: 404 }
      );
    }

    const { orgMember } = await requireBoardAccess(task.boardId);
    if (entry.userId !== user.id && orgMember.role !== "ADMIN") {
      return NextResponse.json(
        { error: "You can only delete your own time entries" },
        { status: 403 }
      );
    }

    await prisma.timeEntry.delete({
      where: { id: entryId },
    });

    // Update task's actualHours
    const totalDuration = await prisma.timeEntry.aggregate({
      where: { taskId: id },
      _sum: {
        duration: true,
      },
    });

    await prisma.task.update({
      where: { id },
      data: {
        actualHours: totalDuration._sum.duration ? totalDuration._sum.duration / 3600 : null,
      },
    });

    await triggerPusherEvent(`board-${task.boardId}`, "time-entry-deleted", {
      taskId: id,
      entryId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete time entry";
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
    const { entryId, endTime, duration } = body;

    if (!entryId) {
      return NextResponse.json(
        { error: "entryId is required" },
        { status: 400 }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id },
      select: { boardId: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await requireBoardAccess(task.boardId, "MEMBER");

    const updateData: any = {};
    if (endTime) updateData.endTime = new Date(endTime);
    if (duration !== undefined) updateData.duration = duration;

    const timeEntry = await prisma.timeEntry.update({
      where: { id: entryId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Update task's actualHours
    const totalDuration = await prisma.timeEntry.aggregate({
      where: { taskId: id },
      _sum: {
        duration: true,
      },
    });

    if (totalDuration._sum.duration) {
      await prisma.task.update({
        where: { id },
        data: {
          actualHours: totalDuration._sum.duration / 3600,
        },
      });
    }

    await triggerPusherEvent(`board-${task.boardId}`, "time-entry-updated", {
      taskId: id,
      timeEntry,
    });

    return NextResponse.json(timeEntry);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update time entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

