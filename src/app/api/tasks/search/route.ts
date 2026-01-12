import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get("boardId");
    const query = searchParams.get("q");

    if (!boardId) {
      return NextResponse.json(
        { error: "boardId is required" },
        { status: 400 }
      );
    }

    await requireBoardAccess(boardId, "VIEWER");

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ tasks: [] });
    }

    // Use PostgreSQL full-text search
    const tasks = await prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        description: string | null;
        status: string;
        priority: string;
        rank: number;
      }>
    >`
      SELECT 
        t.id,
        t.title,
        t.description,
        t.status,
        t.priority,
        ts_rank(
          to_tsvector('english', coalesce(t.title, '') || ' ' || coalesce(t.description, '')),
          plainto_tsquery('english', ${query})
        ) as rank
      FROM "Task" t
      WHERE t."boardId" = ${boardId}
        AND (
          to_tsvector('english', coalesce(t.title, '') || ' ' || coalesce(t.description, ''))
          @@ plainto_tsquery('english', ${query})
        )
      ORDER BY rank DESC
      LIMIT 50
    `;

    return NextResponse.json({ tasks });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to search tasks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

