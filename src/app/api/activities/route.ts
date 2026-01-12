import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireMember, requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const boardId = searchParams.get("boardId");
    const taskId = searchParams.get("taskId");
    const limit = parseInt(searchParams.get("limit") || "50");

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (organizationId) {
      await requireMember(organizationId, "VIEWER");
    }

    if (boardId) {
      await requireBoardAccess(boardId, "VIEWER");
    }

    const where: any = {};
    if (organizationId) where.organizationId = organizationId;
    if (boardId) where.boardId = boardId;
    if (taskId) where.taskId = taskId;

    const activities = await prisma.activity.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(activities);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch activities";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

