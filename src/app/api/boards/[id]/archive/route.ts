import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { triggerPusherEvent } from "@/lib/pusher";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const board = await prisma.board.findUnique({
      where: { id },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    await requireMember(board.organizationId, "ADMIN");

    const updatedBoard = await prisma.board.update({
      where: { id },
      data: {
        archived: true,
        archivedAt: new Date(),
      },
    });

    await triggerPusherEvent(`board-${id}`, "board-archived", updatedBoard);

    return NextResponse.json(updatedBoard);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to archive board";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const board = await prisma.board.findUnique({
      where: { id },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    await requireMember(board.organizationId, "ADMIN");

    const updatedBoard = await prisma.board.update({
      where: { id },
      data: {
        archived: false,
        archivedAt: null,
      },
    });

    await triggerPusherEvent(`board-${id}`, "board-restored", updatedBoard);

    return NextResponse.json(updatedBoard);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to restore board";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

