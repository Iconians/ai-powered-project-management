"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface GitHubRepoModalProps {
  boardId: string;
  currentRepoName?: string | null;
  onClose: () => void;
}

export function GitHubRepoModal({
  boardId,
  currentRepoName,
  onClose,
}: GitHubRepoModalProps) {
  const [repoName, setRepoName] = useState(currentRepoName || "");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const updateRepoMutation = useMutation({
    mutationFn: async (repoName: string) => {
      const res = await fetch(`/api/boards/${boardId}/github`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubRepoName: repoName }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update repository");
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!repoName.trim()) {
      setError("Repository name is required");
      return;
    }

    // Validate format: owner/repo
    if (!/^[\w\-\.]+\/[\w\-\.]+$/.test(repoName.trim())) {
      setError("Invalid format. Use 'owner/repo' (e.g., 'Iconians/ai-powered-project-management')");
      return;
    }

    updateRepoMutation.mutate(repoName.trim());
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Set GitHub Repository
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Enter the GitHub repository name in the format <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">owner/repo</code>
        </p>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="repoName"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Repository Name
            </label>
            <input
              id="repoName"
              type="text"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder="Iconians/ai-powered-project-management"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </div>
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
              disabled={updateRepoMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {updateRepoMutation.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

