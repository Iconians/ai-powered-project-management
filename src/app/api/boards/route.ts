import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@prisma/client";

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

    await requireMember(organizationId);

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

    await requireMember(organizationId);

    const boards = await prisma.board.findMany({
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
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(boards);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch boards";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
