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

    // Log all incoming webhook events for debugging

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
        // Handle: opened, closed, edited, assigned, unassigned, labeled, unlabeled
        // Note: When items are moved in GitHub Projects, it may trigger "labeled" or "unlabeled" events
        if (
          action === "opened" ||
          action === "closed" ||
          action === "edited" ||
          action === "assigned" ||
          action === "unassigned" ||
          action === "labeled" ||
          action === "unlabeled"
        ) {
          console.log(
            `🔄 Processing ${action} event for issue #${issue.number}`
          );
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

      case "projects_v2_item": {
        // Handle GitHub Projects V2 item updates (when items are moved in project boards)
        const projectItem = event.projects_v2_item;
        const action = event.action;

        // Only handle edits/updates (when status changes)
        if (action !== "edited" && action !== "updated") {
          return NextResponse.json({
            received: true,
            event: "projects_v2_item",
            action,
            message: "Action not handled",
          });
        }

        // Get the content (issue) from the project item
        const content = projectItem?.content;
        if (!content || content.type !== "Issue") {
          return NextResponse.json({
            received: true,
            event: "projects_v2_item",
            message: "Content is not an issue",
          });
        }

        const issue = content;
        const issueNumber = issue.number;

        // Find board by project ID (from the project item)
        const project = event.projects_v2_item?.project;
        let board = null;

        if (project?.number) {
          const projectNumber = parseInt(project.number);
          console.log(
            `🔍 Searching for board with githubProjectId: ${projectNumber}`
          );
          board = await prisma.board.findFirst({
            where: {
              githubProjectId: projectNumber,
              githubSyncEnabled: true,
            },
          });
          if (board) {
          } else {
          }
        }

        // If not found by project ID, try to find by repository
        if (!board && event.repository) {
          const repository = event.repository;
          const repoName = `${repository.owner?.login || repository.owner}/${
            repository.name
          }`;
          board = await prisma.board.findFirst({
            where: {
              githubRepoName: repoName,
              githubSyncEnabled: true,
            },
          });
          if (board) {
          } else {
          }
        }

        if (!board || !board.githubAccessToken || !board.githubRepoName) {
          console.error("Board not found or sync disabled", {
            hasBoard: !!board,
            hasToken: !!board?.githubAccessToken,
            hasRepoName: !!board?.githubRepoName,
          });
          return NextResponse.json({
            message: "Board not found or sync disabled",
          });
        }

        // Fetch the full issue from GitHub to get current state (labels, assignees, etc.)
        try {
          const { getGitHubClient } = await import("@/lib/github");
          const githubClient = getGitHubClient(board.githubAccessToken);
          const [owner, repo] = board.githubRepoName.split("/");

          const { data: fullIssue } = await githubClient.rest.issues.get({
            owner,
            repo,
            issue_number: issueNumber,
          });

          // Sync the issue to task (this will update status based on labels)
          const task = await syncGitHubIssueToTask(
            fullIssue,
            { owner: { login: owner }, name: repo },
            board.id
          );

          // Trigger Pusher event for real-time updates
          const { triggerPusherEvent } = await import("@/lib/pusher");
          await triggerPusherEvent(`board-${board.id}`, "task-updated", {
            id: task.id,
            boardId: board.id,
            status: task.status,
          });

          console.log(
            `✅ Synced task ${task.id} from GitHub Project item update (issue #${issueNumber})`
          );

          return NextResponse.json({
            received: true,
            event: "projects_v2_item",
            action,
            taskId: task.id,
            issueNumber: issueNumber,
          });
        } catch (error) {
          console.error("Failed to sync issue from project item:", error);
          return NextResponse.json({
            received: true,
            event: "projects_v2_item",
            error: "Failed to sync project item",
          });
        }
      }

      default:
        // Log unhandled event types for debugging
        console.warn(`Unhandled webhook event type: ${eventType}`, {
          action: event.action,
          hasIssue: !!event.issue,
          hasProjectItem: !!event.projects_v2_item,
        });
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
