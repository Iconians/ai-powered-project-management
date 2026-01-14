"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

interface TaskSearchProps {
  boardId: string;
  onTaskSelect?: (taskId: string) => void;
  onSearchChange?: (query: string) => void;
  searchQuery?: string;
}

export function TaskSearch({ boardId, onTaskSelect, onSearchChange, searchQuery: externalQuery }: TaskSearchProps) {
  const [query, setQuery] = useState(externalQuery || "");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with external query
  const searchQuery = externalQuery !== undefined ? externalQuery : query;

  const { data, isLoading } = useQuery({
    queryKey: ["task-search", boardId, searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.trim().length === 0) {
        return { tasks: [] };
      }
      const res = await fetch(`/api/tasks/search?boardId=${boardId}&q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error("Failed to search");
      return res.json() as Promise<{ tasks: Array<{ id: string; title: string; status: string }> }>;
    },
    enabled: searchQuery.trim().length > 0 && isOpen,
  });

  const tasks = data?.tasks || [];

  // Keyboard shortcut handler (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      const isModifierPressed = event.metaKey || event.ctrlKey;
      if (isModifierPressed && event.key.toLowerCase() === "k") {
        // Prevent browser's default Cmd+K behavior (browser search)
        event.preventDefault();
        // Focus the search input
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            const newQuery = e.target.value;
            setQuery(newQuery);
            if (onSearchChange) {
              onSearchChange(newQuery);
            }
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            // Delay to allow click events
            setTimeout(() => setIsOpen(false), 200);
          }}
          placeholder="Search tasks... (Cmd/Ctrl+K)"
          className="w-full px-3 xs:px-4 py-1.5 xs:py-2 pl-8 xs:pl-10 text-sm xs:text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
      </div>

      {isOpen && searchQuery.trim().length > 0 && (
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
                    if (onSearchChange) {
                      onSearchChange("");
                    }
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

