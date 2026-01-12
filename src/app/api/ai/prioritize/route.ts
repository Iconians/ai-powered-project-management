import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess, requirePaidSubscription } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateWithAI } from "@/lib/ai/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskIds, boardId, provider = process.env.AI_PROVIDER || "gemini" } = body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json(
        { error: "taskIds array is required" },
        { status: 400 }
      );
    }

    if (!boardId) {
      return NextResponse.json(
        { error: "boardId is required" },
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

    // Get tasks
    const tasks = await prisma.task.findMany({
      where: {
        id: { in: taskIds },
        boardId,
      },
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
    });

    const systemPrompt = `You are a project management assistant. Analyze the given tasks and suggest priority levels (LOW, MEDIUM, HIGH, URGENT) based on:
- Due dates (urgent if approaching)
- Dependencies (higher priority if blocking others)
- Business value
- Effort required
- Current workload of assignees

Return a JSON array with task IDs and suggested priorities:
[
  {
    "taskId": "task-id-1",
    "priority": "HIGH",
    "reasoning": "Brief explanation"
  }
]`;

    const tasksDescription = tasks
      .map(
        (task) =>
          `Task: ${task.title}\nDescription: ${task.description || "None"}\nDue: ${task.dueDate ? new Date(task.dueDate).toISOString() : "None"}\nCurrent Priority: ${task.priority}\nAssignee: ${task.assignee?.user?.name || "Unassigned"}`
      )
      .join("\n\n");

    const userPrompt = `Analyze and prioritize these tasks:\n\n${tasksDescription}`;

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

    let suggestions;
    try {
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        suggestions = JSON.parse(aiResponse);
      }
    } catch (error) {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to prioritize tasks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

