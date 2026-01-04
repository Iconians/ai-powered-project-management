import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { triggerPusherEvent } from "@/lib/pusher";
import { sendTaskAssignmentEmail } from "@/lib/email";
import { syncTaskToGitHub } from "@/lib/github-sync";
import { getGitHubClient } from "@/lib/github";
import { TaskStatus } from "@prisma/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await prisma.task.findUnique({
      where: { id },
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
        statusColumn: true,
        board: {
          include: {
            organization: true,
          },
        },
        comments: {
          orderBy: { createdAt: "asc" },
        },
        attachments: true,
        subtasks: {
          include: {
            assignee: {
              select: {
                id: true,
                userId: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Check board access - need at least VIEWER role to see tasks
    await requireBoardAccess(task.boardId, "VIEWER");

    return NextResponse.json(task);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        board: {
          select: {
            id: true,
            githubSyncEnabled: true,
            githubAccessToken: true,
            githubRepoName: true,
            githubProjectId: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Check board access - need MEMBER role to update tasks (including status changes and assignments)
    await requireBoardAccess(task.boardId, "MEMBER");

    // Handle status change - update status column
    let statusColumnId = task.statusColumnId;
    if (body.status && body.status !== task.status) {
      const statusColumn = await prisma.taskStatusColumn.findFirst({
        where: {
          boardId: task.boardId,
          status: body.status as TaskStatus,
        },
      });
      statusColumnId = statusColumn?.id || null;
    }

    // Check if assignee changed
    const assigneeChanged =
      body.assigneeId !== undefined && body.assigneeId !== task.assigneeId;

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        status: body.status,
        priority: body.priority,
        assigneeId: body.assigneeId,
        sprintId: body.sprintId !== undefined ? body.sprintId : undefined,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        estimatedHours: body.estimatedHours,
        actualHours: body.actualHours,
        order: body.order,
        statusColumnId,
        version: {
          increment: 1,
        },
      },
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
        statusColumn: true,
        board: {
          select: {
            id: true,
            name: true,
            githubSyncEnabled: true,
            githubAccessToken: true,
            githubRepoName: true,
            githubProjectId: true,
          },
        },
      },
    });

    // Send email notification if task was assigned
    if (assigneeChanged && updatedTask.assignee && updatedTask.assignee.user) {
      try {
        await sendTaskAssignmentEmail(
          updatedTask.assignee.user,
          { title: updatedTask.title },
          { name: updatedTask.board.name }
        );
      } catch (emailError) {
        console.error("Failed to send task assignment email:", emailError);
        // Don't fail the request if email fails
      }
    }

    // Emit Pusher event for real-time updates
    try {
      await triggerPusherEvent(`board-${task.boardId}`, "task-updated", {
        taskId: updatedTask.id,
        boardId: updatedTask.boardId,
        status: updatedTask.status,
      });
    } catch (pusherError) {
      // Error already logged in triggerPusherEvent
      // Don't fail the request if Pusher fails
    }

    // Sync to GitHub if board has GitHub sync enabled
    // Always try to sync if GitHub is configured, even if githubIssueNumber doesn't exist yet
    // (in case the initial creation failed but we want to retry)
    if (
      updatedTask.board.githubSyncEnabled &&
      updatedTask.board.githubAccessToken &&
      updatedTask.board.githubRepoName
    ) {
      if (updatedTask.githubIssueNumber) {
        // Task already has a GitHub issue, sync the update
        try {
          await syncTaskToGitHub(updatedTask.id);
          console.log(
            `✅ Synced task ${updatedTask.id} to GitHub issue #${updatedTask.githubIssueNumber}`
          );
        } catch (githubError) {
          console.error("❌ Failed to sync task to GitHub:", githubError);
          // Don't fail the request if GitHub sync fails
        }
      } else {
        // Task doesn't have a GitHub issue yet, create one
        try {
          const githubClient = getGitHubClient(
            updatedTask.board.githubAccessToken
          );
          const [owner, repo] = updatedTask.board.githubRepoName.split("/");

          const statusLabel =
            updatedTask.status === "DONE"
              ? "done"
              : updatedTask.status === "IN_PROGRESS"
              ? "in-progress"
              : updatedTask.status === "IN_REVIEW"
              ? "in-review"
              : updatedTask.status === "BLOCKED"
              ? "blocked"
              : "todo";

          const issueResponse = await githubClient.rest.issues.create({
            owner,
            repo,
            title: updatedTask.title,
            body: updatedTask.description || "",
            state: updatedTask.status === "DONE" ? "closed" : "open",
            labels: [statusLabel],
          });

          // Update task with GitHub issue number
          await prisma.task.update({
            where: { id: updatedTask.id },
            data: {
              githubIssueNumber: issueResponse.data.number,
            },
          });

          console.log(
            `✅ Created GitHub issue #${issueResponse.data.number} for task ${updatedTask.id}`
          );
        } catch (githubError) {
          console.error(
            "❌ Failed to create GitHub issue for task:",
            githubError
          );
          // Don't fail the request if GitHub sync fails
        }
      }
    }

    return NextResponse.json(updatedTask);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        board: {
          select: {
            id: true,
            githubSyncEnabled: true,
            githubAccessToken: true,
            githubRepoName: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Check board access - need MEMBER role to delete tasks
    await requireBoardAccess(task.boardId, "MEMBER");

    // Close GitHub issue if it exists and board has GitHub sync enabled
    if (
      task.githubIssueNumber &&
      task.board.githubSyncEnabled &&
      task.board.githubAccessToken &&
      task.board.githubRepoName
    ) {
      try {
        const githubClient = getGitHubClient(task.board.githubAccessToken);
        const [owner, repo] = task.board.githubRepoName.split("/");

        // Close the GitHub issue (GitHub doesn't allow deleting issues)
        await githubClient.rest.issues.update({
          owner,
          repo,
          issue_number: task.githubIssueNumber,
          state: "closed",
        });

        console.log(
          `✅ Closed GitHub issue #${task.githubIssueNumber} for deleted task ${id}`
        );
      } catch (githubError) {
        console.error(
          `❌ Failed to close GitHub issue #${task.githubIssueNumber} for task ${id}:`,
          githubError
        );
        // Don't fail the request if GitHub sync fails
      }
    }

    await prisma.task.delete({
      where: { id },
    });

    // Emit Pusher event for real-time updates
    try {
      await triggerPusherEvent(`board-${task.boardId}`, "task-deleted", {
        taskId: id,
      });
    } catch (pusherError) {
      // Error already logged in triggerPusherEvent
      // Don't fail the request if Pusher fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
