import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const board = await prisma.board.findUnique({
      where: { id },
      include: {
        organization: true,
      },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    await requireMember(board.organizationId);

    // Get all members of the organization
    const members = await prisma.member.findMany({
      where: {
        organizationId: board.organizationId,
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
      orderBy: {
        user: {
          name: "asc",
        },
      },
    });

    return NextResponse.json(members);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch members";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

