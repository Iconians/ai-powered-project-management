"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

interface BoardSettingsProps {
  boardId: string;
  boardName: string;
  organizationId?: string; 
  isOrgAdmin: boolean;
}

export function BoardSettings({
  boardId,
  boardName,
  organizationId: _organizationId, 
  isOrgAdmin,
}: BoardSettingsProps) {
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [name, setName] = useState(boardName);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  const updateMutation = useMutation({
    mutationFn: async (newName: string) => {
      const res = await fetch(`/api/boards/${boardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update board");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      setShowModal(false);
      setError(null);
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/boards/${boardId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete board");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      router.push("/boards");
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Board name is required");
      return;
    }
    updateMutation.mutate(name.trim());
  };

  const handleDelete = () => {
    if (
      confirm(
        `Are you sure you want to delete "${boardName}"? This will delete all tasks and data associated with this board. This action cannot be undone.`
      )
    ) {
      deleteMutation.mutate();
    }
  };

  if (!isOrgAdmin) {
    return null; 
  }

  if (!showModal) {
    return (
      <button
        onClick={() => setShowModal(true)}
        className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        title="Board Settings"
      >
        ⚙️
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Board Settings
        </h2>

        {!showDeleteConfirm ? (
          <>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label
                  htmlFor="boardName"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Board Name
                </label>
                <input
                  id="boardName"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
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
                  onClick={() => {
                    setShowModal(false);
                    setError(null);
                    setName(boardName);
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {updateMutation.isPending ? "Saving..." : "Save"}
                </button>
              </div>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Danger Zone
              </h3>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
              >
                Delete Board
              </button>
            </div>
          </>
        ) : (
          <div>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Are you sure you want to delete <strong>{boardName}</strong>? This
              will permanently delete:
            </p>
            <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mb-4 space-y-1">
              <li>All tasks in this board</li>
              <li>All sprints and related data</li>
              <li>All board member associations</li>
            </ul>
            <p className="text-red-600 dark:text-red-400 font-semibold mb-4">
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setError(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete Board"}
              </button>
            </div>
            {error && (
              <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
