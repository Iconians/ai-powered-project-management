import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getGitHubClient,
  syncBoardToGitHub,
  syncGitHubToBoard,
} from "@/lib/github";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { boardId, direction = "both" } = body;

    if (!boardId) {
      return NextResponse.json(
        { error: "boardId is required" },
        { status: 400 }
      );
    }

    await requireBoardAccess(boardId, "ADMIN");

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        tasks: {
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
          },
        },
      },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    if (
      !board.githubAccessToken ||
      !board.githubRepoName ||
      !board.githubProjectId
    ) {
      return NextResponse.json(
        { error: "GitHub not connected for this board" },
        { status: 400 }
      );
    }

    const githubClient = getGitHubClient(board.githubAccessToken);

    if (direction === "to-github" || direction === "both") {
      
      await syncBoardToGitHub(
        board,
        board.tasks,
        githubClient,
        board.githubRepoName,
        board.githubProjectId
      );
    }

    if (direction === "from-github" || direction === "both") {
      
      await syncGitHubToBoard(githubClient, board.githubRepoName, boardId);
      
      
    }

    return NextResponse.json({
      message: "Sync completed",
      direction,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to sync with GitHub";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
