import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess, requirePaidSubscription } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateWithAI } from "@/lib/ai/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, context, boardId, provider = process.env.AI_PROVIDER || "gemini" } = body;

    if (!title) {
      return NextResponse.json(
        { error: "title is required" },
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

    const systemPrompt = `You are a project management assistant. Generate a detailed, actionable task description based on a task title and optional context. The description should be clear, specific, and include acceptance criteria if applicable.`;

    const userPrompt = `Generate a detailed task description for: "${title}"${context ? `\n\nContext: ${context}` : ""}`;

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

    return NextResponse.json({ description: aiResponse.trim() });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate description";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

