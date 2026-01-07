import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AutomationTrigger, AutomationAction } from "@prisma/client";

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

    await requireMember(organizationId, "VIEWER");

    const automations = await prisma.automationRule.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(automations);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch automations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      organizationId,
      trigger,
      conditions,
      action,
      actionParams,
      isActive = true,
    } = body;

    if (!name || !organizationId || !trigger || !action) {
      return NextResponse.json(
        { error: "name, organizationId, trigger, and action are required" },
        { status: 400 }
      );
    }

    await requireMember(organizationId, "ADMIN");

    const validTriggers = Object.values(AutomationTrigger);
    if (!validTriggers.includes(trigger)) {
      return NextResponse.json(
        { error: `trigger must be one of: ${validTriggers.join(", ")}` },
        { status: 400 }
      );
    }

    const validActions = Object.values(AutomationAction);
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `action must be one of: ${validActions.join(", ")}` },
        { status: 400 }
      );
    }

    const automation = await prisma.automationRule.create({
      data: {
        name,
        description: description || null,
        organizationId,
        trigger,
        conditions: conditions || null,
        action,
        actionParams: actionParams || null,
        isActive,
      },
    });

    return NextResponse.json(automation);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create automation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

