"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TaskPriority } from "@prisma/client";

interface Template {
  id?: string;
  name: string;
  description?: string | null;
  title: string;
  taskDescription?: string | null;
  priority: TaskPriority;
  estimatedHours?: number | null;
  checklistItems?: Array<{ text: string; isCompleted: boolean }> | null;
  tags?: string[];
}

interface TemplateEditorProps {
  boardId: string;
  organizationId?: string;
  template?: Template | null;
  onClose: () => void;
}

export function TemplateEditor({
  boardId,
  organizationId,
  template,
  onClose,
}: TemplateEditorProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [checklistItems, setChecklistItems] = useState<Array<{ text: string; isCompleted: boolean }>>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || "");
      setTitle(template.title);
      setTaskDescription(template.taskDescription || "");
      setPriority(template.priority);
      setEstimatedHours(template.estimatedHours?.toString() || "");
      setChecklistItems(Array.isArray(template.checklistItems) ? template.checklistItems : []);
      setTags(template.tags || []);
    }
  }, [template]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create template");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates", boardId, organizationId] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !title.trim()) {
      alert("Name and task title are required");
      return;
    }

    createMutation.mutate({
      name,
      description: description || null,
      organizationId,
      boardId,
      title,
      taskDescription: taskDescription || null,
      priority,
      estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
      checklistItems: checklistItems.length > 0 ? checklistItems : null,
      tags,
    });
  };

  const addChecklistItem = () => {
    if (newChecklistItem.trim()) {
      setChecklistItems([...checklistItems, { text: newChecklistItem, isCompleted: false }]);
      setNewChecklistItem("");
    }
  };

  const removeChecklistItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 xs:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 xs:p-4 sm:p-6 max-w-2xl w-full mx-2 xs:mx-4 max-h-[95vh] xs:max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          {template ? "Edit Template" : "Create Template"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Template Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g., Bug Report Template"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Template Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Description of when to use this template"
            />
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Task Details
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Default task title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Task Description
                </label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Default task description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Estimated Hours
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., 4.5"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Checklist Items
            </label>
            <div className="space-y-2 mb-2">
              {checklistItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item.text}
                    onChange={(e) => {
                      const newItems = [...checklistItems];
                      newItems[index].text = e.target.value;
                      setChecklistItems(newItems);
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => removeChecklistItem(index)}
                    className="px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addChecklistItem();
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Add checklist item..."
              />
              <button
                type="button"
                onClick={addChecklistItem}
                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm flex items-center gap-1"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-blue-600"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Add tag..."
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? "Creating..." : "Create Template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
