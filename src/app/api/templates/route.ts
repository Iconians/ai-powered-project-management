import { NextRequest, NextResponse } from "next/server";
import { requireMember, requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaskPriority } from "@prisma/client";

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

    if (organizationId) {
      await requireMember(organizationId, "VIEWER");
    }

    if (boardId) {
      await requireBoardAccess(boardId, "VIEWER");
    }

    const templates = await prisma.taskTemplate.findMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
        ...(boardId ? { boardId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(templates);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch templates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      organizationId,
      boardId,
      title,
      taskDescription,
      priority,
      estimatedHours,
      checklistItems,
      tags,
    } = body;

    if (!name || !title) {
      return NextResponse.json(
        { error: "name and title are required" },
        { status: 400 }
      );
    }

    if (organizationId) {
      await requireMember(organizationId, "ADMIN");
    }

    if (boardId) {
      await requireBoardAccess(boardId, "ADMIN");
    }

    const validPriorities = Object.values(TaskPriority);
    const taskPriority = priority && validPriorities.includes(priority) ? priority : TaskPriority.MEDIUM;

    const template = await prisma.taskTemplate.create({
      data: {
        name,
        description: description || null,
        organizationId: organizationId || null,
        boardId: boardId || null,
        title,
        taskDescription: taskDescription || null,
        priority: taskPriority,
        estimatedHours: estimatedHours || null,
        checklistItems: checklistItems || null,
        tags: tags || [],
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

