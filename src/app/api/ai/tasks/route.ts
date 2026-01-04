import { NextRequest, NextResponse } from "next/server";
import {
  requireBoardAccess,
  requirePaidSubscription,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { generateWithAI } from "@/lib/ai/client";
import { TaskStatus } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      description,
      boardId,
      provider = process.env.AI_PROVIDER || "gemini",
    } = body;

    if (!description || !boardId) {
      return NextResponse.json(
        { error: "Description and boardId are required" },
        { status: 400 }
      );
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    // Check if organization has a paid subscription
    try {
      await requirePaidSubscription(board.organizationId);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "AI features require a paid subscription (Pro or Enterprise)",
        },
        { status: 403 }
      );
    }

    // Check board access - need MEMBER role to generate tasks
    await requireBoardAccess(boardId, "MEMBER");

    const systemPrompt = `You are a project management assistant. Given a project description or requirements, break it down into actionable tasks. 
Return a JSON array of tasks, each with:
- title: A clear, concise task title
- description: Detailed description of what needs to be done
- priority: One of LOW, MEDIUM, HIGH, URGENT
- estimatedHours: Estimated hours to complete (number)

Example format:
[
  {
    "title": "Set up database schema",
    "description": "Create Prisma schema with User, Post, and Comment models",
    "priority": "HIGH",
    "estimatedHours": 4
  }
]`;

    const userPrompt = `Break down the following project into actionable tasks:\n\n${description}`;

    let aiResponse: string;
    try {
      aiResponse = await generateWithAI(
        provider as "demo" | "gemini" | "ollama" | "openai" | "anthropic",
        userPrompt,
        systemPrompt
      );
    } catch (error) {
      // If AI fails, try demo mode as fallback
      console.error("AI generation failed, falling back to demo mode:", error);
      try {
        aiResponse = await generateWithAI("demo", userPrompt, systemPrompt);
      } catch (fallbackError) {
        return NextResponse.json(
          {
            error:
              "AI generation failed. Please check your API key and try again.",
          },
          { status: 500 }
        );
      }
    }

    // Parse AI response (handle both JSON and markdown code blocks)
    let tasks;
    try {
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        tasks = JSON.parse(jsonMatch[0]);
      } else {
        tasks = JSON.parse(aiResponse);
      }
    } catch (error) {
      return NextResponse.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 500 }
      );
    }

    if (!Array.isArray(tasks)) {
      return NextResponse.json(
        { error: "AI did not return a valid task array" },
        { status: 500 }
      );
    }

    // Get default status column
    const statusColumn = await prisma.taskStatusColumn.findFirst({
      where: {
        boardId,
        status: TaskStatus.TODO,
      },
    });

    // Get max order
    const maxOrderTask = await prisma.task.findFirst({
      where: { boardId },
      orderBy: { order: "desc" },
    });

    // Create tasks
    const createdTasks = await Promise.all(
      tasks.map((task, index) =>
        prisma.task.create({
          data: {
            title: task.title,
            description: task.description,
            boardId,
            status: TaskStatus.TODO,
            priority: task.priority || "MEDIUM",
            estimatedHours: task.estimatedHours || null,
            statusColumnId: statusColumn?.id || null,
            order: (maxOrderTask?.order || 0) + index + 1,
          },
          include: {
            assignee: {
              select: {
                id: true,
                userId: true,
                role: true,
              },
            },
            statusColumn: true,
          },
        })
      )
    );

    // Emit Pusher events for real-time updates (one event for all tasks)
    try {
      await pusherServer.trigger(`board-${boardId}`, "tasks-generated", {
        tasks: createdTasks,
        count: createdTasks.length,
      });
    } catch (pusherError) {
      console.error("Pusher error:", pusherError);
      // Don't fail the request if Pusher fails
    }

    return NextResponse.json({ tasks: createdTasks }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate tasks",
      },
      { status: 500 }
    );
  }
}
