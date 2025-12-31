"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TaskGenerator } from "../ai/TaskGenerator";
import { SprintPlanner } from "../ai/SprintPlanner";
import { CreateSprintModal } from "../sprints/CreateSprintModal";

interface BoardHeaderProps {
  boardId: string;
  boardName: string;
  boardDescription?: string | null;
  activeTab?: "board" | "sprints";
  onTabChange?: (tab: "board" | "sprints") => void;
}

export function BoardHeader({ boardId, boardName, boardDescription, activeTab = "board", onTabChange }: BoardHeaderProps) {
  const [showTaskGenerator, setShowTaskGenerator] = useState(false);
  const [showSprintPlanner, setShowSprintPlanner] = useState(false);
  const [showCreateSprint, setShowCreateSprint] = useState(false);

  // Fetch active sprint
  const { data: activeSprint } = useQuery({
    queryKey: ["sprints", boardId, "active"],
    queryFn: async () => {
      const res = await fetch(`/api/sprints?boardId=${boardId}&isActive=true`);
      if (!res.ok) return null;
      const sprints = await res.json();
      return sprints.length > 0 ? sprints[0] : null;
    },
  });

  return (
    <>
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
              {boardName}
            </h1>
            {boardDescription && (
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                {boardDescription}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowCreateSprint(true)}
              className="px-2 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center gap-1 sm:gap-2 shadow-md transition-all text-xs sm:text-sm"
            >
              <span>📅</span>
              <span className="hidden xs:inline">Create Sprint</span>
            </button>
            <button
              onClick={() => setShowTaskGenerator(true)}
              className="px-2 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 flex items-center gap-1 sm:gap-2 shadow-md transition-all text-xs sm:text-sm"
            >
              <span>✨</span>
              <span className="hidden sm:inline">AI Generate Tasks</span>
            </button>
            <button
              onClick={() => setShowSprintPlanner(true)}
              className="px-2 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 flex items-center gap-1 sm:gap-2 shadow-md transition-all text-xs sm:text-sm"
            >
              <span>🚀</span>
              <span className="hidden sm:inline">AI Plan Sprint</span>
            </button>
            <a
              href="/boards"
              className="px-2 sm:px-4 py-1.5 sm:py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors text-xs sm:text-sm whitespace-nowrap"
            >
              ← Back
            </a>
          </div>
        </div>
        
        {/* Tabs */}
        {onTabChange && (
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
            <button
              onClick={() => onTabChange("board")}
              className={`px-3 sm:px-4 py-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeTab === "board"
                  ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              📋 Board
            </button>
            <button
              onClick={() => onTabChange("sprints")}
              className={`px-3 sm:px-4 py-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeTab === "sprints"
                  ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              📅 Sprints
            </button>
          </div>
        )}
      </div>

      {showTaskGenerator && (
        <TaskGenerator
          boardId={boardId}
          onClose={() => setShowTaskGenerator(false)}
        />
      )}

      {showCreateSprint && (
        <CreateSprintModal
          boardId={boardId}
          onClose={() => setShowCreateSprint(false)}
        />
      )}

      {showSprintPlanner && (
        <SprintPlanner
          boardId={boardId}
          sprintId={activeSprint?.id || null}
          onClose={() => setShowSprintPlanner(false)}
        />
      )}
    </>
  );
}

