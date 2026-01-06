import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireLimit } from "@/lib/limits";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { email, role = "MEMBER" } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    
    await requireMember(id, "ADMIN");

    
    try {
      await requireLimit(id, "members");
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Member limit reached" },
        { status: 403 }
      );
    }

    
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User with this email does not exist. They need to sign up first." },
        { status: 404 }
      );
    }

    
    const existingMember = await prisma.member.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: id,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "User is already a member of this organization" },
        { status: 409 }
      );
    }

    
    const member = await prisma.member.create({
      data: {
        userId: user.id,
        organizationId: id,
        role: role as "ADMIN" | "MEMBER" | "VIEWER",
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add member";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    
    await requireMember(id);

    const members = await prisma.member.findMany({
      where: {
        organizationId: id,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(members);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch members";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

