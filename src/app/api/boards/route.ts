import { NextRequest, NextResponse } from "next/server";
import { requireMember, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@prisma/client";
import { requireLimit } from "@/lib/limits";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, organizationId, teamId } = body;

    if (!name || !organizationId) {
      return NextResponse.json(
        { error: "Name and organizationId are required" },
        { status: 400 }
      );
    }

    
    if (name.length > 200) {
      return NextResponse.json(
        { error: "Board name must be less than 200 characters" },
        { status: 400 }
      );
    }

    if (description && description.length > 5000) {
      return NextResponse.json(
        { error: "Description must be less than 5000 characters" },
        { status: 400 }
      );
    }

    const member = await requireMember(organizationId);
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    
    try {
      await requireLimit(organizationId, "boards");
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Board limit reached",
        },
        { status: 403 }
      );
    }

    const board = await prisma.board.create({
      data: {
        name,
        description,
        organizationId,
        teamId: teamId || null,
        statuses: {
          create: [
            { name: "To Do", status: TaskStatus.TODO, order: 0 },
            { name: "In Progress", status: TaskStatus.IN_PROGRESS, order: 1 },
            { name: "In Review", status: TaskStatus.IN_REVIEW, order: 2 },
            { name: "Done", status: TaskStatus.DONE, order: 3 },
          ],
        },
        boardMembers: {
          create: {
            memberId: member.id,
            role: "ADMIN", 
          },
        },
      },
      include: {
        statuses: true,
      },
    });

    return NextResponse.json(board, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create board";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const teamId = searchParams.get("teamId");

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 }
      );
    }

    const member = await requireMember(organizationId);
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    
    const allBoards = await prisma.board.findMany({
      where: {
        organizationId,
        ...(teamId ? { teamId } : {}),
      },
      include: {
        statuses: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: { tasks: true },
        },
        boardMembers: {
          where: {
            memberId: member.id,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    
    const accessibleBoards = allBoards.filter(
      (board) => board.boardMembers.length > 0
    );

    return NextResponse.json(accessibleBoards);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch boards";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
