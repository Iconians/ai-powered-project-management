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
  }>;
}

interface KanbanBoardProps {
  boardId: string;
  organizationId?: string;
  userBoardRole?: "ADMIN" | "MEMBER" | "VIEWER";
}

export function KanbanBoard({ boardId, organizationId, userBoardRole }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const queryClient = useQueryClient();

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "k",
      meta: true,
      handler: () => {
        // Quick task creation - could open modal
        console.log("Quick task creation");
      },
    },
    {
      key: "f",
      meta: true,
      handler: () => {
        // Focus search
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

  const { data: board, isLoading } = useQuery<Board>({
    queryKey: ["board", boardId],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${boardId}`);
      if (!res.ok) throw new Error("Failed to fetch board");
      return res.json();
    },

    refetchOnWindowFocus: true,
    refetchOnReconnect: true,

    refetchInterval: false,
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

    const statusColumn = board.statuses.find((s) => s.id === overId);

    if (!statusColumn) {
      const droppedOnTask = board.tasks.find((t) => t.id === overId);
      if (droppedOnTask) {
        const targetStatus = board.statuses.find(
          (s) => s.status === droppedOnTask.status
        );
        if (targetStatus) {
          const task = board.tasks.find((t) => t.id === taskId);
          if (task && task.status !== targetStatus.status) {
            const tasksInNewStatus = board.tasks.filter(
              (t) => t.status === targetStatus.status
            );
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

    const task = board.tasks.find((t) => t.id === taskId);
    if (!task) {
      return;
    }

    if (task.status === statusColumn.status) {
      return;
    }

    const tasksInNewStatus = board.tasks.filter(
      (t) => t.status === statusColumn.status
    );
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

  if (!board) {
    return (
      <div className="p-8 text-gray-600 dark:text-gray-400">
        Board not found
      </div>
    );
  }

  const sortedStatuses = [...board.statuses].sort((a, b) => a.order - b.order);
  const activeTask = board.tasks.find((t) => t.id === activeId);

  const handleDragOver = () => {};

  return (
    <div className="h-full flex flex-col">
      <RiskAlerts boardId={boardId} />
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col md:flex-row gap-2 sm:gap-4 p-2 sm:p-4 overflow-y-auto md:overflow-x-auto md:overflow-y-visible flex-1 md:justify-center">
        {sortedStatuses.map((status) => {
          const columnTasks = board.tasks
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
    </div>
  );
}
