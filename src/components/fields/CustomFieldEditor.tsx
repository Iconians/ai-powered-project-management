"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CustomFieldType } from "@prisma/client";

interface CustomFieldEditorProps {
  boardId: string;
  userBoardRole?: "ADMIN" | "MEMBER" | "VIEWER";
}

interface CustomField {
  id: string;
  name: string;
  type: CustomFieldType;
  required: boolean;
  options: any;
  order: number;
  isVisible: boolean;
}

export function CustomFieldEditor({
  boardId,
  userBoardRole,
}: CustomFieldEditorProps) {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "TEXT" as CustomFieldType,
    required: false,
    options: null as any,
    isVisible: true,
  });

  const { data: customFields, isLoading } = useQuery({
    queryKey: ["custom-fields", boardId],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${boardId}/custom-fields`);
      if (!res.ok) throw new Error("Failed to fetch custom fields");
      return res.json() as Promise<CustomField[]>;
    },
  });

  const createFieldMutation = useMutation({
    mutationFn: async (data: Partial<CustomField>) => {
      const res = await fetch(`/api/boards/${boardId}/custom-fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create field");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-fields", boardId] });
      setShowAddModal(false);
      resetForm();
    },
  });

  const updateFieldMutation = useMutation({
    mutationFn: async ({
      fieldId,
      data,
    }: {
      fieldId: string;
      data: Partial<CustomField>;
    }) => {
      const res = await fetch(`/api/boards/${boardId}/custom-fields`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldId, ...data }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update field");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-fields", boardId] });
      setEditingField(null);
      resetForm();
    },
  });

  const deleteFieldMutation = useMutation({
    mutationFn: async (fieldId: string) => {
      const res = await fetch(
        `/api/boards/${boardId}/custom-fields?fieldId=${fieldId}`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete field");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-fields", boardId] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      type: "TEXT",
      required: false,
      options: null,
      isVisible: true,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingField) {
      updateFieldMutation.mutate({
        fieldId: editingField.id,
        data: formData,
      });
    } else {
      createFieldMutation.mutate(formData);
    }
  };

  const canEdit = userBoardRole === "ADMIN";

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading custom fields...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
          Custom Fields
        </h3>
        {canEdit && (
          <button
            onClick={() => {
              setEditingField(null);
              resetForm();
              setShowAddModal(true);
            }}
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Add Field
          </button>
        )}
      </div>

      <div className="space-y-2">
        {customFields && customFields.length > 0 ? (
          customFields.map((field) => (
            <div
              key={field.id}
              className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded"
            >
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {field.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {field.type} {field.required && "(Required)"}
                </div>
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingField(field);
                      setFormData({
                        name: field.name,
                        type: field.type,
                        required: field.required,
                        options: field.options,
                        isVisible: field.isVisible,
                      });
                      setShowAddModal(true);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete field "${field.name}"?`)) {
                        deleteFieldMutation.mutate(field.id);
                      }
                    }}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="text-xs text-gray-500">No custom fields</p>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">
              {editingField ? "Edit Custom Field" : "Add Custom Field"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value as CustomFieldType,
                      options: e.target.value === "DROPDOWN" ? [] : null,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {Object.values(CustomFieldType).map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {formData.type === "DROPDOWN" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Options (one per line)
                  </label>
                  <textarea
                    value={
                      Array.isArray(formData.options)
                        ? formData.options.join("\n")
                        : ""
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        options: e.target.value
                          .split("\n")
                          .filter((v) => v.trim()),
                      })
                    }
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              )}

              <div className="flex items-center gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.required}
                    onChange={(e) =>
                      setFormData({ ...formData, required: e.target.checked })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Required
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isVisible}
                    onChange={(e) =>
                      setFormData({ ...formData, isVisible: e.target.checked })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Visible
                  </span>
                </label>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingField(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    createFieldMutation.isPending ||
                    updateFieldMutation.isPending
                  }
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {editingField ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

