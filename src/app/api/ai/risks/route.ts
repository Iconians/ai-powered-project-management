import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess, requirePaidSubscription } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateWithAI } from "@/lib/ai/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { boardId, provider = process.env.AI_PROVIDER || "gemini" } = body;

    if (!boardId) {
      return NextResponse.json(
        { error: "boardId is required" },
        { status: 400 }
      );
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        tasks: {
          include: {
            dependencies: {
              include: {
                dependsOn: {
                  select: {
                    id: true,
                    title: true,
                    status: true,
                  },
                },
              },
            },
            assignee: {
              include: {
                user: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        sprints: {
          where: { isActive: true },
          include: {
            tasks: true,
          },
        },
      },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    await requirePaidSubscription(board.organizationId);
    await requireBoardAccess(boardId, "MEMBER");

    // Analyze risks
    const overdueTasks = board.tasks.filter(
      (task) => task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "DONE"
    );

    const blockedTasks = board.tasks.filter((task) => {
      return task.dependencies.some(
        (dep) => dep.dependsOn.status !== "DONE"
      );
    });

    const activeSprint = board.sprints[0];
    const sprintCapacity = activeSprint
      ? activeSprint.tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0)
      : 0;

    const systemPrompt = `You are a project management assistant. Analyze project data and identify potential risks. Return a JSON array of risks with:
- type: RISK type (OVERDUE, BLOCKED, OVERCAPACITY, LOW_COMPLETION)
- severity: HIGH, MEDIUM, LOW
- description: Brief description
- recommendation: Suggested action`;

    const projectData = `
Board: ${board.name}
Total Tasks: ${board.tasks.length}
Overdue Tasks: ${overdueTasks.length}
Blocked Tasks: ${blockedTasks.length}
Active Sprint Capacity: ${sprintCapacity} hours
`;

    const userPrompt = `Analyze risks for this project:\n\n${projectData}`;

    let aiResponse: string;
    try {
      aiResponse = await generateWithAI(
        provider as "demo" | "gemini" | "ollama" | "openai" | "anthropic",
        userPrompt,
        systemPrompt
      );
    } catch (error) {
      console.error("AI generation failed:", error);
      // Return basic risk analysis
      const risks = [];
      if (overdueTasks.length > 0) {
        risks.push({
          type: "OVERDUE",
          severity: "HIGH",
          description: `${overdueTasks.length} tasks are overdue`,
          recommendation: "Review and update due dates or task priorities",
        });
      }
      if (blockedTasks.length > 0) {
        risks.push({
          type: "BLOCKED",
          severity: "MEDIUM",
          description: `${blockedTasks.length} tasks are blocked by incomplete dependencies`,
          recommendation: "Prioritize blocking tasks to unblock dependent work",
        });
      }
      return NextResponse.json({ risks });
    }

    let risks;
    try {
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        risks = JSON.parse(jsonMatch[0]);
      } else {
        risks = JSON.parse(aiResponse);
      }
    } catch (error) {
      // Fallback to basic risks
      const basicRisks = [];
      if (overdueTasks.length > 0) {
        basicRisks.push({
          type: "OVERDUE",
          severity: "HIGH",
          description: `${overdueTasks.length} tasks are overdue`,
          recommendation: "Review and update due dates",
        });
      }
      if (blockedTasks.length > 0) {
        basicRisks.push({
          type: "BLOCKED",
          severity: "MEDIUM",
          description: `${blockedTasks.length} tasks are blocked`,
          recommendation: "Prioritize blocking tasks",
        });
      }
      risks = basicRisks;
    }

    return NextResponse.json({ risks });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to analyze risks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

