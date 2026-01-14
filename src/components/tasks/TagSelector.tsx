"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagSelectorProps {
  taskId: string;
  boardId: string;
  organizationId: string;
  userBoardRole?: "ADMIN" | "MEMBER" | "VIEWER";
}

export function TagSelector({
  taskId,
  boardId,
  organizationId: _organizationId,
  userBoardRole,
}: TagSelectorProps) {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3B82F6");

  const { data: availableTags } = useQuery({
    queryKey: ["tags", boardId],
    queryFn: async () => {
      const res = await fetch(`/api/tags?boardId=${boardId}`);
      if (!res.ok) throw new Error("Failed to fetch tags");
      return res.json() as Promise<Tag[]>;
    },
  });

  const { data: taskTags } = useQuery({
    queryKey: ["task-tags", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/tags`);
      if (!res.ok) throw new Error("Failed to fetch task tags");
      const data = await res.json();
      return data.map((tt: { tag: Tag }) => tt.tag) as Tag[];
    },
  });

  const addTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const res = await fetch(`/api/tasks/${taskId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add tag");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-tags", taskId] });
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const res = await fetch(`/api/tasks/${taskId}/tags?tagId=${tagId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to remove tag");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-tags", taskId] });
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
  });

  const createTagMutation = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const res = await fetch(`/api/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color, boardId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create tag");
      }
      return res.json();
    },
    onSuccess: (newTag) => {
      queryClient.invalidateQueries({ queryKey: ["tags", boardId] });
      addTagMutation.mutate(newTag.id);
      setNewTagName("");
      setShowAddModal(false);
    },
  });

  const canEdit = userBoardRole === "ADMIN" || userBoardRole === "MEMBER";
  const canCreateTag = userBoardRole === "ADMIN";

  const currentTagIds = taskTags?.map((t) => t.id) || [];
  const unselectedTags = availableTags?.filter(
    (tag) => !currentTagIds.includes(tag.id)
  ) || [];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {taskTags?.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
            style={{
              backgroundColor: `${tag.color}20`,
              color: tag.color,
              border: `1px solid ${tag.color}40`,
            }}
          >
            {tag.name}
            {canEdit && (
              <button
                onClick={() => removeTagMutation.mutate(tag.id)}
                className="hover:opacity-70"
              >
                ×
              </button>
            )}
          </span>
        ))}
        {canEdit && (
          <button
            onClick={() => setShowAddModal(true)}
            className="text-xs px-2 py-1 border border-dashed border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500"
          >
            + Add tag
          </button>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 xs:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 xs:p-4 sm:p-6 max-w-md w-full mx-2 xs:mx-4 max-h-[95vh] overflow-y-auto">
            <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">
              Add Tag
            </h3>
            <div className="space-y-4">
              {unselectedTags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Existing Tags
                  </label>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {unselectedTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => {
                          addTagMutation.mutate(tag.id);
                          setShowAddModal(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <span
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-sm text-gray-900 dark:text-white">
                          {tag.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {canCreateTag && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Create New Tag
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="Tag name"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newTagColor}
                        onChange={(e) => setNewTagColor(e.target.value)}
                        className="w-12 h-8 rounded border border-gray-300 dark:border-gray-600"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Color
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        if (newTagName.trim()) {
                          createTagMutation.mutate({
                            name: newTagName.trim(),
                            color: newTagColor,
                          });
                        }
                      }}
                      disabled={
                        !newTagName.trim() || createTagMutation.isPending
                      }
                      className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      Create & Add
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setNewTagName("");
                  }}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

