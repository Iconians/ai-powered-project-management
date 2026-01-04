import { prisma } from "@/lib/prisma";
import { getGitHubClient } from "@/lib/github";
import { Octokit } from "@octokit/rest";
import { TaskStatus } from "@prisma/client";

// Map task status to GitHub issue state
function mapStatusToGitHubState(status: TaskStatus): "open" | "closed" {
  return status === "DONE" ? "closed" : "open";
}

// Map task status to GitHub issue labels (for column tracking)
function mapStatusToLabel(status: TaskStatus): string {
  const statusMap: Record<TaskStatus, string> = {
    TODO: "todo",
    IN_PROGRESS: "in-progress",
    IN_REVIEW: "in-review",
    DONE: "done",
    BLOCKED: "blocked",
  };
  return statusMap[status] || "todo";
}

// Sync task update to GitHub issue
export async function syncTaskToGitHub(taskId: string) {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        board: true,
        assignee: {
          include: {
            user: true,
          },
        },
        statusColumn: true,
      },
    });

    if (!task || !task.githubIssueNumber || !task.board.githubSyncEnabled || !task.board.githubAccessToken || !task.board.githubRepoName) {
      return; // Not synced or not configured
    }

    const githubClient = getGitHubClient(task.board.githubAccessToken);
    const [owner, repo] = task.board.githubRepoName.split("/");

    // Update GitHub issue
    const updateData: any = {
      owner,
      repo,
      issue_number: task.githubIssueNumber,
      title: task.title,
      body: task.description || "",
      state: mapStatusToGitHubState(task.status),
    };

    console.log(`🔄 Syncing task ${task.id} to GitHub issue #${task.githubIssueNumber}`, {
      title: task.title,
      status: task.status,
      hasDescription: !!task.description,
    });

    // Update assignee if task has one
    if (task.assignee?.user?.githubUsername) {
      try {
        // Get current assignees
        const { data: issue } = await githubClient.rest.issues.get({
          owner,
          repo,
          issue_number: task.githubIssueNumber,
        });

        const currentAssignees = issue.assignees?.map((a) => a.login) || [];
        const shouldAssign = !currentAssignees.includes(task.assignee.user.githubUsername);

        if (shouldAssign) {
          // Remove existing assignees and add new one
          if (currentAssignees.length > 0) {
            await githubClient.rest.issues.removeAssignees({
              owner,
              repo,
              issue_number: task.githubIssueNumber,
              assignees: currentAssignees,
            });
          }
          
          await githubClient.rest.issues.addAssignees({
            owner,
            repo,
            issue_number: task.githubIssueNumber,
            assignees: [task.assignee.user.githubUsername],
          });
          console.log(`✅ Assigned GitHub user ${task.assignee.user.githubUsername} to issue #${task.githubIssueNumber}`);
        }
      } catch (error) {
        console.error("Failed to assign GitHub user:", error);
        // Continue even if assignee sync fails
      }
    } else if (task.assignee) {
      // Task has assignee but no GitHub username - log warning
      console.warn(`⚠️ Task ${task.id} has assignee ${task.assignee.user.email} but no GitHub username`);
    } else {
      // Task has no assignee - remove any GitHub assignees
      try {
        const { data: issue } = await githubClient.rest.issues.get({
          owner,
          repo,
          issue_number: task.githubIssueNumber,
        });

        const currentAssignees = issue.assignees?.map((a) => a.login) || [];
        if (currentAssignees.length > 0) {
          await githubClient.rest.issues.removeAssignees({
            owner,
            repo,
            issue_number: task.githubIssueNumber,
            assignees: currentAssignees,
          });
          console.log(`✅ Removed assignees from issue #${task.githubIssueNumber}`);
        }
      } catch (error) {
        console.error("Failed to remove GitHub assignees:", error);
      }
    }

    // Update labels to reflect status column
    if (task.statusColumn) {
      const statusLabel = mapStatusToLabel(task.status);
      const { data: labels } = await githubClient.rest.issues.listLabelsOnIssue({
        owner,
        repo,
        issue_number: task.githubIssueNumber,
      });

      // Remove old status labels and add new one
      const statusLabels = ["todo", "in-progress", "in-review", "done", "blocked"];
      const labelsToRemove = labels
        .filter((l) => statusLabels.includes(l.name.toLowerCase()))
        .map((l) => l.name);
      const labelsToAdd = [statusLabel];

      // Remove old labels
      for (const label of labelsToRemove) {
        if (label !== statusLabel) {
          try {
            await githubClient.rest.issues.removeLabel({
              owner,
              repo,
              issue_number: task.githubIssueNumber,
              name: label,
            });
          } catch (error) {
            // Label might not exist, continue
          }
        }
      }

      // Add new label
      try {
        await githubClient.rest.issues.addLabels({
          owner,
          repo,
          issue_number: task.githubIssueNumber,
          labels: [statusLabel],
        });
      } catch (error) {
        // Label might not exist, create it first
        try {
          await githubClient.rest.issues.createLabel({
            owner,
            repo,
            name: statusLabel,
            color: "0e8a16", // Green
          });
          await githubClient.rest.issues.addLabels({
            owner,
            repo,
            issue_number: task.githubIssueNumber,
            labels: [statusLabel],
          });
        } catch (createError) {
          console.error("Failed to create/add label:", createError);
        }
      }
    }

    await githubClient.rest.issues.update(updateData);

    // Sync to GitHub Project if project ID is set
    if (task.board.githubProjectId) {
      try {
        const { syncTaskToGitHubProject } = await import("@/lib/github-project-sync");
        await syncTaskToGitHubProject(
          githubClient,
          task.githubIssueNumber,
          task.board.githubProjectId,
          task.status,
          task.board.githubRepoName
        );
      } catch (projectError) {
        console.error("Failed to sync to GitHub Project:", projectError);
        // Don't fail if project sync fails
      }
    }
  } catch (error) {
    console.error("Failed to sync task to GitHub:", error);
    // Don't throw - sync failures shouldn't break the app
  }
}

