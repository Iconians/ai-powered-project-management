"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface TaskGeneratorProps {
  boardId: string;
  onClose: () => void;
}

export function TaskGenerator({ boardId, onClose }: TaskGeneratorProps) {
  const [description, setDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const queryClient = useQueryClient();

  const generateTasksMutation = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
      const res = await fetch("/api/ai/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          boardId,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to generate tasks");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      setIsGenerating(false);
      onClose();
      // Show success message
      alert(`Successfully generated ${data.tasks?.length || 0} tasks!`);
    },
    onError: (error) => {
      setIsGenerating(false);
      console.error("Task generation error:", error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    generateTasksMutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-2xl">✨</span>
            AI Task Generator
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Describe your project or feature, and AI will break it down into actionable tasks with priorities and time estimates.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Project Description *
            </label>
            <textarea
              id="description"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Example: Build a user authentication system with email/password login, password reset, and social login options..."
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Be as detailed as possible for better task breakdown
            </p>
          </div>

          {isGenerating && (
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span>AI is generating tasks... This may take a moment.</span>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGenerating || !description.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Generating...
                </>
              ) : (
                <>
                  <span>✨</span>
                  Generate Tasks
                </>
              )}
            </button>
          </div>
        </form>

        {generateTasksMutation.isError && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400 text-sm font-medium">
              Error generating tasks
            </p>
            <p className="text-red-500 dark:text-red-500 text-xs mt-1">
              {generateTasksMutation.error?.message || "Failed to generate tasks. Please try again."}
            </p>
            {generateTasksMutation.error?.message?.includes("paid subscription") && (
              <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  AI features require a Pro or Enterprise subscription.
                </p>
                <a
                  href="/billing"
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  Upgrade to Pro or Enterprise
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

