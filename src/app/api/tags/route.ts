import { NextRequest, NextResponse } from "next/server";
import { requireMember, requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { triggerPusherEvent } from "@/lib/pusher";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const boardId = searchParams.get("boardId");

    if (!organizationId && !boardId) {
      return NextResponse.json(
        { error: "organizationId or boardId is required" },
        { status: 400 }
      );
    }

    // Verify Prisma client is properly initialized
    if (!prisma || !prisma.tag) {
      console.error("Prisma client not properly initialized. Tag model missing.");
      return NextResponse.json(
        { error: "Database client not initialized. Please restart the server." },
        { status: 500 }
      );
    }

    if (organizationId) {
      await requireMember(organizationId, "VIEWER");
    }

    if (boardId) {
      await requireBoardAccess(boardId, "VIEWER");
    }

    // Build where clause properly handling nullable fields
    let tags;
    if (organizationId) {
      // Query by organizationId (organization-wide tags)
      tags = await prisma.tag.findMany({
        where: {
          organizationId: organizationId,
        },
        include: {
          taskTags: {
            select: {
              taskId: true,
            },
          },
        },
        orderBy: {
          name: "asc",
        },
      });
    } else if (boardId) {
      // Query by boardId (board-specific tags)
      // For now, just get tags directly associated with this board
      // Organization-wide tags can be queried separately if needed
      tags = await prisma.tag.findMany({
        where: {
          boardId: boardId,
        },
        include: {
          taskTags: {
            select: {
              taskId: true,
            },
          },
        },
        orderBy: {
          name: "asc",
        },
      });
    } else {
      return NextResponse.json(
        { error: "organizationId or boardId is required" },
        { status: 400 }
      );
    }

    return NextResponse.json(tags);
  } catch (error) {
    console.error("Error in GET /api/tags:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch tags";
    return NextResponse.json(
      { error: message, details: error instanceof Error ? error.stack : undefined },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, color, organizationId, boardId } = body;

    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    if (organizationId) {
      await requireMember(organizationId, "ADMIN");
    }

    if (boardId) {
      await requireBoardAccess(boardId, "ADMIN");
    }

    // Check if tag already exists (handle nullable fields manually)
    const existing = await prisma.tag.findFirst({
      where: {
        name,
        ...(organizationId ? { organizationId } : { organizationId: null }),
        ...(boardId ? { boardId } : { boardId: null }),
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Tag with this name already exists" },
        { status: 400 }
      );
    }

    const tag = await prisma.tag.create({
      data: {
        name,
        color: color || "#3B82F6",
        organizationId: organizationId || null,
        boardId: boardId || null,
      },
    });

    if (boardId) {
      await triggerPusherEvent(`board-${boardId}`, "tag-created", tag);
    }

    return NextResponse.json(tag);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create tag";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

