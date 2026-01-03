import { NextRequest, NextResponse } from "next/server";
import { requireMember, requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { triggerPusherEvent } from "@/lib/pusher";
import { getGitHubClient } from "@/lib/github";
import { TaskStatus } from "@prisma/client";
import { requireLimit } from "@/lib/limits";

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

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: {
        id: true,
        githubSyncEnabled: true,
        githubAccessToken: true,
        githubRepoName: true,
      },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    // Check board access - need MEMBER role to create tasks
    await requireBoardAccess(boardId, "MEMBER");

    const taskStatus = status || TaskStatus.TODO;

    // Get the status column for this status
    const statusColumn = await prisma.taskStatusColumn.findFirst({
      where: {
        boardId,
        status: taskStatus,
      },
    });

    // Get max order for tasks in this status
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

    // Sync to GitHub if board has GitHub sync enabled
    if (board.githubSyncEnabled && board.githubAccessToken && board.githubRepoName) {
      try {
        const githubClient = getGitHubClient(board.githubAccessToken);
        const [owner, repo] = board.githubRepoName.split("/");
        
        // Map status to label
        const statusLabel = task.status === "DONE" ? "done" : 
                           task.status === "IN_PROGRESS" ? "in-progress" :
                           task.status === "IN_REVIEW" ? "in-review" :
                           task.status === "BLOCKED" ? "blocked" : "todo";
        
        const issueResponse = await githubClient.rest.issues.create({
          owner,
          repo,
          title: task.title,
          body: task.description || "",
          state: task.status === "DONE" ? "closed" : "open",
          labels: [statusLabel], // Add status label when creating
        });

        // Update task with GitHub issue number
        await prisma.task.update({
          where: { id: task.id },
          data: {
            githubIssueNumber: issueResponse.data.number,
          },
        });
        
        console.log(`✅ Created GitHub issue #${issueResponse.data.number} for task ${task.id}`);
      } catch (githubError) {
        console.error("❌ Failed to create GitHub issue for task:", githubError);
        // Log more details for debugging
        if (githubError instanceof Error) {
          console.error("Error details:", {
            message: githubError.message,
            stack: githubError.stack,
            boardId: board.id,
            repoName: board.githubRepoName,
          });
        }
        // Don't fail the request if GitHub sync fails
      }
    }

    // Emit Pusher event for real-time updates
    try {
      await triggerPusherEvent(`board-${boardId}`, "task-created", {
        taskId: task.id,
        boardId: task.boardId,
        status: task.status,
      });
    } catch (pusherError) {
      // Error already logged in triggerPusherEvent
      // Don't fail the request if Pusher fails
    }

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create task";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
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

    // Check board access - need at least VIEWER role to see tasks
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
    const message = error instanceof Error ? error.message : "Failed to fetch tasks";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

