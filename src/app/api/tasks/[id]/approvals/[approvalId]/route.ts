import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApprovalStatus } from "@prisma/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; approvalId: string }> }
) {
  try {
    const { id, approvalId } = await params;
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

    const approval = await prisma.taskApproval.findUnique({
      where: { id: approvalId },
      include: {
        task: {
          select: { boardId: true },
        },
      },
    });

    if (!approval) {
      return NextResponse.json(
        { error: "Approval not found" },
        { status: 404 }
      );
    }

    if (approval.task.boardId !== task.boardId) {
      return NextResponse.json({ error: "Invalid approval" }, { status: 400 });
    }

    const body = await request.json();
    const { status, comment } = body;

    if (!status || !["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json(
        { error: "status must be APPROVED or REJECTED" },
        { status: 400 }
      );
    }

    // Verify user is a member of the board (can approve)
    const boardMember = await prisma.boardMember.findFirst({
      where: {
        boardId: task.boardId,
        member: {
          userId: user.id,
        },
      },
    });

    if (!boardMember) {
      return NextResponse.json(
        { error: "You must be a member of the board to approve" },
        { status: 403 }
      );
    }

    const updated = await prisma.taskApproval.update({
      where: { id: approvalId },
      data: {
        status: status as ApprovalStatus,
        approvedBy: user.id,
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
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update approval";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; approvalId: string }> }
) {
  try {
    const { id, approvalId } = await params;
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

    const approval = await prisma.taskApproval.findUnique({
      where: { id: approvalId },
    });

    if (!approval) {
      return NextResponse.json(
        { error: "Approval not found" },
        { status: 404 }
      );
    }

    // Only requester or admin can delete
    if (approval.requestedBy !== user.id) {
      await requireBoardAccess(task.boardId, "ADMIN");
    }

    await prisma.taskApproval.delete({
      where: { id: approvalId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete approval";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
