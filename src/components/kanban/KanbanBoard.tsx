"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  rectIntersection,
} from "@dnd-kit/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { KanbanColumn } from "./KanbanColumn";
import { TaskCard } from "./TaskCard";
import { useRealtime } from "@/hooks/useRealtime";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { ShortcutHelp } from "../shared/ShortcutHelp";
import { RiskAlerts } from "../ai/RiskAlerts";
import { BulkEditModal } from "../tasks/BulkEditModal";
import type { TaskStatus } from "@prisma/client";

interface Board {
  id: string;
  name: string;
  statuses: Array<{
    id: string;
    name: string;
    status: TaskStatus;
    order: number;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: string;
    assigneeId: string | null;
    assignee: {
      id: string;
      userId: string;
      role: string;
      user: {
        id: string;
        name: string | null;
        email: string;
      };
    } | null;
    order: number;
    tags?: Array<{
      tag: {
        id: string;
        name: string;
        color: string;
      };
    }>;
    dueDate?: string | null;
  }>;
}

interface FilterState {
  assigneeId?: string;
  status?: string;
  priority?: string;
  tagId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  searchQuery?: string;
}

interface KanbanBoardProps {
  boardId: string;
  organizationId?: string;
  userBoardRole?: "ADMIN" | "MEMBER" | "VIEWER";
  filters?: FilterState;
}

function filterTasks(tasks: Board["tasks"], filters: FilterState): Board["tasks"] {
  return tasks.filter((task) => {
    // Filter by status
    if (filters.status && task.status !== filters.status) {
      return false;
    }

    // Filter by priority
    if (filters.priority && task.priority !== filters.priority) {
      return false;
    }

    // Filter by assignee
    if (filters.assigneeId && task.assignee?.id !== filters.assigneeId) {
      return false;
    }

    // Filter by tag (if tags are included in the task)
    if (filters.tagId && task.tags) {
      const hasTag = task.tags.some((tt) => tt.tag?.id === filters.tagId);
      if (!hasTag) {
        return false;
      }
    }

    // Filter by due date
    if (filters.dueDateFrom && task.dueDate) {
      const dueDate = new Date(task.dueDate);
      const fromDate = new Date(filters.dueDateFrom);
      if (dueDate < fromDate) {
        return false;
      }
    }
    if (filters.dueDateTo && task.dueDate) {
      const dueDate = new Date(task.dueDate);
      const toDate = new Date(filters.dueDateTo);
      toDate.setHours(23, 59, 59, 999); // Include entire day
      if (dueDate > toDate) {
        return false;
      }
    }

    // Filter by search query
    if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
      const query = filters.searchQuery.toLowerCase();
      const titleMatch = task.title?.toLowerCase().includes(query);
      const descMatch = task.description?.toLowerCase().includes(query);
      if (!titleMatch && !descMatch) {
        return false;
      }
    }

    return true;
  });
}

