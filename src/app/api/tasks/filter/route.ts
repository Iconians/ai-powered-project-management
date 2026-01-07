import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaskStatus, TaskPriority } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get("boardId");
    const assigneeId = searchParams.get("assigneeId");
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const tagId = searchParams.get("tagId");
    const dueDateFrom = searchParams.get("dueDateFrom");
    const dueDateTo = searchParams.get("dueDateTo");
    const searchQuery = searchParams.get("q");

    if (!boardId) {
      return NextResponse.json(
        { error: "boardId is required" },
        { status: 400 }
      );
    }

    await requireBoardAccess(boardId, "VIEWER");

    const where: any = {
      boardId,
    };

    if (assigneeId) {
      where.assigneeId = assigneeId;
    }

    if (status) {
      const validStatuses = Object.values(TaskStatus);
      if (validStatuses.includes(status as TaskStatus)) {
        where.status = status;
      }
    }

    if (priority) {
      const validPriorities = Object.values(TaskPriority);
      if (validPriorities.includes(priority as TaskPriority)) {
        where.priority = priority;
      }
    }

    if (tagId) {
      where.tags = {
        some: {
          tagId,
        },
      };
    }

    if (dueDateFrom || dueDateTo) {
      where.dueDate = {};
      if (dueDateFrom) {
        where.dueDate.gte = new Date(dueDateFrom);
      }
      if (dueDateTo) {
        where.dueDate.lte = new Date(dueDateTo);
      }
    }

    if (searchQuery && searchQuery.trim().length > 0) {
      where.OR = [
        {
          title: {
            contains: searchQuery,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: searchQuery,
            mode: "insensitive",
          },
        },
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to filter tasks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

