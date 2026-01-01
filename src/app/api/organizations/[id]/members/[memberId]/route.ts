import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params;
    
    // Check if user is an ADMIN of the organization
    await requireMember(id, "ADMIN");

    // Get the member to check if they exist
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        organization: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    if (member.organizationId !== id) {
      return NextResponse.json(
        { error: "Member does not belong to this organization" },
        { status: 400 }
      );
    }

    // Prevent removing the last admin
    const adminCount = await prisma.member.count({
      where: {
        organizationId: id,
        role: "ADMIN",
      },
    });

    if (member.role === "ADMIN" && adminCount === 1) {
      return NextResponse.json(
        { error: "Cannot remove the last admin from the organization" },
        { status: 400 }
      );
    }

    await prisma.member.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove member";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

