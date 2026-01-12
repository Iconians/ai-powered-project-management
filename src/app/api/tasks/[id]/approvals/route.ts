import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApprovalStatus } from "@prisma/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await prisma.task.findUnique({
      where: { id },
      select: { boardId: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await requireBoardAccess(task.boardId, "VIEWER");

    const approvals = await prisma.taskApproval.findMany({
      where: { taskId: id },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(approvals);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch approvals";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id },
      select: { boardId: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await requireBoardAccess(task.boardId, "MEMBER");

    const body = await request.json();
    const { approverId, comment } = body;

    if (!approverId) {
      return NextResponse.json(
        { error: "approverId is required" },
        { status: 400 }
      );
    }

    // Verify approver is a member of the board
    const approver = await prisma.boardMember.findFirst({
      where: {
        boardId: task.boardId,
        member: {
          userId: approverId,
        },
      },
    });

    if (!approver) {
      return NextResponse.json(
        { error: "Approver must be a member of the board" },
        { status: 400 }
      );
    }

    const approval = await prisma.taskApproval.create({
      data: {
        taskId: id,
        requestedBy: user.id,
        status: ApprovalStatus.PENDING,
        comment: comment || null,
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(approval);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create approval request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
