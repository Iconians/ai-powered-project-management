import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

/**
 * Webhook endpoint for Linear to send events to your app
 * This receives webhooks FROM Linear when issues are created/updated
 * 
 * To configure in Linear:
 * 1. Go to your Linear workspace settings
 * 2. Navigate to API → Webhooks
 * 3. Create a new webhook
 * 4. Set the URL to: https://yourapp.com/api/integrations/linear/webhook?organizationId=YOUR_ORG_ID
 * 5. Select events: Issue Created, Issue Updated
 * 6. Copy the webhook secret and add it to your integration config
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
        provider: "LINEAR",
        isActive: true,
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: "Linear integration not found or inactive for this organization" },
        { status: 404 }
      );
    }

    // Verify webhook signature if configured
    const headersList = await headers();
    const signature = headersList.get("linear-signature");
    const config = integration.config as { webhookSecret?: string };

    if (config.webhookSecret && signature) {
      // TODO: Verify Linear webhook signature
      // const isValid = verifyLinearSignature(body, signature, config.webhookSecret);
      // if (!isValid) {
      //   return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      // }
    }

    const body = await request.json();
    const event = body.action; // e.g., "create", "update"
    const issue = body.data;

    // Handle different Linear webhook events
    if (event === "create") {
      // Create a task in your app based on Linear issue
      console.log("Linear issue created:", issue.id);
      // TODO: Implement task creation logic
    } else if (event === "update") {
      // Update task in your app based on Linear issue changes
      console.log("Linear issue updated:", issue.id);
      // TODO: Implement task update logic
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Linear webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
