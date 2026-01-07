"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface TaskSearchProps {
  boardId: string;
  onTaskSelect?: (taskId: string) => void;
}

export function TaskSearch({ boardId, onTaskSelect }: TaskSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["task-search", boardId, query],
    queryFn: async () => {
      if (!query || query.trim().length === 0) {
        return { tasks: [] };
      }
      const res = await fetch(`/api/tasks/search?boardId=${boardId}&q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Failed to search");
      return res.json() as Promise<{ tasks: Array<{ id: string; title: string; status: string }> }>;
    },
    enabled: query.trim().length > 0 && isOpen,
  });

  const tasks = data?.tasks || [];

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            // Delay to allow click events
            setTimeout(() => setIsOpen(false), 200);
          }}
          placeholder="Search tasks... (Cmd/Ctrl+K)"
          className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
      </div>

      {isOpen && query.trim().length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-sm text-gray-500">Searching...</div>
          ) : tasks.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No tasks found</div>
          ) : (
            <ul>
              {tasks.map((task) => (
                <li
                  key={task.id}
                  onClick={() => {
                    if (onTaskSelect) {
                      onTaskSelect(task.id);
                    }
                    setIsOpen(false);
                    setQuery("");
                  }}
                  className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                >
                  <div className="font-medium text-sm text-gray-900 dark:text-white">
                    {task.title}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Status: {task.status}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

