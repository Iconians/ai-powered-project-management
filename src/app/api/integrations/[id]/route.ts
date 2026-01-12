import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { IntegrationProvider } from "@prisma/client";
import { validateSlackConfig, sendSlackNotification } from "@/lib/integrations/slack";
import { validateJiraConfig, createJiraIssue } from "@/lib/integrations/jira";
import { validateLinearConfig, createLinearIssue } from "@/lib/integrations/linear";
import { validateZapierConfig, sendZapierWebhook } from "@/lib/integrations/zapier";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { config, isActive, action, payload } = body;

    const integration = await prisma.integration.findUnique({
      where: { id },
    });

    if (!integration) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    await requireMember(integration.organizationId, "ADMIN");

    // Handle test/action requests
    if (action) {
      const integrationConfig = (config || integration.config) as any;

      if (!integrationConfig || Object.keys(integrationConfig).length === 0) {
        return NextResponse.json(
          { error: "Integration not configured. Please configure the integration first." },
          { status: 400 }
        );
      }

      try {
        switch (integration.provider) {
          case IntegrationProvider.SLACK:
            if (action === "test") {
              const isValid = await validateSlackConfig(integrationConfig);
              if (!isValid) {
                return NextResponse.json(
                  { error: "Invalid Slack configuration" },
                  { status: 400 }
                );
              }
              const success = await sendSlackNotification(integrationConfig, {
                text: "Test notification from Project Management",
                title: "Integration Test",
              });
              return NextResponse.json({ success });
            }
            if (action === "send") {
              const success = await sendSlackNotification(integrationConfig, payload);
              return NextResponse.json({ success });
            }
            break;

          case IntegrationProvider.JIRA:
            if (action === "test") {
              const isValid = await validateJiraConfig(integrationConfig);
              if (!isValid) {
                return NextResponse.json(
                  { error: "Invalid Jira configuration" },
                  { status: 400 }
                );
              }
              return NextResponse.json({ success: true });
            }
            if (action === "create_issue") {
              const result = await createJiraIssue(integrationConfig, payload);
              if (!result) {
                return NextResponse.json(
                  { error: "Failed to create Jira issue" },
                  { status: 500 }
                );
              }
              return NextResponse.json(result);
            }
            break;

          case IntegrationProvider.LINEAR:
            if (action === "test") {
              const isValid = await validateLinearConfig(integrationConfig);
              if (!isValid) {
                return NextResponse.json(
                  { error: "Invalid Linear configuration" },
                  { status: 400 }
                );
              }
              return NextResponse.json({ success: true });
            }
            if (action === "create_issue") {
              const result = await createLinearIssue(integrationConfig, payload);
              if (!result) {
                return NextResponse.json(
                  { error: "Failed to create Linear issue" },
                  { status: 500 }
                );
              }
              return NextResponse.json(result);
            }
            break;

          case IntegrationProvider.ZAPIER:
            if (action === "test") {
              const isValid = await validateZapierConfig(integrationConfig);
              if (!isValid) {
                return NextResponse.json(
                  { error: "Invalid Zapier configuration" },
                  { status: 400 }
                );
              }
              const success = await sendZapierWebhook(integrationConfig, {
                event: "test",
                data: { test: true },
              });
              return NextResponse.json({ success });
            }
            if (action === "webhook") {
              const success = await sendZapierWebhook(integrationConfig, payload);
              return NextResponse.json({ success });
            }
            break;

          default:
            return NextResponse.json(
              { error: "Action not supported for this provider" },
              { status: 400 }
            );
        }

        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
      } catch (actionError) {
        console.error("Integration action error:", actionError);
        const message = actionError instanceof Error ? actionError.message : "Action failed";
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }

    // Handle regular update
    try {
      const updateData: any = {};
      if (config !== undefined) updateData.config = config;
      if (isActive !== undefined) updateData.isActive = isActive;

      const updated = await prisma.integration.update({
        where: { id },
        data: updateData,
      });

      return NextResponse.json(updated);
    } catch (error) {
      console.error("Error updating integration:", error);
      return NextResponse.json(
        { error: "Integration feature not available" },
        { status: 503 }
      );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update integration";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const integration = await prisma.integration.findUnique({
      where: { id },
    });

    if (!integration) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    await requireMember(integration.organizationId, "ADMIN");

    try {
      await prisma.integration.delete({
        where: { id },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting integration:", error);
      return NextResponse.json(
        { error: "Integration feature not available" },
        { status: 503 }
      );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete integration";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

