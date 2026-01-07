import { NextRequest, NextResponse } from "next/server";
import { requireMember, requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const boardId = searchParams.get("boardId");
    const taskId = searchParams.get("taskId");
    const entityType = searchParams.get("entityType");
    const limit = parseInt(searchParams.get("limit") || "100");

    if (!organizationId && !boardId && !taskId) {
      return NextResponse.json(
        { error: "organizationId, boardId, or taskId is required" },
        { status: 400 }
      );
    }

    if (organizationId) {
      await requireMember(organizationId, "ADMIN");
    }

    if (boardId) {
      await requireBoardAccess(boardId, "ADMIN");
    }

    const where: any = {};
    if (organizationId) where.organizationId = organizationId;
    if (boardId) where.boardId = boardId;
    if (taskId) where.taskId = taskId;
    if (entityType) where.entityType = entityType;

    const auditLogs = await prisma.auditLog.findMany({
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

    return NextResponse.json(auditLogs);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch audit logs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

