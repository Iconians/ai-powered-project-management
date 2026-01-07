import { NextRequest, NextResponse } from "next/server";
import { requireMember, requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { triggerPusherEvent } from "@/lib/pusher";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, color } = body;

    const tag = await prisma.tag.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        organizationId: true,
        boardId: true,
      },
    });

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Check permissions
    if (tag.organizationId) {
      await requireMember(tag.organizationId, "ADMIN");
    }

    if (tag.boardId) {
      await requireBoardAccess(tag.boardId, "ADMIN");
    }

    // Check if new name conflicts with existing tag
    if (name && name !== tag.name) {
      const existing = await prisma.tag.findFirst({
        where: {
          name,
          ...(tag.organizationId
            ? { organizationId: tag.organizationId }
            : { organizationId: null }),
          ...(tag.boardId ? { boardId: tag.boardId } : { boardId: null }),
          NOT: { id },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Tag with this name already exists" },
          { status: 400 }
        );
      }
    }

    const updatedTag = await prisma.tag.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(color && { color }),
      },
    });

    if (tag.boardId) {
      await triggerPusherEvent(`board-${tag.boardId}`, "tag-updated", updatedTag);
    }

    return NextResponse.json(updatedTag);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update tag";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const tag = await prisma.tag.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        organizationId: true,
        boardId: true,
      },
    });

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Check permissions
    if (tag.organizationId) {
      await requireMember(tag.organizationId, "ADMIN");
    }

    if (tag.boardId) {
      await requireBoardAccess(tag.boardId, "ADMIN");
    }

    await prisma.tag.delete({
      where: { id },
    });

    if (tag.boardId) {
      await triggerPusherEvent(`board-${tag.boardId}`, "tag-deleted", { id });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete tag";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