export function KanbanBoard({ boardId, organizationId, userBoardRole, filters = {} }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const queryClient = useQueryClient();

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "k",
      meta: true,
      handler: () => {
        // Focus search (Cmd+K or Ctrl+K)
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      },
    },
    {
      key: "f",
      meta: true,
      handler: () => {
        // Focus search (alternative shortcut)
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        searchInput?.focus();
      },
    },
    {
      key: "/",
      meta: true,
      handler: () => {
        setShowShortcuts(true);
      },
    },
    {
      key: "Escape",
      handler: () => {
        setShowShortcuts(false);
      },
    },
  ]);

  const isViewer = userBoardRole === "VIEWER";
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
      disabled: isViewer,
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        distance: 10,
      },
      disabled: isViewer,
    })
  );

  const { data: board, isLoading, error: boardError } = useQuery<Board>({
    queryKey: ["board", boardId],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${boardId}`);
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to fetch board" }));
        throw new Error(error.error || "Failed to fetch board");
      }
      const data = await res.json();
      // Ensure statuses and tasks are arrays
      return {
        ...data,
        statuses: Array.isArray(data.statuses) ? data.statuses : [],
        tasks: Array.isArray(data.tasks) ? data.tasks : [],
      };
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: false,
    retry: 2,
    retryDelay: 1000,
  });

  useRealtime({
    channelName: `board-${boardId}`,
    eventName: "task-updated",
    callback: () => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
  });

  useRealtime({
    channelName: `board-${boardId}`,
    eventName: "task-created",
    callback: () => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
  });

  useRealtime({
    channelName: `board-${boardId}`,
    eventName: "task-deleted",
    callback: () => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
  });

  useRealtime({
    channelName: `board-${boardId}`,
    eventName: "tasks-generated",
    callback: () => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({
      taskId,
      status,
      order,
    }: {
      taskId: string;
      status: TaskStatus;
      order: number;
    }) => {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, order }),
      });
      if (!res.ok) throw new Error("Failed to update task");
      return res.json();
    },
    onMutate: async ({ taskId, status, order }) => {
      await queryClient.cancelQueries({ queryKey: ["board", boardId] });
      const previousBoard = queryClient.getQueryData<Board>(["board", boardId]);

      if (previousBoard) {
        queryClient.setQueryData<Board>(["board", boardId], (old) => {
          if (!old) return old;
          return {
            ...old,
            tasks: old.tasks.map((task) =>
              task.id === taskId ? { ...task, status, order } : task
            ),
          };
        });
      }

      return { previousBoard };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(["board", boardId], context.previousBoard);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (isViewer) {
      return;
    }

    if (!over || !board) {
      return;
    }

    const taskId = active.id as string;
    const overId = over.id as string;

    const statusColumn = board?.statuses?.find((s) => s.id === overId);

    if (!statusColumn) {
      const droppedOnTask = board?.tasks?.find((t) => t.id === overId);
      if (droppedOnTask) {
        const targetStatus = board?.statuses?.find(
          (s) => s.status === droppedOnTask.status
        );
        if (targetStatus) {
          const task = board?.tasks?.find((t) => t.id === taskId);
          if (task && task.status !== targetStatus.status) {
            const tasksInNewStatus = Array.isArray(board?.tasks)
              ? board.tasks.filter((t) => t.status === targetStatus.status)
              : [];
            const newOrder = tasksInNewStatus.length;

            updateTaskMutation.mutate({
              taskId,
              status: targetStatus.status,
              order: newOrder,
            });
          }
        }
      }
      return;
    }

    const task = board?.tasks?.find((t) => t.id === taskId);
    if (!task) {
      return;
    }

    if (task.status === statusColumn.status) {
      return;
    }

    const tasksInNewStatus = Array.isArray(board?.tasks)
      ? board.tasks.filter((t) => t.status === statusColumn.status)
      : [];
    const newOrder = tasksInNewStatus.length;

    updateTaskMutation.mutate({
      taskId,
      status: statusColumn.status,
      order: newOrder,
    });
  };

  if (isLoading) {
    return (
      <div className="p-8 text-gray-600 dark:text-gray-400">
        Loading board...
      </div>
    );
  }

  if (boardError) {
    return (
      <div className="p-8 text-red-600 dark:text-red-400">
        Error loading board: {boardError instanceof Error ? boardError.message : "Unknown error"}
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ["board", boardId] })}
          className="ml-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="p-8 text-gray-600 dark:text-gray-400">
        Board not found
      </div>
    );
  }

  const sortedStatuses = Array.isArray(board?.statuses)
    ? [...board.statuses].sort((a, b) => a.order - b.order)
    : [];
  const activeTask = board?.tasks?.find((t) => t.id === activeId);

  // Apply filters to tasks
  const allTasks = Array.isArray(board?.tasks) ? board.tasks : [];
  const filteredTasks = filterTasks(allTasks, filters);

  const handleDragOver = () => {};

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedTaskIds(new Set());
  };

  return (
    <div className="h-full flex flex-col">
      <RiskAlerts boardId={boardId} />
      
      {/* Bulk Actions Toolbar */}
      {selectedTaskIds.size > 0 && !isViewer && (
        <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-medium">
            {selectedTaskIds.size} task{selectedTaskIds.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowBulkEdit(true)}
              className="px-3 py-1 text-sm bg-white text-blue-600 rounded hover:bg-blue-50"
            >
              Edit Selected
            </button>
            <button
              onClick={clearSelection}
              className="px-3 py-1 text-sm bg-blue-700 rounded hover:bg-blue-800"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col md:flex-row gap-2 sm:gap-4 p-2 sm:p-4 overflow-y-auto md:overflow-x-auto md:overflow-y-visible flex-1 md:justify-center">
        {sortedStatuses.map((status) => {
          const columnTasks = filteredTasks
            .filter((t) => t.status === status.status)
            .sort((a, b) => a.order - b.order);

          return (
            <KanbanColumn
              key={status.id}
              id={status.id}
              status={status}
              tasks={columnTasks}
              boardId={boardId}
              organizationId={organizationId}
              userBoardRole={userBoardRole}
              selectedTaskIds={selectedTaskIds}
              onTaskSelect={toggleTaskSelection}
            />
          );
        })}
      </div>
      <DragOverlay>
        {activeTask ? (
          <TaskCard
            task={activeTask}
            isDragging
            boardId={boardId}
            organizationId={organizationId}
            userBoardRole={userBoardRole}
          />
        ) : null}
      </DragOverlay>

        <ShortcutHelp
          isOpen={showShortcuts}
          onClose={() => setShowShortcuts(false)}
        />
      </DndContext>

      {showBulkEdit && (
        <BulkEditModal
          taskIds={Array.from(selectedTaskIds)}
          boardId={boardId}
          onClose={() => {
            setShowBulkEdit(false);
            clearSelection();
          }}
        />
      )}
    </div>
  );
}
