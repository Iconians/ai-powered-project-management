import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncGitHubIssueToTask } from "@/lib/github-sync";
import crypto from "crypto";

// Ensure this route handles POST requests correctly
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

// GitHub webhooks only use POST, but add GET handler to prevent redirects
export async function GET() {
  return NextResponse.json(
    { error: "This endpoint only accepts POST requests from GitHub webhooks" },
    { status: 405 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-hub-signature-256");

    if (!GITHUB_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: "GitHub webhook secret not configured" },
        { status: 500 }
      );
    }

    // Verify webhook signature
    if (signature) {
      const hmac = crypto.createHmac("sha256", GITHUB_WEBHOOK_SECRET);
      const digest = "sha256=" + hmac.update(body).digest("hex");

      if (signature !== digest) {
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    const event = JSON.parse(body);
    const eventType = request.headers.get("x-github-event");

    // Handle different GitHub events
    switch (eventType) {
      case "issues": {
        const issue = event.issue;
        const repository = event.repository;
        const action = event.action;

        // Find board by repository
        const board = await prisma.board.findFirst({
          where: {
            githubRepoName: `${repository.owner.login}/${repository.name}`,
            githubSyncEnabled: true,
          },
        });

        if (!board || !board.githubAccessToken) {
          return NextResponse.json({
            message: "Board not found or sync disabled",
          });
        }

        // Update task based on issue
        if (action === "opened" || action === "closed" || action === "edited") {
          try {
            const task = await syncGitHubIssueToTask(
              issue,
              repository,
              board.id
            );
            return NextResponse.json({ 
              received: true, 
              event: "issues",
              action,
              taskId: task.id,
              issueNumber: issue.number,
            });
          } catch (error) {
            console.error("Failed to sync GitHub issue to task:", error);
            return NextResponse.json({ 
              received: true, 
              event: "issues",
              error: "Failed to sync issue to task",
            });
          }
        }

        return NextResponse.json({ received: true, event: "issues" });
      }

      case "issue_comment": {
        const issue = event.issue;
        const comment = event.comment;
        const repository = event.repository;
        const action = event.action;

        // Find board by repository
        const board = await prisma.board.findFirst({
          where: {
            githubRepoName: `${repository.owner.login}/${repository.name}`,
            githubSyncEnabled: true,
          },
        });

        if (!board || !board.githubAccessToken) {
          return NextResponse.json({
            message: "Board not found or sync disabled",
          });
        }

        // Handle issue comment events
        // For now, just acknowledge receipt
        // In production, you might want to sync comments to tasks
        return NextResponse.json({ 
          received: true, 
          event: "issue_comment",
          action,
          issueNumber: issue.number,
        });
      }

      default:
        // Acknowledge receipt of other event types
        return NextResponse.json({ 
          received: true, 
          event: eventType,
          message: "Event type not yet implemented",
        });
    }
  } catch (error) {
    console.error("GitHub webhook error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to process webhook";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
