import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json"; // json, csv

    await requireBoardAccess(id, "VIEWER");

    const board = await prisma.board.findUnique({
      where: { id },
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
            tags: {
              include: {
                tag: true,
              },
            },
            checklistItems: true,
            dependencies: {
              include: {
                dependsOn: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            },
          },
          orderBy: { order: "asc" },
        },
        statuses: {
          orderBy: { order: "asc" },
        },
        sprints: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    if (format === "csv") {
      // Generate CSV
      const csvRows = [
        [
          "Title",
          "Description",
          "Status",
          "Priority",
          "Assignee",
          "Due Date",
          "Created At",
          "Tags",
        ],
      ];

      board.tasks.forEach((task) => {
        csvRows.push([
          task.title,
          task.description || "",
          task.status,
          task.priority,
          task.assignee?.user?.email || "",
          task.dueDate ? new Date(task.dueDate).toISOString() : "",
          new Date(task.createdAt).toISOString(),
          task.tags.map((tt) => tt.tag.name).join(", "),
        ]);
      });

      const csv = csvRows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="board-${board.name}-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    } else {
      // Generate JSON
      const exportData = {
        board: {
          name: board.name,
          description: board.description,
          createdAt: board.createdAt,
          exportedAt: new Date().toISOString(),
        },
        statuses: board.statuses,
        tasks: board.tasks.map((task) => ({
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          assignee: task.assignee?.user?.email || null,
          dueDate: task.dueDate,
          estimatedHours: task.estimatedHours,
          actualHours: task.actualHours,
          tags: task.tags.map((tt) => tt.tag.name),
          checklistItems: task.checklistItems.map((item) => ({
            text: item.text,
            isCompleted: item.isCompleted,
          })),
          dependencies: task.dependencies.map((dep) => dep.dependsOn.title),
          createdAt: task.createdAt,
        })),
        sprints: board.sprints,
      };

      return NextResponse.json(exportData, {
        headers: {
          "Content-Disposition": `attachment; filename="board-${board.name}-${new Date().toISOString().split("T")[0]}.json"`,
        },
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to export board";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

