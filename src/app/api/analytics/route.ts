import { NextRequest, NextResponse } from "next/server";
import { requireMember, requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const boardId = searchParams.get("boardId");
    const sprintId = searchParams.get("sprintId");
    const period = searchParams.get("period") || "month"; // week, month, quarter, year

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

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case "week":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case "month":
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
      case "quarter":
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 3);
        break;
      case "year":
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
    }

    const where: any = {
      createdAt: { gte: startDate },
    };

    if (boardId) {
      where.boardId = boardId;
    } else if (organizationId) {
      where.board = { organizationId };
    }

    if (sprintId) {
      where.sprintId = sprintId;
    }

    // Get task statistics
    const totalTasks = await prisma.task.count({ where });
    const completedTasks = await prisma.task.count({
      where: { ...where, status: "DONE" },
    });
    const inProgressTasks = await prisma.task.count({
      where: { ...where, status: "IN_PROGRESS" },
    });
    const blockedTasks = await prisma.task.count({
      where: { ...where, status: "BLOCKED" },
    });

    // Get tasks by status over time
    const tasksByStatus = await prisma.task.groupBy({
      by: ["status"],
      where,
      _count: true,
    });

    // Get tasks by priority
    const tasksByPriority = await prisma.task.groupBy({
      by: ["priority"],
      where,
      _count: true,
    });

    // Get completion rate
    const completionRate =
      totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Get average time to completion (for completed tasks)
    const completedTasksWithDates = await prisma.task.findMany({
      where: { ...where, status: "DONE" },
      select: {
        createdAt: true,
        updatedAt: true,
      },
    });

    const cycleTimes = completedTasksWithDates.map((task) => {
      return (
        (new Date(task.updatedAt).getTime() -
          new Date(task.createdAt).getTime()) /
        (1000 * 60 * 60 * 24)
      ); // days
    });

    const averageCycleTime =
      cycleTimes.length > 0
        ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
        : 0;

    // Get velocity (tasks completed per period)
    const velocity = completedTasks;

    // Get tasks created over time (for burndown)
    const tasksOverTime = await prisma.task.findMany({
      where,
      select: {
        createdAt: true,
        status: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      totalTasks,
      completedTasks,
      inProgressTasks,
      blockedTasks,
      completionRate: Math.round(completionRate * 100) / 100,
      averageCycleTime: Math.round(averageCycleTime * 100) / 100,
      velocity,
      tasksByStatus: tasksByStatus.map((item) => ({
        status: item.status,
        count: item._count,
      })),
      tasksByPriority: tasksByPriority.map((item) => ({
        priority: item.priority,
        count: item._count,
      })),
      tasksOverTime: tasksOverTime.map((task) => ({
        date: task.createdAt,
        status: task.status,
        completedAt: task.status === "DONE" ? task.updatedAt : null,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

