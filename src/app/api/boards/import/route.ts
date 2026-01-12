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
      include: {
        statuses: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    await requireMember(board.organizationId, "MEMBER");

    let tasksToImport: any[] = [];

    if (format === "json") {
      // data is already parsed JSON object
      if (typeof data === "object" && data !== null && "tasks" in data) {
        tasksToImport = data.tasks || [];
      } else if (Array.isArray(data)) {
        // If data is directly an array of tasks
        tasksToImport = data;
      } else {
        return NextResponse.json(
          { error: "Invalid JSON format. Expected object with 'tasks' array or array of tasks." },
          { status: 400 }
        );
      }
    } else if (format === "csv") {
      // Parse CSV (improved handling of quoted fields)
      const lines = (data as string).split("\n").filter(line => line.trim());
      if (lines.length === 0) {
        return NextResponse.json({ error: "Empty CSV file" }, { status: 400 });
      }
      
      // Parse headers (handle quoted values)
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = parseCSVLine(lines[0]).map((h: string) => h.replace(/^"|"$/g, "").trim());
      const normalizedHeaders = headers.map((h: string) => h.toLowerCase().replace(/\s+/g, ""));
      
      // Check if CSV has expected task format (should have at least "title" column)
      const hasTitleColumn = normalizedHeaders.some(h => h === "title");
      
      // Check if this is a Kanban-style board format (status columns)
      const statusMap: { [key: string]: TaskStatus } = {
        "todo": TaskStatus.TODO,
        "tod": TaskStatus.TODO,
        "todos": TaskStatus.TODO,
        "inprogress": TaskStatus.IN_PROGRESS,
        "in-progress": TaskStatus.IN_PROGRESS,
        "in_progress": TaskStatus.IN_PROGRESS,
        "in_review": TaskStatus.IN_REVIEW,
        "inreview": TaskStatus.IN_REVIEW,
        "in-review": TaskStatus.IN_REVIEW,
        "review": TaskStatus.IN_REVIEW,
        "done": TaskStatus.DONE,
        "completed": TaskStatus.DONE,
        "blocked": TaskStatus.BLOCKED,
      };
      
      // Create a map from CSV column names to board statuses
      // First try to match against actual board status column names
      const columnToStatusMap: { [colIndex: number]: TaskStatus } = {};
      normalizedHeaders.forEach((normalizedHeader, colIndex) => {
        // Try to match against board's actual status column names
        const matchingStatusColumn = board.statuses.find(statusCol => {
          const normalizedStatusName = statusCol.name.toLowerCase().replace(/\s+/g, "");
          return normalizedStatusName === normalizedHeader || 
                 normalizedHeader.includes(normalizedStatusName) ||
                 normalizedStatusName.includes(normalizedHeader);
        });
        
        if (matchingStatusColumn) {
          columnToStatusMap[colIndex] = matchingStatusColumn.status;
        } else if (statusMap[normalizedHeader]) {
          // Fallback to hardcoded status map
          columnToStatusMap[colIndex] = statusMap[normalizedHeader];
        }
      });
      
      const isKanbanFormat = Object.keys(columnToStatusMap).length > 0 && !hasTitleColumn;
      
      if (!hasTitleColumn && !isKanbanFormat && headers.length > 0) {
        // Check if this looks like a pivot table format (common days of week, etc.)
        const commonDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
        const hasDaysOfWeek = normalizedHeaders.some(h => commonDays.includes(h));
        
        if (hasDaysOfWeek) {
          return NextResponse.json(
            { 
              error: "CSV format not supported. The import expects either:\n1. Task list format: One task per row with a 'Title' column\n2. Kanban board format: Status columns (To Do, In Progress, In Review, Done) with tasks listed vertically\n\nYour file appears to be a pivot table or matrix format (days of week as columns)."
            },
            { status: 400 }
          );
        }
        
        return NextResponse.json(
          { 
            error: `CSV format not recognized. Expected either:\n1. Task list format with columns: Title, Description, Status, Priority, etc.\n2. Kanban board format with status columns: To Do, In Progress, In Review, Done\n\nFound columns: ${headers.slice(0, 5).join(", ")}${headers.length > 5 ? "..." : ""}`
          },
          { status: 400 }
        );
      }
      
      // Handle Kanban-style format (tasks in status columns)
      if (isKanbanFormat) {
        // Process each column (status)
        normalizedHeaders.forEach((_normalizedHeader, colIndex) => {
          const status = columnToStatusMap[colIndex];
          if (status) {
            // Process each row in this column
            for (let rowIndex = 1; rowIndex < lines.length; rowIndex++) {
              if (!lines[rowIndex].trim()) continue;
              const values = parseCSVLine(lines[rowIndex]).map((v: string) => v.replace(/^"|"$/g, "").trim());
              const taskTitle = values[colIndex];
              
              if (taskTitle && taskTitle.length > 0) {
                tasksToImport.push({
                  title: taskTitle,
                  status: status,
                  priority: "MEDIUM",
                });
              }
            }
          }
        });
      } else {
        // Original task list format (one task per row)
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const values = parseCSVLine(lines[i]).map((v: string) => v.replace(/^"|"$/g, ""));
          const task: any = {};
          normalizedHeaders.forEach((header: string, index: number) => {
            const value = values[index] || "";
            // Map CSV headers to task fields
            if (header === "title") task.title = value;
            else if (header === "description") task.description = value;
            else if (header === "status") task.status = value;
            else if (header === "priority") task.priority = value;
            else if (header === "assignee" || header === "assigne") task.assignee = value;
            else if (header === "duedate" || header === "duedate") task.dueDate = value;
            else if (header === "estimatedhours" || header === "estimatedhours") task.estimatedHours = parseFloat(value) || null;
            else if (header === "tags") task.tags = value ? value.split(",").map((t: string) => t.trim()) : [];
            else task[header] = value;
          });
          
          // Only add tasks that have at least a title
          if (task.title && task.title.trim()) {
            tasksToImport.push(task);
          }
        }
      }
      
      if (tasksToImport.length === 0) {
        return NextResponse.json(
          { error: "No valid tasks found in CSV. Ensure your CSV has a 'Title' column with task names." },
          { status: 400 }
        );
      }
    }

    const importedTasks = [];
    const errors: string[] = [];

    // Helper function to normalize and validate priority
    const normalizePriority = (priority: string | undefined): TaskPriority => {
      if (!priority) return TaskPriority.MEDIUM;
      const normalized = priority.toUpperCase().trim();
      const validPriorities = Object.values(TaskPriority);
      if (validPriorities.includes(normalized as TaskPriority)) {
        return normalized as TaskPriority;
      }
      // Try common variations
      const priorityMap: { [key: string]: TaskPriority } = {
        "LOW": TaskPriority.LOW,
        "MEDIUM": TaskPriority.MEDIUM,
        "MED": TaskPriority.MEDIUM,
        "HIGH": TaskPriority.HIGH,
        "URGENT": TaskPriority.URGENT,
        "URG": TaskPriority.URGENT,
      };
      return priorityMap[normalized] || TaskPriority.MEDIUM;
    };

    // Helper function to normalize and validate status
    const normalizeStatus = (status: string | undefined): TaskStatus => {
      if (!status) return TaskStatus.TODO;
      const normalized = status.toUpperCase().trim().replace(/[-\s_]/g, "_");
      const validStatuses = Object.values(TaskStatus);
      if (validStatuses.includes(normalized as TaskStatus)) {
        return normalized as TaskStatus;
      }
      // Try common variations
      const statusMap: { [key: string]: TaskStatus } = {
        "TODO": TaskStatus.TODO,
        "TO_DO": TaskStatus.TODO,
        "TOD": TaskStatus.TODO,
        "IN_PROGRESS": TaskStatus.IN_PROGRESS,
        "INPROGRESS": TaskStatus.IN_PROGRESS,
        "PROGRESS": TaskStatus.IN_PROGRESS,
        "IN_REVIEW": TaskStatus.IN_REVIEW,
        "INREVIEW": TaskStatus.IN_REVIEW,
        "REVIEW": TaskStatus.IN_REVIEW,
        "DONE": TaskStatus.DONE,
        "COMPLETED": TaskStatus.DONE,
        "BLOCKED": TaskStatus.BLOCKED,
      };
      return statusMap[normalized] || TaskStatus.TODO;
    };

    for (let i = 0; i < tasksToImport.length; i++) {
      const taskData = tasksToImport[i];
      try {
        // Validate required fields
        if (!taskData.title || !taskData.title.trim()) {
          errors.push(`Row ${i + 1}: Task title is required`);
          continue;
        }

        // Normalize and validate status
        const status = normalizeStatus(taskData.status);
        
        // Get or create status column
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
          try {
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
              } else {
                errors.push(`Row ${i + 1}: Assignee "${taskData.assignee}" is not a member of this organization`);
              }
            } else {
              errors.push(`Row ${i + 1}: Assignee "${taskData.assignee}" not found`);
            }
          } catch (err) {
            errors.push(`Row ${i + 1}: Error looking up assignee "${taskData.assignee}"`);
          }
        }

        // Normalize and validate priority
        const priority = normalizePriority(taskData.priority);

        // Validate due date if provided
        let dueDate = null;
        if (taskData.dueDate) {
          try {
            const parsedDate = new Date(taskData.dueDate);
            if (isNaN(parsedDate.getTime())) {
              errors.push(`Row ${i + 1}: Invalid due date format "${taskData.dueDate}"`);
            } else {
              dueDate = parsedDate;
            }
          } catch (err) {
            errors.push(`Row ${i + 1}: Error parsing due date "${taskData.dueDate}"`);
          }
        }

        // Validate estimated hours if provided
        let estimatedHours = null;
        if (taskData.estimatedHours !== undefined && taskData.estimatedHours !== null) {
          const parsed = parseFloat(String(taskData.estimatedHours));
          if (isNaN(parsed) || parsed < 0) {
            errors.push(`Row ${i + 1}: Invalid estimated hours "${taskData.estimatedHours}"`);
          } else {
            estimatedHours = parsed;
          }
        }

        // Create task
        const task = await prisma.task.create({
          data: {
            title: taskData.title.trim(),
            description: taskData.description ? taskData.description.trim() : null,
            boardId,
            status,
            priority,
            assigneeId,
            statusColumnId: statusColumn.id,
            dueDate,
            estimatedHours,
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
          for (let j = 0; j < taskData.checklistItems.length; j++) {
            const item = taskData.checklistItems[j];
            await prisma.checklistItem.create({
              data: {
                taskId: task.id,
                text: item.text || "",
                isCompleted: item.isCompleted || false,
                order: j,
              },
            });
          }
        }

        importedTasks.push(task);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Row ${i + 1}: ${errorMessage}`);
        console.error(`Error importing task ${i + 1}:`, error);
      }
    }

    // If we have some imports but also errors, return partial success
    if (importedTasks.length > 0 && errors.length > 0) {
      return NextResponse.json({
        success: true,
        imported: importedTasks.length,
        tasks: importedTasks,
        errors,
        warnings: `Imported ${importedTasks.length} task(s) with ${errors.length} error(s). Check errors for details.`,
      });
    }

    // If we have errors but no successful imports
    if (errors.length > 0 && importedTasks.length === 0) {
      return NextResponse.json(
        {
          error: "Import failed",
          details: errors,
          message: `Failed to import tasks. ${errors.length} error(s) occurred:\n${errors.slice(0, 5).join("\n")}${errors.length > 5 ? `\n... and ${errors.length - 5} more` : ""}`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      imported: importedTasks.length,
      tasks: importedTasks,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to import board";
    console.error("Import error:", error);
    return NextResponse.json(
      { 
        error: "Import failed",
        message: message,
        details: error instanceof Error ? error.stack : undefined
      }, 
      { status: 500 }
    );
  }
}

