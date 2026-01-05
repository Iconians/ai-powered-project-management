import { NextRequest, NextResponse } from "next/server";
import { requireMember, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateToken, sendOrganizationInvitationEmail } from "@/lib/email";
import { requireLimit } from "@/lib/limits";
import { rateLimiters } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { email, role = "MEMBER" } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Rate limiting
    const rateLimitResponse = await rateLimiters.api(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Check if user is an ADMIN of the organization
    await requireMember(id, "ADMIN");

    // Check member limit
    try {
      await requireLimit(id, "members");
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Member limit reached",
        },
        { status: 403 }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get organization details
    const organization = await prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // User exists - check if they're already a member
      const existingMember = await prisma.member.findUnique({
        where: {
          userId_organizationId: {
            userId: existingUser.id,
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

      // User exists but not a member - add them directly
      const member = await prisma.member.create({
        data: {
          userId: existingUser.id,
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
    }

    // User doesn't exist - create invitation
    // Check for existing pending invitation
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email,
        organizationId: id,
        type: "ORGANIZATION",
        acceptedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: "An invitation has already been sent to this email" },
        { status: 409 }
      );
    }

    // Create invitation
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const invitation = await prisma.invitation.create({
      data: {
        type: "ORGANIZATION",
        email,
        token,
        organizationId: id,
        role: role as "ADMIN" | "MEMBER" | "VIEWER",
        invitedBy: user.id,
        expiresAt,
      },
    });

    // Send invitation email
    try {
      const inviter = await prisma.user.findUnique({
        where: { id: user.id },
        select: { name: true },
      });

      await sendOrganizationInvitationEmail(
        inviter || { name: null },
        organization,
        email,
        token
      );
    } catch (emailError) {
      console.error("Failed to send invitation email:", emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json(
      {
        message: "Invitation sent successfully",
        invitation: {
          id: invitation.id,
          email: invitation.email,
          expiresAt: invitation.expiresAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send invitation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
