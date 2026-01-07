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

    const checklistItems = await prisma.checklistItem.findMany({
      where: { taskId: id },
      orderBy: { order: "asc" },
    });

    return NextResponse.json(checklistItems);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch checklist";
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
    const { text, order } = body;

    if (!text) {
      return NextResponse.json(
        { error: "text is required" },
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

    // Get max order if not provided
    let itemOrder = order;
    if (itemOrder === undefined) {
      const maxItem = await prisma.checklistItem.findFirst({
        where: { taskId: id },
        orderBy: { order: "desc" },
      });
      itemOrder = maxItem ? maxItem.order + 1 : 0;
    }

    const checklistItem = await prisma.checklistItem.create({
      data: {
        taskId: id,
        text,
        order: itemOrder,
      },
    });

    await triggerPusherEvent(`board-${task.boardId}`, "checklist-item-created", {
      taskId: id,
      checklistItem,
    });

    return NextResponse.json(checklistItem);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create checklist item";
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
    const { itemId, text, isCompleted, order } = body;

    if (!itemId) {
      return NextResponse.json(
        { error: "itemId is required" },
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

    const updateData: any = {};
    if (text !== undefined) updateData.text = text;
    if (isCompleted !== undefined) updateData.isCompleted = isCompleted;
    if (order !== undefined) updateData.order = order;

    const checklistItem = await prisma.checklistItem.update({
      where: { id: itemId },
      data: updateData,
    });

    await triggerPusherEvent(`board-${task.boardId}`, "checklist-item-updated", {
      taskId: id,
      checklistItem,
    });

    return NextResponse.json(checklistItem);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update checklist item";
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
    const itemId = searchParams.get("itemId");

    if (!itemId) {
      return NextResponse.json(
        { error: "itemId is required" },
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

    await prisma.checklistItem.delete({
      where: { id: itemId },
    });

    await triggerPusherEvent(`board-${task.boardId}`, "checklist-item-deleted", {
      taskId: id,
      itemId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete checklist item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

