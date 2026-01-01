import { prisma } from "./prisma";
import { getActualCounts } from "./usage";

export async function getPlan(organizationId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    include: {
      plan: true,
    },
  });

  if (!subscription || subscription.status !== "ACTIVE") {
    // Return free plan as default
    const freePlan = await prisma.plan.findFirst({
      where: { name: "Free" },
    });

    if (!freePlan) {
      throw new Error("Free plan not found");
    }

    return freePlan;
  }

  return subscription.plan;
}

export async function checkLimit(
  organizationId: string,
  metric: "boards" | "members" | "tasks"
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const plan = await getPlan(organizationId);
  const actualCounts = await getActualCounts(organizationId);

  let limit: number;
  let current: number;

  switch (metric) {
    case "boards":
      limit = plan.maxBoards === -1 ? Infinity : plan.maxBoards;
      current = actualCounts.boards;
      break;
    case "members":
      limit = plan.maxMembers === -1 ? Infinity : plan.maxMembers;
      current = actualCounts.members;
      break;
    case "tasks":
      limit = plan.maxTasks === -1 ? Infinity : (plan.maxTasks || Infinity);
      current = actualCounts.tasks;
      break;
    default:
      throw new Error(`Unknown metric: ${metric}`);
  }

  return {
    allowed: current < limit,
    current,
    limit,
  };
}

export async function requireLimit(
  organizationId: string,
  metric: "boards" | "members" | "tasks"
) {
  const result = await checkLimit(organizationId, metric);

  if (!result.allowed) {
    throw new Error(
      `${metric} limit reached (${result.current}/${result.limit === Infinity ? "unlimited" : result.limit}). Please upgrade your plan.`
    );
  }

  return result;
}

