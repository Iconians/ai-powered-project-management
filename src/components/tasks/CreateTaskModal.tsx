"use client";

import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import { TemplateSelector } from "../templates/TemplateSelector";

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

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface CreateTaskModalProps {
  boardId: string;
  organizationId?: string;
  defaultStatus?: string;
  onClose: () => void;
}

export function CreateTaskModal({
  boardId,
  organizationId,
  defaultStatus,
  onClose,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const queryClient = useQueryClient();

  // Fetch available tags (both board and organization tags)
  const { data: boardTags = [], isLoading: boardTagsLoading } = useQuery<Tag[]>({
    queryKey: ["tags", boardId],
    queryFn: async () => {
      const res = await fetch(`/api/tags?boardId=${boardId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!boardId,
  });

  const { data: orgTags = [], isLoading: orgTagsLoading } = useQuery<Tag[]>({
    queryKey: ["tags", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const res = await fetch(`/api/tags?organizationId=${organizationId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!organizationId,
  });

  // Combine board and organization tags, removing duplicates
  const tags = Array.from(
    new Map([...orgTags, ...boardTags].map((tag) => [tag.id, tag])).values()
  );
  const tagsLoading = boardTagsLoading || orgTagsLoading;

  const generateDescriptionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, boardId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to generate description");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setDescription(data.description || "");
    },
  });

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
          dueDate: dueDate || undefined,
          estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create task");
      }
      const task = await res.json();
      
      // Add tags if any selected
      if (selectedTagIds.length > 0 && task.id) {
        await Promise.all(
          selectedTagIds.map((tagId) =>
            fetch(`/api/tasks/${task.id}/tags`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tagId }),
            })
          )
        );
      }
      
      return task;
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
      setSelectedTagIds([]);
      setDueDate("");
      setEstimatedHours("");
      onClose();
    },
    onSettled: () => {
      
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
  });

  const handleTemplateSelect = (template: any) => {
    setTitle(template.title);
    setDescription(template.taskDescription || "");
    setPriority(template.priority);
    setEstimatedHours(template.estimatedHours?.toString() || "");
    // Note: Tags and checklist items would need to be handled separately
    // since they require API calls after task creation
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createTaskMutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Create Task
          </h2>
          <button
            type="button"
            onClick={() => setShowTemplateSelector(true)}
            className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            📋 Use Template
          </button>
        </div>
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
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Description
              </label>
              {title.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    generateDescriptionMutation.mutate();
                  }}
                  disabled={generateDescriptionMutation.isPending}
                  className="text-xs px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                >
                  {generateDescriptionMutation.isPending
                    ? "Generating..."
                    : "✨ AI Generate"}
                </button>
              )}
            </div>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tags
            </label>
            {tagsLoading ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Loading tags...
              </div>
            ) : tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      setSelectedTagIds((prev) =>
                        prev.includes(tag.id)
                          ? prev.filter((id) => id !== tag.id)
                          : [...prev, tag.id]
                      );
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                      selectedTagIds.includes(tag.id)
                        ? "ring-2 ring-offset-2 ring-blue-500"
                        : "opacity-70 hover:opacity-100"
                    }`}
                    style={{
                      backgroundColor: selectedTagIds.includes(tag.id)
                        ? tag.color
                        : `${tag.color}20`,
                      color: selectedTagIds.includes(tag.id)
                        ? "#fff"
                        : tag.color,
                      borderColor: tag.color,
                    }}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                No tags available. Create tags in board settings to organize tasks.
              </div>
            )}
          </div>
          <div>
            <label
              htmlFor="dueDate"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Due Date
            </label>
            <input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label
              htmlFor="estimatedHours"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Estimated Hours
            </label>
            <input
              id="estimatedHours"
              type="number"
              min="0"
              step="0.5"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., 4.5"
            />
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

      {showTemplateSelector && (
        <TemplateSelector
          boardId={boardId}
          organizationId={organizationId}
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplateSelector(false)}
        />
      )}
    </div>
  );
}
