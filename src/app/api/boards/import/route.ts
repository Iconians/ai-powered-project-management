import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaskStatus, TaskPriority } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { boardId, data, format } = body;

    if (!boardId || !data) {
      return NextResponse.json(
        { error: "boardId and data are required" },
        { status: 400 }
      );
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    await requireMember(board.organizationId, "MEMBER");

    let tasksToImport: any[] = [];

    if (format === "json") {
      tasksToImport = data.tasks || [];
    } else if (format === "csv") {
      // Parse CSV (simplified - would need proper CSV parsing library in production)
      const lines = data.split("\n");
      const headers = lines[0].split(",").map((h: string) => h.trim().replace(/"/g, ""));
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = lines[i].split(",").map((v: string) => v.trim().replace(/"/g, ""));
        const task: any = {};
        headers.forEach((header: string, index: number) => {
          task[header.toLowerCase().replace(/\s+/g, "")] = values[index] || "";
        });
        tasksToImport.push(task);
      }
    }

    const importedTasks = [];

    for (const taskData of tasksToImport) {
      // Get or create status column
      const status = (taskData.status || "TODO") as TaskStatus;
      let statusColumn = await prisma.taskStatusColumn.findFirst({
        where: {
          boardId,
          status,
        },
      });

      if (!statusColumn) {
        statusColumn = await prisma.taskStatusColumn.create({
          data: {
            boardId,
            name: status,
            status,
            order: 0,
          },
        });
      }

      // Find assignee if email provided
      let assigneeId = null;
      if (taskData.assignee) {
        const user = await prisma.user.findUnique({
          where: { email: taskData.assignee },
        });
        if (user) {
          const member = await prisma.member.findFirst({
            where: {
              userId: user.id,
              organizationId: board.organizationId,
            },
          });
          if (member) {
            assigneeId = member.id;
          }
        }
      }

      // Create task
      const task = await prisma.task.create({
        data: {
          title: taskData.title || "Imported Task",
          description: taskData.description || null,
          boardId,
          status,
          priority: (taskData.priority || "MEDIUM") as TaskPriority,
          assigneeId,
          statusColumnId: statusColumn.id,
          dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
          estimatedHours: taskData.estimatedHours || null,
          order: 0,
        },
      });

      // Import tags
      if (taskData.tags && Array.isArray(taskData.tags)) {
        for (const tagName of taskData.tags) {
          let tag = await prisma.tag.findFirst({
            where: {
              name: tagName,
              boardId,
            },
          });

          if (!tag) {
            tag = await prisma.tag.create({
              data: {
                name: tagName,
                boardId,
                color: "#3B82F6",
              },
            });
          }

          await prisma.taskTag.create({
            data: {
              taskId: task.id,
              tagId: tag.id,
            },
          });
        }
      }

      // Import checklist items
      if (taskData.checklistItems && Array.isArray(taskData.checklistItems)) {
        for (let i = 0; i < taskData.checklistItems.length; i++) {
          const item = taskData.checklistItems[i];
          await prisma.checklistItem.create({
            data: {
              taskId: task.id,
              text: item.text || "",
              isCompleted: item.isCompleted || false,
              order: i,
            },
          });
        }
      }

      importedTasks.push(task);
    }

    return NextResponse.json({
      success: true,
      imported: importedTasks.length,
      tasks: importedTasks,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to import board";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

