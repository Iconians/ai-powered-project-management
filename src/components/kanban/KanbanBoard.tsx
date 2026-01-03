"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  rectIntersection,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { KanbanColumn } from "./KanbanColumn";
import { TaskCard } from "./TaskCard";
import { useRealtime } from "@/hooks/useRealtime";
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
  userBoardRole?: "ADMIN" | "MEMBER" | "VIEWER";
}

export function KanbanBoard({ boardId, userBoardRole }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Disable drag/drop for VIEWERs
  const isViewer = userBoardRole === "VIEWER";
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
      disabled: isViewer, // Disable drag for viewers
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // Short delay to distinguish from taps but allow quick dragging
        tolerance: 8, // Allow more movement during delay for better mobile experience
      },
      disabled: isViewer, // Disable drag for viewers
    })
  );
  // const isViewer = userBoardRole === "VIEWER";
  // const sensors = useSensors(
  //   useSensor(PointerSensor, {
  //     activationConstraint: {
  //       distance: 8,
  //     },
  //     disabled: isViewer, // Disable drag for viewers
  //   })
  // );

  const { data: board, isLoading } = useQuery<Board>({
    queryKey: ["board", boardId],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${boardId}`);
      if (!res.ok) throw new Error("Failed to fetch board");
      return res.json();
    },
    // Only refetch on window focus/reconnect, not aggressive polling
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    // Disable automatic refetching - rely on mutations and Pusher real-time updates
    refetchInterval: false,
  });

  // Set up real-time updates via Pusher
  useRealtime({
    channelName: `board-${boardId}`,
    eventName: "task-updated",
    callback: () => {
      // Invalidate queries to refetch board data when a task is updated
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
    onError: (err, variables, context) => {
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

    // Prevent drag/drop for VIEWERs
    if (isViewer) {
      return;
    }

    if (!over || !board) {
      return;
    }

    const taskId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a status column (droppable)
    const statusColumn = board.statuses.find((s) => s.id === overId);

    // If dropped on another task, find which column that task belongs to
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
      // Task is already in this column, might be reordering within column
      // This is handled by the SortableContext
      return;
    }

    // Calculate new order (place at end of new column)
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

  const handleDragOver = (event: DragOverEvent) => {
    // This helps with visual feedback during drag
  };

  // Collect all task IDs for the main sortable context
  const allTaskIds = board.tasks.map((t) => t.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-2 sm:gap-4 p-2 sm:p-4 overflow-x-auto h-full">
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
            userBoardRole={userBoardRole}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
