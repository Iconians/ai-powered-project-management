import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id: boardId, memberId } = await params;
    const body = await request.json();
    const { role } = body;

    if (!role) {
      return NextResponse.json(
        { error: "role is required" },
        { status: 400 }
      );
    }

    
    const { orgMember } = await requireBoardAccess(boardId);
    
    if (orgMember.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only organization admins can update board member roles" },
        { status: 403 }
      );
    }

    
    const boardMember = await prisma.boardMember.update({
      where: {
        boardId_memberId: {
          boardId,
          memberId,
        },
      },
      data: {
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

    return NextResponse.json(boardMember);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Record to update not found")) {
      return NextResponse.json(
        { error: "Board member not found" },
        { status: 404 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to update board member";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id: boardId, memberId } = await params;
    
    
    const { orgMember } = await requireBoardAccess(boardId);
    
    if (orgMember.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only organization admins can remove board members" },
        { status: 403 }
      );
    }

    
    const boardAdmins = await prisma.boardMember.count({
      where: {
        boardId,
        role: "ADMIN",
      },
    });

    const boardMemberToRemove = await prisma.boardMember.findUnique({
      where: {
        boardId_memberId: {
          boardId,
          memberId,
        },
      },
    });

    if (boardMemberToRemove?.role === "ADMIN" && boardAdmins === 1) {
      return NextResponse.json(
        { error: "Cannot remove the last admin from the board" },
        { status: 400 }
      );
    }

    await prisma.boardMember.delete({
      where: {
        boardId_memberId: {
          boardId,
          memberId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Record to delete does not exist")) {
      return NextResponse.json(
        { error: "Board member not found" },
        { status: 404 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to remove board member";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}


