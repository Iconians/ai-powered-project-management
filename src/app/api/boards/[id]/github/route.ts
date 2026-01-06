import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";


export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { githubRepoName, githubProjectId } = body;

    
    if (!githubRepoName && githubProjectId === undefined) {
      return NextResponse.json(
        { error: "Either githubRepoName or githubProjectId is required" },
        { status: 400 }
      );
    }

    
    if (githubRepoName && !/^[\w\-\.]+\/[\w\-\.]+$/.test(githubRepoName)) {
      return NextResponse.json(
        { error: "Invalid repository format. Use 'owner/repo'" },
        { status: 400 }
      );
    }

    
    if (
      githubProjectId !== undefined &&
      (typeof githubProjectId !== "number" || githubProjectId <= 0)
    ) {
      return NextResponse.json(
        { error: "githubProjectId must be a positive number" },
        { status: 400 }
      );
    }

    
    await requireBoardAccess(id, "ADMIN");

    const updateData: {
      githubRepoName?: string;
      githubProjectId?: number;
    } = {};
    if (githubRepoName !== undefined) {
      updateData.githubRepoName = githubRepoName;
    }
    if (githubProjectId !== undefined) {
      updateData.githubProjectId = githubProjectId;
    }

    const board = await prisma.board.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(board);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update board GitHub settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
