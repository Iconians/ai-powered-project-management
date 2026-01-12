"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TaskPriority } from "@prisma/client";

interface Template {
  id: string;
  name: string;
  description: string | null;
  title: string;
  taskDescription: string | null;
  priority: TaskPriority;
  estimatedHours: number | null;
  checklistItems: any;
  tags: string[];
}

interface TemplateSelectorProps {
  boardId: string;
  organizationId?: string;
  onSelect: (template: Template) => void;
  onClose: () => void;
}

export function TemplateSelector({
  boardId,
  organizationId,
  onSelect,
  onClose,
}: TemplateSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["templates", boardId, organizationId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (boardId) params.append("boardId", boardId);
      if (organizationId) params.append("organizationId", organizationId);
      const res = await fetch(`/api/templates?${params.toString()}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const filteredTemplates = templates.filter((template) =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Select Template
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading templates...</div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchQuery ? "No templates found" : "No templates available"}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => {
                  onSelect(template);
                  onClose();
                }}
                className="w-full text-left p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="font-medium text-gray-900 dark:text-white mb-1">
                  {template.name}
                </div>
                {template.description && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    {template.description}
                  </div>
                )}
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  <div>Task: {template.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                      {template.priority}
                    </span>
                    {template.estimatedHours && (
                      <span className="text-xs text-gray-500">
                        {template.estimatedHours}h
                      </span>
                    )}
                    {template.tags && template.tags.length > 0 && (
                      <span className="text-xs text-gray-500">
                        {template.tags.length} tag{template.tags.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
