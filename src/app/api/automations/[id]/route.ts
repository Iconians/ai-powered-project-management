import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AutomationTrigger, AutomationAction } from "@prisma/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const automation = await prisma.automationRule.findUnique({
      where: { id },
    });

    if (!automation) {
      return NextResponse.json(
        { error: "Automation not found" },
        { status: 404 }
      );
    }

    await requireMember(automation.organizationId, "VIEWER");

    return NextResponse.json(automation);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch automation";
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

    const automation = await prisma.automationRule.findUnique({
      where: { id },
    });

    if (!automation) {
      return NextResponse.json(
        { error: "Automation not found" },
        { status: 404 }
      );
    }

    await requireMember(automation.organizationId, "ADMIN");

    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.trigger !== undefined) {
      const validTriggers = Object.values(AutomationTrigger);
      if (!validTriggers.includes(body.trigger)) {
        return NextResponse.json(
          { error: `trigger must be one of: ${validTriggers.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.trigger = body.trigger;
    }
    if (body.conditions !== undefined) updateData.conditions = body.conditions;
    if (body.action !== undefined) {
      const validActions = Object.values(AutomationAction);
      if (!validActions.includes(body.action)) {
        return NextResponse.json(
          { error: `action must be one of: ${validActions.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.action = body.action;
    }
    if (body.actionParams !== undefined) updateData.actionParams = body.actionParams;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const updated = await prisma.automationRule.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update automation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const automation = await prisma.automationRule.findUnique({
      where: { id },
    });

    if (!automation) {
      return NextResponse.json(
        { error: "Automation not found" },
        { status: 404 }
      );
    }

    await requireMember(automation.organizationId, "ADMIN");

    await prisma.automationRule.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete automation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

