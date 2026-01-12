"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface ChecklistItem {
  id: string;
  text: string;
  isCompleted: boolean;
  order: number;
}

interface TaskChecklistProps {
  taskId: string;
  boardId: string;
  userBoardRole?: "ADMIN" | "MEMBER" | "VIEWER";
}

export function TaskChecklist({
  taskId,
  boardId,
  userBoardRole,
}: TaskChecklistProps) {
  const queryClient = useQueryClient();
  const [newItemText, setNewItemText] = useState("");

  const { data: checklistItems, isLoading } = useQuery({
    queryKey: ["checklist", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/checklist`);
      if (!res.ok) throw new Error("Failed to fetch checklist");
      return res.json() as Promise<ChecklistItem[]>;
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch(`/api/tasks/${taskId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist", taskId] });
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      setNewItemText("");
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({
      itemId,
      text,
      isCompleted,
    }: {
      itemId: string;
      text?: string;
      isCompleted?: boolean;
    }) => {
      const res = await fetch(`/api/tasks/${taskId}/checklist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, text, isCompleted }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist", taskId] });
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await fetch(`/api/tasks/${taskId}/checklist?itemId=${itemId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist", taskId] });
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
  });

  const canEdit = userBoardRole === "ADMIN" || userBoardRole === "MEMBER";

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading checklist...</div>;
  }

  const items = checklistItems || [];
  const completedCount = items.filter((item) => item.isCompleted).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
          Checklist
        </h3>
        {totalCount > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {completedCount}/{totalCount} ({progress}%)
          </span>
        )}
      </div>

      {totalCount > 0 && (
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="space-y-1">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <input
              type="checkbox"
              checked={item.isCompleted}
              onChange={(e) => {
                if (canEdit) {
                  updateItemMutation.mutate({
                    itemId: item.id,
                    isCompleted: e.target.checked,
                  });
                }
              }}
              disabled={!canEdit}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            {canEdit ? (
              <input
                type="text"
                value={item.text}
                onChange={(e) => {
                  updateItemMutation.mutate({
                    itemId: item.id,
                    text: e.target.value,
                  });
                }}
                className={`flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  item.isCompleted ? "line-through text-gray-500" : ""
                }`}
              />
            ) : (
              <span
                className={`flex-1 text-sm ${
                  item.isCompleted
                    ? "line-through text-gray-500 dark:text-gray-400"
                    : "text-gray-900 dark:text-white"
                }`}
              >
                {item.text}
              </span>
            )}
            {canEdit && (
              <button
                onClick={() => deleteItemMutation.mutate(item.id)}
                className="text-red-600 hover:text-red-700 text-sm"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter" && newItemText.trim()) {
                createItemMutation.mutate(newItemText.trim());
              }
            }}
            placeholder="Add checklist item..."
            className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <button
            onClick={() => {
              if (newItemText.trim()) {
                createItemMutation.mutate(newItemText.trim());
              }
            }}
            disabled={!newItemText.trim() || createItemMutation.isPending}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

