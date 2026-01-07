import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const watchers = await prisma.taskWatcher.findMany({
      where: { userId: user.id },
      include: {
        task: {
          include: {
            board: {
              select: {
                id: true,
                name: true,
                organizationId: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const tasks = watchers.map((watcher) => ({
      id: watcher.task.id,
      title: watcher.task.title,
      status: watcher.task.status,
      priority: watcher.task.priority,
      board: watcher.task.board,
    }));

    return NextResponse.json(tasks);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch watching tasks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

