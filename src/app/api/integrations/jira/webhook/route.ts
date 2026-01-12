import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Webhook endpoint for Jira to send events to your app
 * This receives webhooks FROM Jira when issues are created/updated
 * 
 * To configure in Jira:
 * 1. Go to Jira Settings → System → Webhooks
 * 2. Create a new webhook
 * 3. Set the URL to: https://yourapp.com/api/integrations/jira/webhook?organizationId=YOUR_ORG_ID
 * 4. Select events: Issue Created, Issue Updated
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
        provider: "JIRA",
        isActive: true,
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: "Jira integration not found or inactive for this organization" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const webhookEvent = body.webhookEvent;
    const issue = body.issue;

    // Handle different Jira webhook events
    if (webhookEvent === "jira:issue_created") {
      // Create a task in your app based on Jira issue
      // This would need board context - you might want to store boardId in integration config
      console.log("Jira issue created:", issue.key);
      // TODO: Implement task creation logic
    } else if (webhookEvent === "jira:issue_updated") {
      // Update task in your app based on Jira issue changes
      console.log("Jira issue updated:", issue.key);
      // TODO: Implement task update logic
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Jira webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
