"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CustomFieldType } from "@prisma/client";

interface CustomFieldsDisplayProps {
  taskId: string;
  boardId: string;
  userBoardRole?: "ADMIN" | "MEMBER" | "VIEWER";
}

interface CustomField {
  id: string;
  name: string;
  type: CustomFieldType;
  required: boolean;
  options: any;
  isVisible: boolean;
}

interface TaskCustomField {
  id: string;
  value: any;
  customField: CustomField;
}

export function CustomFieldsDisplay({
  taskId,
  boardId,
  userBoardRole,
}: CustomFieldsDisplayProps) {
  const queryClient = useQueryClient();
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>(null);

  const { data: boardFields } = useQuery({
    queryKey: ["custom-fields", boardId],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${boardId}/custom-fields`);
      if (!res.ok) return [];
      return res.json() as Promise<CustomField[]>;
    },
  });

  const { data: taskFields } = useQuery({
    queryKey: ["task-custom-fields", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/custom-fields`);
      if (!res.ok) return [];
      return res.json() as Promise<TaskCustomField[]>;
    },
  });

  const updateFieldMutation = useMutation({
    mutationFn: async ({
      customFieldId,
      value,
    }: {
      customFieldId: string;
      value: any;
    }) => {
      const res = await fetch(`/api/tasks/${taskId}/custom-fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customFieldId, value }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update field");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-custom-fields", taskId] });
      setEditingFieldId(null);
      setEditValue(null);
    },
  });

  const canEdit = userBoardRole === "ADMIN" || userBoardRole === "MEMBER";
  const visibleFields = boardFields?.filter((f) => f.isVisible) || [];
  const taskFieldsMap = new Map(
    taskFields?.map((tf) => [tf.customField.id, tf]) || []
  );

  const handleSave = (customFieldId: string) => {
    updateFieldMutation.mutate({ customFieldId, value: editValue });
  };

  const renderFieldValue = (field: CustomField, value: any) => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400 italic">Not set</span>;
    }

    switch (field.type) {
      case "CHECKBOX":
        return value ? "✓ Yes" : "✗ No";
      case "DATE":
        return new Date(value).toLocaleDateString();
      case "NUMBER":
        return value.toString();
      default:
        return value.toString();
    }
  };

  const renderFieldInput = (field: CustomField, currentValue: any) => {
    const value = currentValue ?? (field.type === "CHECKBOX" ? false : "");

    switch (field.type) {
      case "TEXT":
      case "URL":
        return (
          <input
            type={field.type === "URL" ? "url" : "text"}
            value={value}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        );
      case "NUMBER":
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => setEditValue(parseFloat(e.target.value) || 0)}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        );
      case "DATE":
        return (
          <input
            type="date"
            value={value ? new Date(value).toISOString().split("T")[0] : ""}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        );
      case "DROPDOWN":
        const options = Array.isArray(field.options) ? field.options : [];
        return (
          <select
            value={value}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Select...</option>
            {options.map((opt: string) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      case "CHECKBOX":
        return (
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => setEditValue(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600"
          />
        );
      default:
        return null;
    }
  };

  if (visibleFields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
        Custom Fields
      </h3>
      <div className="space-y-2">
        {visibleFields.map((field) => {
          const taskField = taskFieldsMap.get(field.id);
          const isEditing = editingFieldId === field.id;

          return (
            <div key={field.id} className="flex items-start justify-between">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {field.name}
                  {field.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>
                {isEditing && canEdit ? (
                  <div className="space-y-2">
                    {renderFieldInput(field, taskField?.value)}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(field.id)}
                        className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingFieldId(null);
                          setEditValue(null);
                        }}
                        className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="text-sm text-gray-900 dark:text-white cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-1 rounded"
                    onClick={() => {
                      if (canEdit) {
                        setEditingFieldId(field.id);
                        setEditValue(taskField?.value ?? null);
                      }
                    }}
                  >
                    {renderFieldValue(field, taskField?.value)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

