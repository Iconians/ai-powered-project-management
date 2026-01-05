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

    // Find invitation
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

    // Check if invitation is already accepted
    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: "This invitation has already been accepted" },
        { status: 400 }
      );
    }

    // Check if invitation is expired
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This invitation has expired" },
        { status: 400 }
      );
    }

    // Check if invitation is for organization
    if (invitation.type !== "ORGANIZATION" || !invitation.organizationId) {
      return NextResponse.json(
        { error: "Invalid invitation type" },
        { status: 400 }
      );
    }

    // Check if user is logged in
    const user = await getCurrentUser();
    if (!user) {
      // Redirect to login with invitation token
      const loginUrl = `/login?invite=${encodeURIComponent(token)}&type=organization`;
      return NextResponse.redirect(new URL(loginUrl, request.url));
    }

    // Check if email matches
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        {
          error: `This invitation was sent to ${invitation.email}. Please log in with that email address.`,
        },
        { status: 403 }
      );
    }

    // Check if user is already a member
    const existingMember = await prisma.member.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: invitation.organizationId,
        },
      },
    });

    if (existingMember) {
      // Mark invitation as accepted even though user is already a member
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      return NextResponse.redirect(
        new URL(`/organizations?joined=${invitation.organizationId}`, request.url)
      );
    }

    // Create member
    await prisma.member.create({
      data: {
        userId: user.id,
        organizationId: invitation.organizationId,
        role: invitation.role,
      },
    });

    // Mark invitation as accepted
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

