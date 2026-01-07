import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { triggerPusherEvent } from "@/lib/pusher";
import { getGitHubClient } from "@/lib/github";
import { TaskStatus } from "@prisma/client";
import { executeAutomations } from "@/lib/automation-engine";
import { logActivity } from "@/lib/activity-logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      boardId,
      sprintId,
      status,
      priority,
      assigneeId,
      dueDate,
      estimatedHours,
    } = body;

    if (!title || !boardId) {
      return NextResponse.json(
        { error: "Title and boardId are required" },
        { status: 400 }
      );
    }

    
    if (title.length > 500) {
      return NextResponse.json(
        { error: "Title must be less than 500 characters" },
        { status: 400 }
      );
    }

    if (description && description.length > 10000) {
      return NextResponse.json(
        { error: "Description must be less than 10000 characters" },
        { status: 400 }
      );
    }

    
    const validPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: "Invalid priority value" },
        { status: 400 }
      );
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: {
        id: true,
        organizationId: true,
        githubSyncEnabled: true,
        githubAccessToken: true,
        githubRepoName: true,
        githubProjectId: true,
      },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    
    await requireBoardAccess(boardId, "MEMBER");

    const taskStatus = status || TaskStatus.TODO;

    
    const statusColumn = await prisma.taskStatusColumn.findFirst({
      where: {
        boardId,
        status: taskStatus,
      },
    });

    
    const maxOrderTask = await prisma.task.findFirst({
      where: {
        boardId,
        status: taskStatus,
      },
      orderBy: { order: "desc" },
    });

    const task = await prisma.task.create({
      data: {
        title,
        description,
        boardId,
        sprintId: sprintId || null,
        status: taskStatus,
        priority: priority || "MEDIUM",
        assigneeId: assigneeId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        estimatedHours: estimatedHours || null,
        statusColumnId: statusColumn?.id || null,
        order: maxOrderTask ? maxOrderTask.order + 1 : 0,
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
            githubSyncEnabled: true,
            githubAccessToken: true,
            githubRepoName: true,
          },
        },
      },
    });

    
    if (
      board.githubSyncEnabled &&
      board.githubAccessToken &&
      board.githubRepoName
    ) {
      try {
        const githubClient = getGitHubClient(board.githubAccessToken);
        const [owner, repo] = board.githubRepoName.split("/");

        
        const statusLabel =
          task.status === "DONE"
            ? "done"
            : task.status === "IN_PROGRESS"
            ? "in-progress"
            : task.status === "IN_REVIEW"
            ? "in-review"
            : task.status === "BLOCKED"
            ? "blocked"
            : "todo";

        const issueResponse = await githubClient.rest.issues.create({
          owner,
          repo,
          title: task.title,
          body: task.description || "",
          state: task.status === "DONE" ? "closed" : "open",
          labels: [statusLabel], 
        });

        
        await prisma.task.update({
          where: { id: task.id },
          data: {
            githubIssueNumber: issueResponse.data.number,
          },
        });

        console.log(
          `✅ Created GitHub issue #${issueResponse.data.number} for task ${task.id}`
        );

        
        
        
        if (board.githubProjectId) {
          try {
            const { syncTaskToGitHubProject } = await import(
              "@/lib/github-project-sync"
            );
            await syncTaskToGitHubProject(
              githubClient,
              issueResponse.data.number,
              board.githubProjectId,
              task.status,
              board.githubRepoName
            );
            console.log(
              `✅ Added issue #${issueResponse.data.number} to GitHub Project ${board.githubProjectId}`
            );
          } catch (projectError) {
            console.error("❌ Failed to sync to GitHub Project:", projectError);
            
          }
        }
      } catch (githubError) {
        console.error(
          "❌ Failed to create GitHub issue for task:",
          githubError
        );
        
        if (githubError instanceof Error) {
          console.error("Error details:", {
            message: githubError.message,
            stack: githubError.stack,
            boardId: board.id,
            repoName: board.githubRepoName,
          });
        }
        
      }
    }

    // Trigger automation rules
    try {
      await executeAutomations("TASK_CREATED", {
        taskId: task.id,
        boardId: task.boardId,
        organizationId: board.organizationId,
        newStatus: task.status,
        assigneeId: task.assigneeId || undefined,
      });
    } catch (automationError) {
      console.error("Failed to execute automations:", automationError);
    }

    // Log activity
    try {
      const user = await getCurrentUser();
      if (user) {
        await logActivity("TASK_CREATED", user.id, {
          organizationId: board.organizationId,
          boardId: task.boardId,
          taskId: task.id,
          metadata: {
            title: task.title,
            status: task.status,
            priority: task.priority,
          },
        });
      }
    } catch (activityError) {
      console.error("Failed to log activity:", activityError);
    }

    try {
      await triggerPusherEvent(`board-${boardId}`, "task-created", {
        taskId: task.id,
        boardId: task.boardId,
        status: task.status,
      });
    } catch (pusherError) {
      console.error("Failed to trigger Pusher event:", pusherError);
    }

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get("boardId");
    const sprintId = searchParams.get("sprintId");
    const status = searchParams.get("status");

    if (!boardId) {
      return NextResponse.json(
        { error: "boardId is required" },
        { status: 400 }
      );
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    
    await requireBoardAccess(boardId, "VIEWER");

    const tasks = await prisma.task.findMany({
      where: {
        boardId,
        ...(sprintId ? { sprintId } : {}),
        ...(status ? { status: status as TaskStatus } : {}),
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
      },
      orderBy: { order: "asc" },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch tasks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
