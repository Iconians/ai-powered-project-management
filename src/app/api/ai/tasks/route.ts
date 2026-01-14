import { NextRequest, NextResponse } from "next/server";
import {
  requireBoardAccess,
  requirePaidSubscription,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { generateWithAI } from "@/lib/ai/client";
import { TaskStatus } from "@prisma/client";
import { syncTaskToGitHub } from "@/lib/github-sync";

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
      select: {
        id: true,
        organizationId: true,
        githubSyncEnabled: true,
        githubAccessToken: true,
        githubRepoName: true,
        githubProjectId: true,
      },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    
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

    
    await requireBoardAccess(boardId, "MEMBER");

    const systemPrompt = `You are a versatile project management assistant that works across all industries and business types. Given any project description, initiative, or goal, break it down into actionable tasks.

Your task breakdowns should work for ANY domain:
- Business operations (marketing, sales, HR, finance)
- Product development (physical products, services, digital products)
- Events and campaigns
- Process improvements
- Strategic initiatives
- Content creation
- Customer service improvements
- And any other business activity

Return a JSON array of tasks, each with:
- title: A clear, concise task title (use domain-appropriate language)
- description: Detailed description of what needs to be done
- priority: One of LOW, MEDIUM, HIGH, URGENT
- estimatedHours: Estimated hours to complete (number)

Example formats (showing diversity):
[
  {
    "title": "Research target market demographics",
    "description": "Conduct market research to identify primary customer segments, their needs, and purchasing behaviors",
    "priority": "HIGH",
    "estimatedHours": 8
  },
  {
    "title": "Design product packaging",
    "description": "Create packaging design that aligns with brand identity and protects product during shipping",
    "priority": "MEDIUM",
    "estimatedHours": 6
  },
  {
    "title": "Schedule vendor meetings",
    "description": "Coordinate with 3 potential suppliers to discuss pricing, delivery terms, and quality standards",
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

    
    const statusColumn = await prisma.taskStatusColumn.findFirst({
      where: {
        boardId,
        status: TaskStatus.TODO,
      },
    });

    
    const maxOrderTask = await prisma.task.findFirst({
      where: { boardId },
      orderBy: { order: "desc" },
    });

    
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
            board: {
              select: {
                id: true,
                organizationId: true,
                githubSyncEnabled: true,
                githubAccessToken: true,
                githubRepoName: true,
                githubProjectId: true,
              },
            },
          },
        })
      )
    );

    // Sync each task to GitHub if GitHub sync is enabled
    for (const task of createdTasks) {
      if (
        task.board.githubSyncEnabled &&
        task.board.githubAccessToken &&
        task.board.githubRepoName
      ) {
        try {
          await syncTaskToGitHub(task.id);
          console.log(
            `✅ Synced AI-generated task ${task.id} to GitHub`
          );
        } catch (githubError) {
          console.error(
            `❌ Failed to sync AI-generated task ${task.id} to GitHub:`,
            githubError
          );
          // Continue with other tasks even if one fails
        }
      }
    }

    
    try {
      await pusherServer.trigger(`board-${boardId}`, "tasks-generated", {
        tasks: createdTasks,
        count: createdTasks.length,
      });
    } catch (pusherError) {
      console.error("Pusher error:", pusherError);
      
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
