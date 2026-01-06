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

    
    await requireBoardAccess(task.boardId, "MEMBER");

    
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

    
    if (assigneeChanged && updatedTask.assignee && updatedTask.assignee.user) {
      try {
        await sendTaskAssignmentEmail(
          updatedTask.assignee.user,
          { title: updatedTask.title },
          { name: updatedTask.board.name }
        );
      } catch (emailError) {
        console.error("Failed to send task assignment email:", emailError);
        
      }
    }

    
    try {
      await triggerPusherEvent(`board-${task.boardId}`, "task-updated", {
        taskId: updatedTask.id,
        boardId: updatedTask.boardId,
        status: updatedTask.status,
      });
    } catch (pusherError) {
      
      
    }

    
    
    
    if (
      updatedTask.board.githubSyncEnabled &&
      updatedTask.board.githubAccessToken &&
      updatedTask.board.githubRepoName
    ) {
      if (updatedTask.githubIssueNumber) {
        
        try {
          await syncTaskToGitHub(updatedTask.id);
          console.log(
            `✅ Synced task ${updatedTask.id} to GitHub issue #${updatedTask.githubIssueNumber}`
          );
        } catch (githubError) {
          console.error("❌ Failed to sync task to GitHub:", githubError);
          
        }
      } else {
        
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

    
    await requireBoardAccess(task.boardId, "MEMBER");

    
    if (
      task.githubIssueNumber &&
      task.board.githubSyncEnabled &&
      task.board.githubAccessToken &&
      task.board.githubRepoName
    ) {
      try {
        const githubClient = getGitHubClient(task.board.githubAccessToken);
        const [owner, repo] = task.board.githubRepoName.split("/");

        
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
        
      }
    }

    await prisma.task.delete({
      where: { id },
    });

    
    try {
      await triggerPusherEvent(`board-${task.boardId}`, "task-deleted", {
        taskId: id,
      });
    } catch (pusherError) {
      
      
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
