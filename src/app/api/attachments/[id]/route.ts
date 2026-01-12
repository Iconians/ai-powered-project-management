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

    const attachment = await prisma.attachment.findUnique({
      where: { id },
      include: {
        task: {
          select: {
            boardId: true,
          },
        },
      },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    await requireBoardAccess(attachment.task.boardId, "VIEWER");

    // Generate signed URL if expired or not present
    // In production, this would use your storage service's signed URL generation
    // For now, return the existing signedUrl or filePath
    const signedUrl = attachment.signedUrl || attachment.filePath;

    return NextResponse.json({
      ...attachment,
      signedUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch attachment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const attachment = await prisma.attachment.findUnique({
      where: { id },
      include: {
        task: {
          select: {
            boardId: true,
          },
        },
      },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    await requireBoardAccess(attachment.task.boardId, "MEMBER");

    await prisma.attachment.delete({
      where: { id },
    });

    await triggerPusherEvent(
      `board-${attachment.task.boardId}`,
      "attachment-deleted",
      { attachmentId: id }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete attachment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

