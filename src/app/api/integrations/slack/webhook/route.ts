import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Webhook endpoint for Slack to send events to your app
 * This receives webhooks FROM Slack (e.g., slash commands, button clicks)
 * 
 * To configure in Slack:
 * 1. Go to your Slack app settings
 * 2. Navigate to "Interactivity & Shortcuts" or "Slash Commands"
 * 3. Set the Request URL to: https://yourapp.com/api/integrations/slack/webhook?organizationId=YOUR_ORG_ID
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId query parameter is required" },
        { status: 400 }
      );
    }

    // Verify the integration exists and is active
    const integration = await prisma.integration.findFirst({
      where: {
        organizationId,
        provider: "SLACK",
        isActive: true,
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: "Slack integration not found or inactive for this organization" },
        { status: 404 }
      );
    }

    const body = await request.text();
    const payload = JSON.parse(body);

    // Handle different Slack webhook types
    if (payload.type === "url_verification") {
      // Slack URL verification for Events API
      return NextResponse.json({ challenge: payload.challenge });
    }

    // Handle slash commands
    if (payload.command) {
      // Example: /task command to create a task
      // This would need to be implemented based on your needs
      return NextResponse.json({
        response_type: "ephemeral",
        text: "Slack command received. Task creation from Slack is not yet implemented.",
      });
    }

    // Handle interactive components (buttons, modals)
    if (payload.type === "interactive_message" || payload.actions) {
      // Handle button clicks, etc.
      return NextResponse.json({ text: "Action received" });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Slack webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
