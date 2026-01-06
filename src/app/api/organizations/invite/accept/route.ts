import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: true,
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invalid or expired invitation token" },
        { status: 404 }
      );
    }

    
    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: "This invitation has already been accepted" },
        { status: 400 }
      );
    }

    
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This invitation has expired" },
        { status: 400 }
      );
    }

    
    if (invitation.type !== "ORGANIZATION" || !invitation.organizationId) {
      return NextResponse.json(
        { error: "Invalid invitation type" },
        { status: 400 }
      );
    }

    
    const user = await getCurrentUser();
    if (!user) {
      
      const loginUrl = `/login?invite=${encodeURIComponent(token)}&type=organization`;
      return NextResponse.redirect(new URL(loginUrl, request.url));
    }

    
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        {
          error: `This invitation was sent to ${invitation.email}. Please log in with that email address.`,
        },
        { status: 403 }
      );
    }

    
    const existingMember = await prisma.member.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: invitation.organizationId,
        },
      },
    });

    if (existingMember) {
      
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      return NextResponse.redirect(
        new URL(`/organizations?joined=${invitation.organizationId}`, request.url)
      );
    }

    
    await prisma.member.create({
      data: {
        userId: user.id,
        organizationId: invitation.organizationId,
        role: invitation.role,
      },
    });

    
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    return NextResponse.redirect(
      new URL(`/organizations?joined=${invitation.organizationId}`, request.url)
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to accept invitation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

