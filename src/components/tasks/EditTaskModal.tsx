"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface EditTaskModalProps {
  taskId: string;
  boardId: string;
  currentTitle: string;
  currentDescription: string | null;
  onClose: () => void;
}

export function EditTaskModal({
  taskId,
  boardId,
  currentTitle,
  currentDescription,
  onClose,
}: EditTaskModalProps) {
  const [title, setTitle] = useState(currentTitle);
  const [description, setDescription] = useState<string>(
    currentDescription ?? ""
  );
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const updateTaskMutation = useMutation({
    mutationFn: async ({
      title,
      description,
    }: {
      title: string;
      description: string;
    }) => {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update task");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
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
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
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
