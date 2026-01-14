"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TaskTag {
  tag: Tag;
}

interface EditTaskModalProps {
  taskId: string;
  boardId: string;
  organizationId?: string;
  currentTitle: string;
  currentDescription: string | null;
  onClose: () => void;
}

export function EditTaskModal({
  taskId,
  boardId,
  organizationId,
  currentTitle,
  currentDescription,
  onClose,
}: EditTaskModalProps) {
  const [title, setTitle] = useState(currentTitle);
  const [description, setDescription] = useState<string>(
    currentDescription ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");

  const queryClient = useQueryClient();

  // Fetch full task data to get dueDate and estimatedHours
  const { data: task } = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  useEffect(() => {
    if (task) {
      setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "");
      setEstimatedHours(task.estimatedHours?.toString() || "");
    }
  }, [task]);

  // Fetch current task tags
  const { data: taskTags = [] } = useQuery<TaskTag[]>({
    queryKey: ["task-tags", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/tags`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch available tags
  const { data: availableTags = [] } = useQuery<Tag[]>({
    queryKey: ["tags", boardId, organizationId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (organizationId) params.append("organizationId", organizationId);
      if (boardId) params.append("boardId", boardId);
      const res = await fetch(`/api/tags?${params.toString()}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!organizationId || !!boardId,
  });

  // Update selected tags when task tags load
  useEffect(() => {
    if (taskTags && taskTags.length > 0) {
      const tagIds = taskTags
        .map((tt) => tt?.tag?.id)
        .filter((id): id is string => !!id);
      setSelectedTagIds(tagIds);
    }
  }, [taskTags]);

  const updateTaskMutation = useMutation({
    mutationFn: async ({
      title,
      description,
      dueDate,
      estimatedHours,
    }: {
      title: string;
      description: string;
      dueDate?: string;
      estimatedHours?: number;
    }) => {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          dueDate: dueDate || undefined,
          estimatedHours: estimatedHours || undefined,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update task");
      }
      return res.json();
    },
    onSuccess: async () => {
      // Update tags
      const currentTagIds = (taskTags || [])
        .map((tt) => tt?.tag?.id)
        .filter((id): id is string => !!id);
      const tagsToAdd = selectedTagIds.filter((id) => !currentTagIds.includes(id));
      const tagsToRemove = currentTagIds.filter((id) => !selectedTagIds.includes(id));

      // Add new tags
      await Promise.all(
        tagsToAdd.map((tagId) =>
          fetch(`/api/tasks/${taskId}/tags`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tagId }),
          }).catch((err) => console.error("Failed to add tag:", err))
        )
      );

      // Remove tags
      await Promise.all(
        tagsToRemove.map((tagId) =>
          fetch(`/api/tasks/${taskId}/tags?tagId=${tagId}`, {
            method: "DELETE",
          }).catch((err) => console.error("Failed to remove tag:", err))
        )
      );

      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      queryClient.invalidateQueries({ queryKey: ["task-tags", taskId] });
      onClose();
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  useEffect(() => {
    setTitle(currentTitle);
    setDescription(currentDescription ?? "");
  }, [currentTitle, currentDescription]);

  
  const descriptionValue = description ?? "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    if (title.length > 500) {
      setError("Title must be less than 500 characters");
      return;
    }

    if (descriptionValue.length > 10000) {
      setError("Description must be less than 10000 characters");
      return;
    }

    updateTaskMutation.mutate({
      title: title.trim(),
      description: descriptionValue,
      dueDate: dueDate || undefined,
      estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 xs:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 xs:p-4 sm:p-6 max-w-md w-full mx-2 xs:mx-4 max-h-[95vh] xs:max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Edit Task
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Title *
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              maxLength={500}
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Description
            </label>
            <textarea
              id="description"
              value={descriptionValue}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              maxLength={10000}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {descriptionValue.length}/10000 characters
            </p>
          </div>

          {availableTags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
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
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedTagIds.includes(tag.id)
                        ? "ring-2 ring-offset-2"
                        : "opacity-60 hover:opacity-100"
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
            </div>
          )}

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

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateTaskMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {updateTaskMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
