import { prisma } from "./prisma";

export async function getUsage(organizationId: string, metric: string, period?: string) {
  const currentPeriod = period || getCurrentPeriod();

  const usage = await prisma.usage.findUnique({
    where: {
      organizationId_metric_period: {
        organizationId,
        metric,
        period: currentPeriod,
      },
    },
  });

  return usage || { count: 0 };
}

export async function incrementUsage(organizationId: string, metric: string, amount: number = 1) {
  const period = getCurrentPeriod();

  const usage = await prisma.usage.upsert({
    where: {
      organizationId_metric_period: {
        organizationId,
        metric,
        period,
      },
    },
    update: {
      count: {
        increment: amount,
      },
    },
    create: {
      organizationId,
      metric,
      period,
      count: amount,
    },
  });

  return usage;
}

export async function decrementUsage(organizationId: string, metric: string, amount: number = 1) {
  const period = getCurrentPeriod();

  const usage = await prisma.usage.findUnique({
    where: {
      organizationId_metric_period: {
        organizationId,
        metric,
        period,
      },
    },
  });

  if (usage) {
    return await prisma.usage.update({
      where: {
        organizationId_metric_period: {
          organizationId,
          metric,
          period,
        },
      },
      data: {
        count: Math.max(0, usage.count - amount),
      },
    });
  }

  return null;
}

export async function getCurrentUsage(organizationId: string) {
  const period = getCurrentPeriod();

  const usageRecords = await prisma.usage.findMany({
    where: {
      organizationId,
      period,
    },
  });

  const usage: Record<string, number> = {};
  for (const record of usageRecords) {
    usage[record.metric] = record.count;
  }

  return usage;
}

function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

// Get actual counts from database (not just usage records)
export async function getActualCounts(organizationId: string) {
  const [boardCount, memberCount, taskCount] = await Promise.all([
    prisma.board.count({
      where: { organizationId },
    }),
    prisma.member.count({
      where: { organizationId },
    }),
    prisma.task.count({
      where: {
        board: {
          organizationId,
        },
      },
    }),
  ]);

  return {
    boards: boardCount,
    members: memberCount,
    tasks: taskCount,
  };
}

