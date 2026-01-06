import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cancelSubscription } from "@/lib/stripe";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireMember(id); 

    const organization = await prisma.organization.findUnique({
      where: { id },
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
        _count: {
          select: {
            members: true,
            boards: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(organization);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch organization";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    
    await requireMember(id, "ADMIN");

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

    const updatedOrganization = await prisma.organization.update({
      where: { id },
      data: { name },
    });

    return NextResponse.json(updatedOrganization);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update organization";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    
    await requireMember(id, "ADMIN");

    
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        members: {
          where: { role: "ADMIN" },
        },
        subscriptions: {
          where: {
            stripeSubscriptionId: { not: null },
            status: {
              in: ["ACTIVE", "TRIALING", "PAST_DUE"],
            },
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    if (organization.subscriptions.length > 0) {
      for (const subscription of organization.subscriptions) {
        if (subscription.stripeSubscriptionId) {
          try {
            await cancelSubscription(subscription.stripeSubscriptionId);
            console.log(
              `Cancelled Stripe subscription ${subscription.stripeSubscriptionId} for organization ${id}`
            );
          } catch (stripeError) {
            console.error(
              `Failed to cancel Stripe subscription ${subscription.stripeSubscriptionId}:`,
              stripeError
            );
          }
        }
      }
    }

    await prisma.organization.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete organization";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
