"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TaskStatus, TaskPriority } from "@prisma/client";

interface FilterState {
  assigneeId?: string;
  status?: string;
  priority?: string;
  tagId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  searchQuery?: string;
}

interface TaskFiltersProps {
  boardId: string;
  onFilterChange: (filters: FilterState) => void;
  filters?: FilterState;
}

export function TaskFilters({ boardId, onFilterChange, filters: externalFilters = {} }: TaskFiltersProps) {
  const [filters, setFilters] = useState<FilterState>(externalFilters);
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: boardData } = useQuery({
    queryKey: ["board", boardId],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${boardId}`);
      if (!res.ok) throw new Error("Failed to fetch board");
      return res.json();
    },
  });

  const { data: tags } = useQuery({
    queryKey: ["tags", boardId],
    queryFn: async () => {
      const res = await fetch(`/api/tags?boardId=${boardId}`);
      if (!res.ok) throw new Error("Failed to fetch tags");
      return res.json();
    },
  });

  const members = boardData?.members || [];

  // Sync with external filters
  const currentFilters = externalFilters || filters;

  const updateFilter = (key: keyof FilterState, value: string | undefined) => {
    const newFilters = { ...currentFilters, [key]: value || undefined };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    const emptyFilters: FilterState = {};
    setFilters(emptyFilters);
    onFilterChange(emptyFilters);
  };

  const hasActiveFilters = Object.values(currentFilters).some((v) => v !== undefined && v !== "");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          {isExpanded ? "▼" : "▶"} Filters {hasActiveFilters && "●"}
        </button>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700"
          >
            Clear all
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 xs:gap-3 sm:gap-4 p-2 xs:p-3 sm:p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={currentFilters.status || ""}
              onChange={(e) => updateFilter("status", e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All</option>
              {Object.values(TaskStatus).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Priority
            </label>
            <select
              value={currentFilters.priority || ""}
              onChange={(e) => updateFilter("priority", e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All</option>
              {Object.values(TaskPriority).map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Assignee
            </label>
            <select
              value={currentFilters.assigneeId || ""}
              onChange={(e) => updateFilter("assigneeId", e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All</option>
              {members.map((member: { id: string; member: { user: { name: string | null; email: string } } }) => (
                <option key={member.id} value={member.id}>
                  {member.member.user.name || member.member.user.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tag
            </label>
            <select
              value={currentFilters.tagId || ""}
              onChange={(e) => updateFilter("tagId", e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All</option>
              {tags?.map((tag: { id: string; name: string }) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Due Date From
            </label>
            <input
              type="date"
              value={currentFilters.dueDateFrom || ""}
              onChange={(e) => updateFilter("dueDateFrom", e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Due Date To
            </label>
            <input
              type="date"
              value={currentFilters.dueDateTo || ""}
              onChange={(e) => updateFilter("dueDateTo", e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}

