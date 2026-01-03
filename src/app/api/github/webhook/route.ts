import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGitHubClient, syncGitHubToBoard } from "@/lib/github";
import crypto from "crypto";

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

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
          // Find or create task for this issue
          // This is simplified - you'd want to track issue numbers
          const taskStatus = issue.state === "closed" ? "DONE" : "TODO";

          // Update task if it exists, or create new one
          // In production, you'd track GitHub issue numbers in tasks
        }

        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("GitHub webhook error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to process webhook";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
