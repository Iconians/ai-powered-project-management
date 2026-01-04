"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface GitHubRepoModalProps {
  boardId: string;
  currentRepoName?: string | null;
  currentProjectId?: number | null;
  onClose: () => void;
}

export function GitHubRepoModal({
  boardId,
  currentRepoName,
  currentProjectId,
  onClose,
}: GitHubRepoModalProps) {
  const [repoName, setRepoName] = useState(currentRepoName || "");
  const [projectId, setProjectId] = useState(
    currentProjectId?.toString() || ""
  );
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const updateRepoMutation = useMutation({
    mutationFn: async (data: {
      githubRepoName?: string;
      githubProjectId?: number;
    }) => {
      const res = await fetch(`/api/boards/${boardId}/github`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update GitHub settings");
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

    const updateData: { githubRepoName?: string; githubProjectId?: number } =
      {};

    // Validate and add repo name if provided
    if (repoName.trim()) {
      if (!/^[\w\-\.]+\/[\w\-\.]+$/.test(repoName.trim())) {
        setError(
          "Invalid repository format. Use 'owner/repo' (e.g., 'Iconians/ai-powered-project-management')"
        );
        return;
      }
      updateData.githubRepoName = repoName.trim();
    }

    // Validate and add project ID if provided
    if (projectId.trim()) {
      const projectIdNum = parseInt(projectId.trim(), 10);
      if (isNaN(projectIdNum) || projectIdNum <= 0) {
        setError("Project ID must be a positive number");
        return;
      }
      updateData.githubProjectId = projectIdNum;
    }

    // At least one field must be provided
    if (!updateData.githubRepoName && !updateData.githubProjectId) {
      setError("Either repository name or project ID is required");
      return;
    }

    updateRepoMutation.mutate(updateData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Configure GitHub Sync
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Set your GitHub repository and/or project ID to enable syncing
        </p>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="repoName"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Repository Name (optional)
            </label>
            <input
              id="repoName"
              type="text"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder="Iconians/ai-powered-project-management"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Format: owner/repo
            </p>
          </div>
          <div className="mb-4">
            <label
              htmlFor="projectId"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              GitHub Project ID (optional)
            </label>
            <input
              id="projectId"
              type="number"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="123"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Find this in your GitHub project URL (the number after /projects/)
            </p>
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
