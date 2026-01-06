import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: boardId } = await params;
    const body = await request.json();
    const { memberId, role = "VIEWER" } = body;

    if (!memberId) {
      return NextResponse.json(
        { error: "memberId is required" },
        { status: 400 }
      );
    }

    
    const { board, orgMember } = await requireBoardAccess(boardId);

    if (orgMember.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only organization admins can add board members" },
        { status: 403 }
      );
    }

    
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member || member.organizationId !== board.organizationId) {
      return NextResponse.json(
        { error: "Member does not belong to this organization" },
        { status: 400 }
      );
    }

    
    const existingBoardMember = await prisma.boardMember.findUnique({
      where: {
        boardId_memberId: {
          boardId,
          memberId,
        },
      },
    });

    if (existingBoardMember) {
      return NextResponse.json(
        { error: "Member already has access to this board" },
        { status: 409 }
      );
    }

    
    const boardMember = await prisma.boardMember.create({
      data: {
        boardId,
        memberId,
        role: role as "ADMIN" | "MEMBER" | "VIEWER",
      },
      include: {
        member: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(boardMember, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to add board member";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: boardId } = await params;

    
    await requireBoardAccess(boardId);

    const boardMembers = await prisma.boardMember.findMany({
      where: {
        boardId,
      },
      include: {
        member: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(boardMembers);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch board members";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
