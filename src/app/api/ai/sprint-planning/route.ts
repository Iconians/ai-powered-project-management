import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateWithAI } from "@/lib/ai/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { boardId, sprintId, capacity, provider = process.env.AI_PROVIDER || "gemini" } = body;

    if (!boardId || !sprintId || !capacity) {
      return NextResponse.json(
        { error: "boardId, sprintId, and capacity are required" },
        { status: 400 }
      );
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    await requireMember(board.organizationId);

    // Get backlog tasks
    const backlogTasks = await prisma.task.findMany({
      where: {
        boardId,
        sprintId: null,
        status: {
          not: "DONE",
        },
      },
      include: {
        assignee: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
      orderBy: { priority: "desc" },
    });

    if (backlogTasks.length === 0) {
      return NextResponse.json({
        goal: "No backlog tasks available",
        taskIds: [],
        reasoning: "The backlog is empty. Add tasks to the backlog first.",
      });
    }

    const systemPrompt = `You are a sprint planning assistant. Analyze the backlog and suggest which tasks should be included in the sprint based on:
- Task priority
- Estimated hours
- Team capacity (${capacity} hours)
- Task dependencies

Return a JSON object with:
- goal: Sprint goal statement
- taskIds: Array of task IDs to include in sprint
- reasoning: Brief explanation of the selection

Example:
{
  "goal": "Complete user authentication and profile management",
  "taskIds": ["task1", "task2"],
  "reasoning": "Selected high-priority tasks that fit within capacity"
}`;

    const tasksDescription = backlogTasks
      .map(
        (t) =>
          `ID: ${t.id}, Title: ${t.title}, Priority: ${t.priority}, Estimated: ${t.estimatedHours || "N/A"} hours`
      )
      .join("\n");

    const userPrompt = `Analyze these backlog tasks and suggest sprint scope:\n\n${tasksDescription}`;

    let aiResponse: string;
    try {
      aiResponse = await generateWithAI(
        provider as "demo" | "gemini" | "ollama" | "openai" | "anthropic",
        userPrompt,
        systemPrompt
      );
    } catch (error: any) {
      // Fall back to simple rule-based selection if AI fails
      console.error("AI generation failed, using rule-based selection:", error);
      const selectedTasks = backlogTasks
        .filter((t) => (t.estimatedHours || 0) <= capacity)
        .slice(0, Math.floor(capacity / 8)); // Rough estimate: 8 hours per task
      
      return NextResponse.json({
        goal: `Complete ${selectedTasks.length} high-priority tasks`,
        taskIds: selectedTasks.map((t) => t.id),
        tasks: selectedTasks.map((t) => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          estimatedHours: t.estimatedHours,
        })),
        reasoning: `Selected ${selectedTasks.length} tasks based on priority and capacity constraints.`,
      });
    }

    // Parse AI response
    let suggestion;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        suggestion = JSON.parse(jsonMatch[0]);
      } else {
        suggestion = JSON.parse(aiResponse);
      }
    } catch (error) {
      // Fall back to rule-based
      const selectedTasks = backlogTasks
        .filter((t) => (t.estimatedHours || 0) <= capacity)
        .slice(0, Math.floor(capacity / 8));
      
      return NextResponse.json({
        goal: `Complete ${selectedTasks.length} high-priority tasks`,
        taskIds: selectedTasks.map((t) => t.id),
        tasks: selectedTasks.map((t) => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          estimatedHours: t.estimatedHours,
        })),
        reasoning: `Selected ${selectedTasks.length} tasks based on priority and capacity constraints.`,
      });
    }

    // Validate task IDs exist and get task details
    const validTasks = backlogTasks.filter((t) => suggestion.taskIds?.includes(t.id));

    return NextResponse.json({
      goal: suggestion.goal || "Complete selected backlog items",
      taskIds: validTasks.map((t) => t.id),
      tasks: validTasks.map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        estimatedHours: t.estimatedHours,
      })),
      reasoning: suggestion.reasoning || "Tasks selected based on priority and capacity",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to plan sprint" },
      { status: 500 }
    );
  }
}

