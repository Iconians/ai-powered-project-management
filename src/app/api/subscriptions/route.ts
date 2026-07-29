import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getSubscriptionForOrg,
  serializeSubscriptionForClient,
} from "@/lib/data/billing";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 }
      );
    }
    await requireMember(organizationId);

    const subscription = await getSubscriptionForOrg(organizationId);
    return NextResponse.json(
      serializeSubscriptionForClient(subscription)
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch subscription";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, planId } = body;

    if (!organizationId || !planId) {
      return NextResponse.json(
        { error: "organizationId and planId are required" },
        { status: 400 }
      );
    }

    await requireMember(organizationId, "ADMIN");

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (plan.price.toNumber() !== 0) {
      return NextResponse.json(
        {
          error:
            "Paid plans are not available for self-service checkout. Please contact us to upgrade.",
        },
        { status: 400 }
      );
    }

    const subscription = await prisma.subscription.upsert({
      where: { organizationId },
      update: {
        planId: plan.id,
        status: "ACTIVE",
      },
      create: {
        organizationId,
        planId: plan.id,
        status: "ACTIVE",
      },
      include: { plan: true },
    });

    return NextResponse.json({
      subscription,
      message: "Free plan activated",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create subscription";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
