import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { sendWelcomeEmail, sendSubscriptionRequiredEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Verify the user exists in the database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: "User not found in database. Please sign in again." },
        { status: 404 }
      );
    }

    const slug = slugify(name);
    const existingOrg = await prisma.organization.findUnique({
      where: { slug },
    });

    if (existingOrg) {
      return NextResponse.json(
        { error: "Organization with this name already exists" },
        { status: 409 }
      );
    }

    // Get the free plan for new organizations
    const freePlan = await prisma.plan.findFirst({
      where: { name: "Free" },
    });

    if (!freePlan) {
      return NextResponse.json(
        { error: "Free plan not found. Please run database seed." },
        { status: 500 }
      );
    }

    const organization = await prisma.organization.create({
      data: {
        name,
        slug,
        members: {
          create: {
            userId: user.id,
            role: "ADMIN",
          },
        },
        subscriptions: {
          create: {
            planId: freePlan.id,
            status: "ACTIVE",
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Send welcome email and subscription required email
    try {
      const adminMember = organization.members.find((m) => m.role === "ADMIN");
      if (adminMember && adminMember.user) {
        await sendWelcomeEmail(adminMember.user, organization);
        await sendSubscriptionRequiredEmail(adminMember.user, organization);
      }
    } catch (emailError) {
      console.error("Failed to send welcome emails:", emailError);
      // Don't fail organization creation if email fails
    }

    return NextResponse.json(organization, { status: 201 });
  } catch (error) {
    console.error("Error creating organization:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create organization";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const organizations = await prisma.organization.findMany({
      where: {
        members: {
          some: {
            userId: user.id,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Filter members to only show the current user's membership
    const filteredOrganizations = organizations.map((org) => ({
      ...org,
      members: org.members.filter((m) => m.userId === user.id),
    }));

    return NextResponse.json(filteredOrganizations);
  } catch (error) {
    console.error("Error fetching organizations:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch organizations";
    // Return 401 for auth errors, 500 for others
    const status =
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
