import { prisma } from "./prisma";

/**
 * Check if creating a dependency would create a circular dependency
 */
export async function hasCircularDependency(
  taskId: string,
  dependsOnId: string
): Promise<boolean> {
  // A task cannot depend on itself
  if (taskId === dependsOnId) {
    return true;
  }

  // Check if dependsOnId already depends on taskId (directly or indirectly)
  const visited = new Set<string>();
  const queue: string[] = [dependsOnId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    
    if (currentId === taskId) {
      return true; // Circular dependency found
    }

    if (visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);

    // Get all tasks that currentId depends on
    const dependencies = await prisma.taskDependency.findMany({
      where: { taskId: currentId },
      select: { dependsOnId: true },
    });

    for (const dep of dependencies) {
      if (!visited.has(dep.dependsOnId)) {
        queue.push(dep.dependsOnId);
      }
    }
  }

  return false;
}

/**
 * Get all tasks that block the given task
 */
export async function getBlockingTasks(taskId: string) {
  return prisma.taskDependency.findMany({
    where: {
      taskId,
      type: "BLOCKS",
    },
    include: {
      dependsOn: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
  });
}

/**
 * Get all tasks blocked by the given task
 */
export async function getBlockedTasks(taskId: string) {
  return prisma.taskDependency.findMany({
    where: {
      dependsOnId: taskId,
      type: "BLOCKS",
    },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
  });
}

/**
 * Check if a task is blocked by incomplete dependencies
 */
export async function isTaskBlocked(taskId: string): Promise<boolean> {
  const blockingDeps = await prisma.taskDependency.findMany({
    where: {
      taskId,
      type: "BLOCKS",
    },
    include: {
      dependsOn: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  // Task is blocked if any dependency is not DONE
  return blockingDeps.some((dep) => dep.dependsOn.status !== "DONE");
}

