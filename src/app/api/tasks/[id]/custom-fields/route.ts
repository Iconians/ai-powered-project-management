import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess } from "@/lib/auth";
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

    const taskCustomFields = await prisma.taskCustomField.findMany({
      where: { taskId: id },
      include: {
        customField: true,
      },
    });

    return NextResponse.json(taskCustomFields);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch task custom fields";
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
    const { customFieldId, value } = body;

    if (!customFieldId || value === undefined) {
      return NextResponse.json(
        { error: "customFieldId and value are required" },
        { status: 400 }
      );
    }

    const task = await prisma.task.findUnique({
      where: { id },
      select: { boardId: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await requireBoardAccess(task.boardId, "MEMBER");

    // Check if already exists
    const existing = await prisma.taskCustomField.findUnique({
      where: {
        taskId_customFieldId: {
          taskId: id,
          customFieldId,
        },
      },
    });

    let taskCustomField;
    if (existing) {
      taskCustomField = await prisma.taskCustomField.update({
        where: { id: existing.id },
        data: { value },
        include: {
          customField: true,
        },
      });
    } else {
      taskCustomField = await prisma.taskCustomField.create({
        data: {
          taskId: id,
          customFieldId,
          value,
        },
        include: {
          customField: true,
        },
      });
    }

    await triggerPusherEvent(`board-${task.boardId}`, "task-custom-field-updated", {
      taskId: id,
      taskCustomField,
    });

    return NextResponse.json(taskCustomField);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update task custom field";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

