import { NextRequest, NextResponse } from "next/server";
import { requireMember, requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const board = await prisma.board.findUnique({
      where: { id },
      include: {
        statuses: {
          orderBy: { order: "asc" },
        },
        tasks: {
          include: {
            assignee: {
              select: {
                id: true,
                userId: true,
                role: true,
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
          orderBy: { order: "asc" },
        },
        organization: true,
        team: true,
      },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    // Check board access (requires both org membership and board access)
    await requireBoardAccess(id);

    return NextResponse.json(board);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch board";
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
        name: body.name,
        description: body.description,
      },
      include: {
        statuses: {
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json(updatedBoard);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update board";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check board access - only org admins can delete board
    const { orgMember } = await requireBoardAccess(id);
    if (orgMember.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only organization admins can delete boards" },
        { status: 403 }
      );
    }

    await prisma.board.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete board";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
