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

    // Update assignee if task has one
    // Note: Assignee syncing requires matching GitHub usernames to app users
    // For now, we'll skip assignee syncing as it requires additional user mapping
    // In production, you'd want to store GitHub usernames in the User model

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
      },
    });

    if (!board) {
      throw new Error("Board not found");
    }

    // Map GitHub issue state to task status
    // Try to map based on labels first, then fall back to state
    let taskStatus: TaskStatus = issue.state === "closed" ? "DONE" : "TODO";
    
    // Check if issue has status labels
    if (issue.labels && Array.isArray(issue.labels)) {
      const labelNames = issue.labels.map((l: any) => l.name.toLowerCase());
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
        githubIssueNumber: issue.number,
      },
    });

    if (existingTask) {
      // Update existing task
      const updatedTask = await prisma.task.update({
        where: { id: existingTask.id },
        data: {
          title: issue.title,
          description: issue.body || null,
          status: taskStatus,
          statusColumnId: statusColumn.id,
          // Note: We don't update assignee here as it requires matching GitHub users to app users
        },
      });
      return updatedTask;
    } else {
      // Create new task
      const newTask = await prisma.task.create({
        data: {
          title: issue.title,
          description: issue.body || null,
          boardId,
          status: taskStatus,
          statusColumnId: statusColumn.id,
          githubIssueNumber: issue.number,
          order: 0,
        },
      });
      return newTask;
    }
  } catch (error) {
    console.error("Failed to sync GitHub issue to task:", error);
    throw error;
  }
}

