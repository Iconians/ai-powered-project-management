"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Tag {
  id: string;
  name: string;
  color: string;
  organizationId: string | null;
  boardId: string | null;
}

interface TagManagerModalProps {
  boardId: string;
  organizationId?: string;
  userBoardRole?: "ADMIN" | "MEMBER" | "VIEWER";
  onClose: () => void;
}

const PRESET_COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#84CC16", // lime
  "#F97316", // orange
  "#6366F1", // indigo
  "#14B8A6", // teal
  "#A855F7", // violet
];

export function TagManagerModal({
  boardId,
  organizationId,
  userBoardRole,
  onClose,
}: TagManagerModalProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);
  const [newTagScope, setNewTagScope] = useState<"board" | "organization">("board");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState("");
  const [editTagColor, setEditTagColor] = useState("");
  const queryClient = useQueryClient();

  const canManage = userBoardRole === "ADMIN" || userBoardRole === "MEMBER";
  const canManageOrg = userBoardRole === "ADMIN" && organizationId;

  // Fetch board tags
  const { data: boardTags = [], isLoading: boardTagsLoading } = useQuery<Tag[]>({
    queryKey: ["tags", boardId],
    queryFn: async () => {
      const res = await fetch(`/api/tags?boardId=${boardId}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch organization tags
  const { data: orgTags = [] } = useQuery<Tag[]>({
    queryKey: ["tags", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const res = await fetch(`/api/tags?organizationId=${organizationId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!organizationId,
  });

  const createTagMutation = useMutation({
    mutationFn: async ({
      name,
      color,
      scope,
    }: {
      name: string;
      color: string;
      scope: "board" | "organization";
    }) => {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          color,
          ...(scope === "organization" && organizationId
            ? { organizationId }
            : { boardId }),
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create tag");
      }
      return res.json();
    },
    onSuccess: () => {
      // Invalidate all tag queries to ensure CreateTaskModal picks up new tags
      // This invalidates all queries starting with ["tags"]
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      // Also invalidate the specific query keys used by CreateTaskModal
      queryClient.invalidateQueries({ queryKey: ["tags", boardId, organizationId] });
      queryClient.invalidateQueries({ queryKey: ["tags", boardId] });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ["tags", organizationId] });
      }
      setNewTagName("");
      setNewTagColor(PRESET_COLORS[0]);
      setNewTagScope("board");
      setShowCreateForm(false);
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const res = await fetch(`/api/tags/${tagId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete tag");
      }
      return res.json();
    },
    onSuccess: () => {
      // Invalidate all tag queries
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["tags", boardId, organizationId] });
      queryClient.invalidateQueries({ queryKey: ["tags", boardId] });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ["tags", organizationId] });
      }
    },
  });

  const updateTagMutation = useMutation({
    mutationFn: async ({
      tagId,
      name,
      color,
    }: {
      tagId: string;
      name: string;
      color: string;
    }) => {
      const res = await fetch(`/api/tags/${tagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          color,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update tag");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags", boardId] });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ["tags", organizationId] });
      }
      setEditingTagId(null);
      setEditTagName("");
      setEditTagColor("");
    },
  });

  const handleStartEdit = (tag: Tag) => {
    setEditingTagId(tag.id);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
  };

  const handleCancelEdit = () => {
    setEditingTagId(null);
    setEditTagName("");
    setEditTagColor("");
  };

  const handleSaveEdit = () => {
    if (!editingTagId || !editTagName.trim()) return;
    updateTagMutation.mutate({
      tagId: editingTagId,
      name: editTagName,
      color: editTagColor,
    });
  };

  const handleDelete = (tag: Tag) => {
    if (
      confirm(
        `Are you sure you want to delete the tag "${tag.name}"? This will remove it from all tasks.`
      )
    ) {
      deleteTagMutation.mutate(tag.id);
    }
  };

  const handleCreate = () => {
    if (!newTagName.trim()) return;
    createTagMutation.mutate({
      name: newTagName,
      color: newTagColor,
      scope: newTagScope,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 xs:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-3 xs:p-4 sm:p-6 w-full max-w-3xl mx-2 xs:mx-4 max-h-[95vh] xs:max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Manage Tags
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
          >
            ✕
          </button>
        </div>

        {canManage && (
          <div className="mb-6">
            {!showCreateForm ? (
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <span>+</span>
                <span>Create New Tag</span>
              </button>
            ) : (
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Create New Tag
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tag Name *
                  </label>
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="e.g., Frontend, Backend, Bug"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    maxLength={50}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewTagColor(color)}
                        className={`w-10 h-10 rounded-full border-2 transition-all ${
                          newTagColor === color
                            ? "ring-2 ring-offset-2 ring-blue-500 scale-110"
                            : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="w-12 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Custom color
                    </span>
                  </div>
                </div>
                {organizationId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Scope
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="scope"
                          value="board"
                          checked={newTagScope === "board"}
                          onChange={(e) =>
                            setNewTagScope(e.target.value as "board")
                          }
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Board-specific (only this board)
                        </span>
                      </label>
                      {canManageOrg && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="scope"
                            value="organization"
                            checked={newTagScope === "organization"}
                            onChange={(e) =>
                              setNewTagScope(e.target.value as "organization")
                            }
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            Organization-wide (all boards)
                          </span>
                        </label>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={handleCreate}
                    disabled={
                      createTagMutation.isPending || !newTagName.trim()
                    }
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createTagMutation.isPending ? "Creating..." : "Create Tag"}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewTagName("");
                      setNewTagColor(PRESET_COLORS[0]);
                      setNewTagScope("board");
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-6">
          {/* Organization Tags */}
          {organizationId && orgTags.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Organization Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {orgTags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-full border"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      borderColor: tag.color,
                    }}
                  >
                    {editingTagId === tag.id ? (
                      <>
                        <input
                          type="text"
                          value={editTagName}
                          onChange={(e) => setEditTagName(e.target.value)}
                          className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit();
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                        />
                        <input
                          type="color"
                          value={editTagColor}
                          onChange={(e) => setEditTagColor(e.target.value)}
                          className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                        />
                        <button
                          onClick={handleSaveEdit}
                          disabled={updateTagMutation.isPending}
                          className="text-green-600 hover:text-green-700 text-sm"
                        >
                          ✓
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <>
                        <span
                          className="text-xs font-medium"
                          style={{ color: tag.color }}
                        >
                          {tag.name}
                        </span>
                        {canManageOrg && (
                          <>
                            <button
                              onClick={() => handleStartEdit(tag)}
                              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xs"
                              title="Edit tag"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDelete(tag)}
                              disabled={deleteTagMutation.isPending}
                              className="text-gray-500 hover:text-red-600 text-xs"
                              title="Delete tag"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Board Tags */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Board Tags
            </h3>
            {boardTagsLoading ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Loading tags...
              </div>
            ) : boardTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {boardTags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-full border"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      borderColor: tag.color,
                    }}
                  >
                    {editingTagId === tag.id ? (
                      <>
                        <input
                          type="text"
                          value={editTagName}
                          onChange={(e) => setEditTagName(e.target.value)}
                          className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit();
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                        />
                        <input
                          type="color"
                          value={editTagColor}
                          onChange={(e) => setEditTagColor(e.target.value)}
                          className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                        />
                        <button
                          onClick={handleSaveEdit}
                          disabled={updateTagMutation.isPending}
                          className="text-green-600 hover:text-green-700 text-sm"
                        >
                          ✓
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <>
                        <span
                          className="text-xs font-medium"
                          style={{ color: tag.color }}
                        >
                          {tag.name}
                        </span>
                        {canManage && (
                          <>
                            <button
                              onClick={() => handleStartEdit(tag)}
                              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xs"
                              title="Edit tag"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDelete(tag)}
                              disabled={deleteTagMutation.isPending}
                              className="text-gray-500 hover:text-red-600 text-xs"
                              title="Delete tag"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                No board-specific tags yet. Create one above!
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
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

