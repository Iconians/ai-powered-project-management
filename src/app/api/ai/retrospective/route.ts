import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess, requirePaidSubscription } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateWithAI } from "@/lib/ai/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sprintId, boardId, provider = process.env.AI_PROVIDER || "gemini" } = body;

    if (!sprintId || !boardId) {
      return NextResponse.json(
        { error: "sprintId and boardId are required" },
        { status: 400 }
      );
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    await requirePaidSubscription(board.organizationId);
    await requireBoardAccess(boardId, "MEMBER");

    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        tasks: {
          include: {
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
      },
    });

    if (!sprint) {
      return NextResponse.json({ error: "Sprint not found" }, { status: 404 });
    }

    const completedTasks = sprint.tasks.filter((t) => t.status === "DONE");
    const incompleteTasks = sprint.tasks.filter((t) => t.status !== "DONE");

    const systemPrompt = `You are a project management assistant. Generate a sprint retrospective based on sprint data. Include:
1. What went well
2. What could be improved
3. Action items for next sprint
4. Team velocity insights

Return a JSON object with these sections.`;

    const sprintData = `
Sprint: ${sprint.name}
Goal: ${sprint.goal || "None"}
Duration: ${new Date(sprint.startDate).toLocaleDateString()} - ${new Date(sprint.endDate).toLocaleDateString()}
Completed Tasks: ${completedTasks.length}
Incomplete Tasks: ${incompleteTasks.length}
Total Tasks: ${sprint.tasks.length}
`;

    const userPrompt = `Generate a retrospective for this sprint:\n\n${sprintData}`;

    let aiResponse: string;
    try {
      aiResponse = await generateWithAI(
        provider as "demo" | "gemini" | "ollama" | "openai" | "anthropic",
        userPrompt,
        systemPrompt
      );
    } catch (error) {
      console.error("AI generation failed:", error);
      return NextResponse.json(
        { error: "AI generation failed. Please try again." },
        { status: 500 }
      );
    }

    let retrospective;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        retrospective = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback to plain text
        retrospective = {
          summary: aiResponse,
          wentWell: [],
          improvements: [],
          actionItems: [],
        };
      }
    } catch (error) {
      // Fallback to plain text
      retrospective = {
        summary: aiResponse,
        wentWell: [],
        improvements: [],
        actionItems: [],
      };
    }

    return NextResponse.json({ retrospective });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate retrospective";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

