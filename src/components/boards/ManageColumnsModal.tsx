"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TaskStatus } from "@prisma/client";

interface Column {
  id: string;
  name: string;
  status: TaskStatus;
  order: number;
  _count?: {
    tasks: number;
  };
}

interface ManageColumnsModalProps {
  boardId: string;
  onClose: () => void;
  userBoardRole?: "ADMIN" | "MEMBER" | "VIEWER";
}

const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "TODO", label: "Todo" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "DONE", label: "Done" },
  { value: "BLOCKED", label: "Blocked" },
];

export function ManageColumnsModal({
  boardId,
  onClose,
  userBoardRole,
}: ManageColumnsModalProps) {
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnStatus, setNewColumnStatus] = useState<TaskStatus>("TODO");
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const canEdit = userBoardRole === "ADMIN" || userBoardRole === "MEMBER";

  const { data: columns, isLoading } = useQuery<Column[]>({
    queryKey: ["board", boardId, "columns"],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${boardId}/columns`);
      if (!res.ok) throw new Error("Failed to fetch columns");
      return res.json();
    },
  });

  const updateColumnMutation = useMutation({
    mutationFn: async ({
      columnId,
      name,
    }: {
      columnId: string;
      name: string;
    }) => {
      const res = await fetch(`/api/boards/${boardId}/columns/${columnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update column");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", boardId, "columns"],
      });
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      setEditingColumnId(null);
      setEditName("");
      setError(null);
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: async (columnId: string) => {
      const res = await fetch(`/api/boards/${boardId}/columns/${columnId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete column");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", boardId, "columns"],
      });
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      setError(null);
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  const createColumnMutation = useMutation({
    mutationFn: async ({
      name,
      status,
    }: {
      name: string;
      status: TaskStatus;
    }) => {
      const res = await fetch(`/api/boards/${boardId}/columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, status }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create column");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", boardId, "columns"],
      });
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      setShowAddForm(false);
      setNewColumnName("");
      setNewColumnStatus("TODO");
      setError(null);
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  const handleStartEdit = (column: Column) => {
    setEditingColumnId(column.id);
    setEditName(column.name);
    setError(null);
  };

  const handleSaveEdit = (columnId: string) => {
    if (!editName.trim()) {
      setError("Column name is required");
      return;
    }
    updateColumnMutation.mutate({ columnId, name: editName.trim() });
  };

  const handleDelete = (column: Column) => {
    if (
      confirm(
        `Are you sure you want to delete "${column.name}"? This will permanently delete the column.`
      )
    ) {
      deleteColumnMutation.mutate(column.id);
    }
  };

  const handleCreate = () => {
    if (!newColumnName.trim()) {
      setError("Column name is required");
      return;
    }
    createColumnMutation.mutate({
      name: newColumnName.trim(),
      status: newColumnStatus,
    });
  };

  
  const usedStatuses = new Set(columns?.map((c) => c.status) || []);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4">
          <p className="text-gray-600 dark:text-gray-400">Loading columns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Manage Columns
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3 mb-4">
          {columns?.map((column) => (
            <div
              key={column.id}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              {editingColumnId === column.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSaveEdit(column.id);
                      } else if (e.key === "Escape") {
                        setEditingColumnId(null);
                        setEditName("");
                      }
                    }}
                  />
                  <button
                    onClick={() => handleSaveEdit(column.id)}
                    disabled={updateColumnMutation.isPending}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingColumnId(null);
                      setEditName("");
                    }}
                    className="px-3 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 text-sm"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {column.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Status: {column.status} • {column._count?.tasks || 0}{" "}
                      task(s)
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStartEdit(column)}
                        className="px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(column)}
                        disabled={deleteColumnMutation.isPending}
                        className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {canEdit && (
          <>
            {!showAddForm ? (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                + Add Column
              </button>
            ) : (
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Column Name
                  </label>
                  <input
                    type="text"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    placeholder="e.g., Backlog, Review, Testing"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Status Type
                  </label>
                  <select
                    value={newColumnStatus}
                    onChange={(e) =>
                      setNewColumnStatus(e.target.value as TaskStatus)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TASK_STATUS_OPTIONS.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        disabled={usedStatuses.has(option.value)}
                      >
                        {option.label}
                        {usedStatuses.has(option.value)
                          ? " (already used)"
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleCreate}
                    disabled={
                      createColumnMutation.isPending || !newColumnName.trim()
                    }
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createColumnMutation.isPending
                      ? "Creating..."
                      : "Create Column"}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewColumnName("");
                      setNewColumnStatus("TODO");
                      setError(null);
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
