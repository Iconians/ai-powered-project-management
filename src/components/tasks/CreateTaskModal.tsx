"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TaskPriority, TaskStatus } from "@prisma/client";

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

interface CreateTaskModalProps {
  boardId: string;
  defaultStatus?: string;
  onClose: () => void;
}

export function CreateTaskModal({
  boardId,
  defaultStatus,
  onClose,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const queryClient = useQueryClient();

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          boardId,
          status: defaultStatus,
          priority,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create task");
      }
      return res.json();
    },
    onMutate: async () => {
      
      await queryClient.cancelQueries({ queryKey: ["board", boardId] });

      
      const previousBoard = queryClient.getQueryData<Board>(["board", boardId]);

      
      if (previousBoard) {
        const status = (defaultStatus as TaskStatus) || "TODO";
        const tasksInStatus = previousBoard.tasks.filter(
          (t) => t.status === status
        );
        const newOrder = tasksInStatus.length;

        
        const optimisticTask = {
          id: `temp-${Date.now()}`,
          title,
          description: description || null,
          status: status as TaskStatus,
          priority,
          assigneeId: null,
          assignee: null,
          order: newOrder,
        };

        queryClient.setQueryData<Board>(["board", boardId], (old) => {
          if (!old) return old;
          return {
            ...old,
            tasks: [...old.tasks, optimisticTask],
          };
        });
      }

      return { previousBoard };
    },
    onError: (_error, _variables, context) => {
      
      if (context?.previousBoard) {
        queryClient.setQueryData(["board", boardId], context.previousBoard);
      }
    },
    onSuccess: (data) => {
      
      queryClient.setQueryData<Board>(["board", boardId], (old) => {
        if (!old) return old;
        
        const tasksWithoutTemp = old.tasks.filter(
          (task) => !task.id.startsWith("temp-")
        );
        return {
          ...old,
          tasks: [...tasksWithoutTemp, data],
        };
      });
      
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      onClose();
    },
    onSettled: () => {
      
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createTaskMutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Create Task
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Title *
            </label>
            <input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Task title"
            />
          </div>
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Task description"
            />
          </div>
          <div>
            <label
              htmlFor="priority"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Priority
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTaskMutation.isPending || !title.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {createTaskMutation.isPending ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
        {createTaskMutation.isError && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-600 dark:text-red-400 text-sm">
            <p className="font-medium">Failed to create task</p>
            <p className="mt-1">
              {createTaskMutation.error?.message ||
                "An error occurred. The task was not created."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
