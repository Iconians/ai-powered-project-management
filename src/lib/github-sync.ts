import { prisma } from "@/lib/prisma";
import { getGitHubClient } from "@/lib/github";
import { TaskStatus } from "@prisma/client";


interface GitHubIssueLabel {
  name: string;
  id?: number;
  color?: string;
  description?: string | null;
}

interface GitHubIssueAssignee {
  login: string;
  id?: number;
}

interface GitHubIssue {
  number: number;
  title: string;
  body?: string | null;
  state: "open" | "closed" | string; 
  assignee?: GitHubIssueAssignee | null;
  assignees?: GitHubIssueAssignee[] | null; 
  
  labels?:
    | (string | GitHubIssueLabel | { name?: string; [key: string]: unknown })[]
    | null;
}

interface GitHubRepository {
  owner: {
    login: string;
  };
  name: string;
}


function mapStatusToGitHubState(status: TaskStatus): "open" | "closed" {
  return status === "DONE" ? "closed" : "open";
}


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

    if (
      !task ||
      !task.githubIssueNumber ||
      !task.board.githubSyncEnabled ||
      !task.board.githubAccessToken ||
      !task.board.githubRepoName
    ) {
      return; 
    }

    const githubClient = getGitHubClient(task.board.githubAccessToken);
    const [owner, repo] = task.board.githubRepoName.split("/");

    
    const updateData = {
      owner,
      repo,
      issue_number: task.githubIssueNumber,
      title: task.title,
      body: task.description || "",
      state: mapStatusToGitHubState(task.status),
    };

    console.log(
      `🔄 Syncing task ${task.id} to GitHub issue #${task.githubIssueNumber}`,
      {
        title: task.title,
        status: task.status,
        hasDescription: !!task.description,
      }
    );

    
    if (task.assignee?.user?.githubUsername) {
      try {
        
        const { data: issue } = await githubClient.rest.issues.get({
          owner,
          repo,
          issue_number: task.githubIssueNumber,
        });

        const currentAssignees = issue.assignees?.map((a) => a.login) || [];
        const shouldAssign = !currentAssignees.includes(
          task.assignee.user.githubUsername
        );

        if (shouldAssign) {
          
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
          console.log(
            `✅ Assigned GitHub user ${task.assignee.user.githubUsername} to issue #${task.githubIssueNumber}`
          );
        }
      } catch (error) {
        console.error("Failed to assign GitHub user:", error);
        
      }
    } else if (task.assignee) {
      
      console.warn(
        `⚠️ Task ${task.id} has assignee ${task.assignee.user.email} but no GitHub username`
      );
    } else {
      
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
          console.log(
            `✅ Removed assignees from issue #${task.githubIssueNumber}`
          );
        }
      } catch (error) {
        console.error("Failed to remove GitHub assignees:", error);
      }
    }

    
    if (task.statusColumn) {
      const statusLabel = mapStatusToLabel(task.status);
      const { data: labels } = await githubClient.rest.issues.listLabelsOnIssue(
        {
          owner,
          repo,
          issue_number: task.githubIssueNumber,
        }
      );

      
      const statusLabels = [
        "todo",
        "in-progress",
        "in-review",
        "done",
        "blocked",
      ];
      const labelsToRemove = labels
        .filter((l) => statusLabels.includes(l.name.toLowerCase()))
        .map((l) => l.name);

      
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
            
          }
        }
      }

      
      try {
        await githubClient.rest.issues.addLabels({
          owner,
          repo,
          issue_number: task.githubIssueNumber,
          labels: [statusLabel],
        });
      } catch (error) {
        
        try {
          await githubClient.rest.issues.createLabel({
            owner,
            repo,
            name: statusLabel,
            color: "0e8a16", 
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

    
    if (task.board.githubProjectId) {
      try {
        const { syncTaskToGitHubProject } = await import(
          "@/lib/github-project-sync"
        );
        await syncTaskToGitHubProject(
          githubClient,
          task.githubIssueNumber,
          task.board.githubProjectId,
          task.status,
          task.board.githubRepoName
        );
      } catch (projectError) {
        console.error("Failed to sync to GitHub Project:", projectError);
        
      }
    }
  } catch (error) {
    console.error("Failed to sync task to GitHub:", error);
    
  }
}


export async function syncGitHubIssueToTask(
  issue: GitHubIssue,
  repository: GitHubRepository,
  boardId: string
): Promise<
  ReturnType<typeof prisma.task.create> extends Promise<infer T> ? T : never
> {
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

    
    
    const githubClient = getGitHubClient(board.githubAccessToken);
    const [owner, repo] = board.githubRepoName?.split("/") || [
      repository.owner.login,
      repository.name,
    ];

    let fullIssue = issue;
    try {
      const { data: fetchedIssue } = await githubClient.rest.issues.get({
        owner,
        repo,
        issue_number: issue.number,
      });
      fullIssue = fetchedIssue;
    } catch (error) {
      console.warn(
        "Failed to fetch full issue from GitHub, using webhook payload:",
        error
      );
      
    }

    
    
    let taskStatus: TaskStatus = fullIssue.state === "closed" ? "DONE" : "TODO";

    
    if (fullIssue.labels && Array.isArray(fullIssue.labels)) {
      const labelNames = fullIssue.labels
        .map((l) => {
          if (typeof l === "string") {
            return l.toLowerCase();
          }
          if (l && typeof l === "object" && "name" in l && l.name) {
            return l.name.toLowerCase();
          }
          return "";
        })
        .filter((name) => name !== "");
      if (labelNames.includes("in-progress")) taskStatus = "IN_PROGRESS";
      else if (labelNames.includes("in-review")) taskStatus = "IN_REVIEW";
      else if (labelNames.includes("blocked")) taskStatus = "BLOCKED";
      else if (labelNames.includes("done")) taskStatus = "DONE";
      else if (labelNames.includes("todo")) taskStatus = "TODO";
    }

    
    const statusColumn =
      board.statuses.find((s) => s.status === taskStatus) || board.statuses[0];

    
    const existingTask = await prisma.task.findFirst({
      where: {
        boardId,
        githubIssueNumber: fullIssue.number,
      },
    });

    
    let assigneeId: string | null = null;
    if (fullIssue.assignee?.login) {
      
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
    

    if (existingTask) {
      
      const updatedTask = await prisma.task.update({
        where: { id: existingTask.id },
        data: {
          title: fullIssue.title,
          description: fullIssue.body ?? null,
          status: taskStatus,
          statusColumnId: statusColumn.id,
          assigneeId: assigneeId, 
        },
      });
      console.log(
        `✅ Updated task ${updatedTask.id} from GitHub issue #${
          fullIssue.number
        } (assignee: ${assigneeId ? "assigned" : "unassigned"})`
      );
      return updatedTask;
    } else {
      
      const newTask = await prisma.task.create({
        data: {
          title: fullIssue.title,
          description: fullIssue.body ?? null,
          boardId,
          status: taskStatus,
          statusColumnId: statusColumn.id,
          githubIssueNumber: fullIssue.number,
          assigneeId: assigneeId, 
          order: 0,
        },
      });
      console.log(
        `✅ Created task ${newTask.id} from GitHub issue #${
          fullIssue.number
        } (assignee: ${assigneeId ? "assigned" : "unassigned"})`
      );
      return newTask;
    }
  } catch (error) {
    console.error("Failed to sync GitHub issue to task:", error);
    throw error;
  }
}
