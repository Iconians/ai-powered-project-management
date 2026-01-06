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

    
    if (name.length > 100) {
      return NextResponse.json(
        { error: "Organization name must be less than 100 characters" },
        { status: 400 }
      );
    }

    
    if (/[<>\"'&]/.test(name)) {
      return NextResponse.json(
        { error: "Organization name contains invalid characters" },
        { status: 400 }
      );
    }

    
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

    
    
    const userOrganizations = await prisma.member.findMany({
      where: {
        userId: user.id,
        role: "ADMIN", 
      },
      include: {
        organization: {
          include: {
            subscriptions: {
              where: {
                status: "ACTIVE",
              },
              include: {
                plan: true,
              },
            },
          },
        },
      },
    });

    
    const hasFreePlanOrg = userOrganizations.some((member) => {
      const activeSubscription = member.organization.subscriptions.find(
        (sub) => sub.status === "ACTIVE"
      );
      return activeSubscription && activeSubscription.plan.price.toNumber() === 0;
    });

    if (hasFreePlanOrg) {
      return NextResponse.json(
        {
          error:
            "Free plan allows only 1 organization. Please upgrade to Pro or Enterprise to create additional organizations.",
        },
        { status: 403 }
      );
    }

    
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

    
    try {
      const adminMember = organization.members.find((m) => m.role === "ADMIN");
      if (adminMember && adminMember.user) {
        await sendWelcomeEmail(adminMember.user, organization);
        await sendSubscriptionRequiredEmail(adminMember.user, organization);
      }
    } catch (emailError) {
      console.error("Failed to send welcome emails:", emailError);
      
    }

    return NextResponse.json(organization, { status: 201 });
  } catch (error) {
    console.error("Error creating organization:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create organization";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(_request: NextRequest) {
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

    
    const filteredOrganizations = organizations.map((org) => ({
      ...org,
      members: org.members.filter((m) => m.userId === user.id),
    }));

    return NextResponse.json(filteredOrganizations);
  } catch (error) {
    console.error("Error fetching organizations:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch organizations";
    
    const status =
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
