import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/boards/[id]/github - Set GitHub repository for a board
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { githubRepoName } = body;

    if (!githubRepoName) {
      return NextResponse.json(
        { error: "githubRepoName is required" },
        { status: 400 }
      );
    }

    // Validate format: owner/repo
    if (!/^[\w\-\.]+\/[\w\-\.]+$/.test(githubRepoName)) {
      return NextResponse.json(
        { error: "Invalid repository format. Use 'owner/repo'" },
        { status: 400 }
      );
    }

    // Check board access - need ADMIN role to configure GitHub
    await requireBoardAccess(id, "ADMIN");

    const board = await prisma.board.update({
      where: { id },
      data: {
        githubRepoName,
      },
    });

    return NextResponse.json(board);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update board GitHub settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