// Create or update task from GitHub issue
export async function syncGitHubIssueToTask(
  issue: any,
  repository: { owner: { login: string }; name: string },
  boardId: string
) {
  try {
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        statuses: {
          orderBy: { order: "asc" },
        },
        organization: true,
      },
    });

    if (!board || !board.githubAccessToken) {
      throw new Error("Board not found or GitHub not configured");
    }

    // Fetch full issue data from GitHub to get current assignees
    // The webhook payload might not always have complete assignee information
    const githubClient = getGitHubClient(board.githubAccessToken);
    const [owner, repo] = board.githubRepoName?.split("/") || [repository.owner.login, repository.name];
    
    let fullIssue = issue;
    try {
      const { data: fetchedIssue } = await githubClient.rest.issues.get({
        owner,
        repo,
        issue_number: issue.number,
      });
      fullIssue = fetchedIssue;
    } catch (error) {
      console.warn("Failed to fetch full issue from GitHub, using webhook payload:", error);
      // Continue with webhook payload if fetch fails
    }

    // Map GitHub issue state to task status
    // Try to map based on labels first, then fall back to state
    let taskStatus: TaskStatus = fullIssue.state === "closed" ? "DONE" : "TODO";
    
    // Check if issue has status labels
    if (fullIssue.labels && Array.isArray(fullIssue.labels)) {
      const labelNames = fullIssue.labels.map((l: any) => l.name.toLowerCase());
      if (labelNames.includes("in-progress")) taskStatus = "IN_PROGRESS";
      else if (labelNames.includes("in-review")) taskStatus = "IN_REVIEW";
      else if (labelNames.includes("blocked")) taskStatus = "BLOCKED";
      else if (labelNames.includes("done")) taskStatus = "DONE";
      else if (labelNames.includes("todo")) taskStatus = "TODO";
    }
    
    // Find the appropriate status column
    const statusColumn = board.statuses.find((s) => s.status === taskStatus) || board.statuses[0];

    // Check if task already exists for this issue
    const existingTask = await prisma.task.findFirst({
      where: {
        boardId,
        githubIssueNumber: fullIssue.number,
      },
    });

    // Find assignee based on GitHub login
    let assigneeId: string | null = null;
    if (fullIssue.assignee?.login) {
      // Single assignee (legacy field)
      const user = await prisma.user.findFirst({
        where: { githubUsername: fullIssue.assignee.login },
      });
      if (user) {
        const member = await prisma.member.findFirst({
          where: { userId: user.id, organizationId: board.organizationId },
        });
        assigneeId = member?.id || null;
      }
    } else if (fullIssue.assignees && fullIssue.assignees.length > 0) {
      // Multiple assignees - use the first one
      const firstAssignee = fullIssue.assignees[0];
      const user = await prisma.user.findFirst({
        where: { githubUsername: firstAssignee.login },
      });
      if (user) {
        const member = await prisma.member.findFirst({
          where: { userId: user.id, organizationId: board.organizationId },
        });
        assigneeId = member?.id || null;
      }
    }
    // If no assignees on GitHub, assigneeId will be null (unassigned)

    if (existingTask) {
      // Update existing task
      const updatedTask = await prisma.task.update({
        where: { id: existingTask.id },
        data: {
          title: fullIssue.title,
          description: fullIssue.body || null,
          status: taskStatus,
          statusColumnId: statusColumn.id,
          assigneeId: assigneeId, // Update assignee based on GitHub issue
        },
      });
      console.log(`✅ Updated task ${updatedTask.id} from GitHub issue #${fullIssue.number} (assignee: ${assigneeId ? "assigned" : "unassigned"})`);
      return updatedTask;
    } else {
      // Create new task
      const newTask = await prisma.task.create({
        data: {
          title: fullIssue.title,
          description: fullIssue.body || null,
          boardId,
          status: taskStatus,
          statusColumnId: statusColumn.id,
          githubIssueNumber: fullIssue.number,
          assigneeId: assigneeId, // Set assignee based on GitHub issue
          order: 0,
        },
      });
      console.log(`✅ Created task ${newTask.id} from GitHub issue #${fullIssue.number} (assignee: ${assigneeId ? "assigned" : "unassigned"})`);
      return newTask;
    }
  } catch (error) {
    console.error("Failed to sync GitHub issue to task:", error);
    throw error;
  }
}

