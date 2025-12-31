"use client";

import { useState } from "react";
import { SprintsList } from "./SprintsList";
import { CreateSprintModal } from "./CreateSprintModal";

interface SprintsViewProps {
  boardId: string;
}

export function SprintsView({ boardId }: SprintsViewProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Sprints
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            View and manage your sprints
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center justify-center gap-2 text-sm sm:text-base"
        >
          <span>📅</span>
          <span>Create Sprint</span>
        </button>
      </div>

      <SprintsList boardId={boardId} />

      {showCreateModal && (
        <CreateSprintModal
          boardId={boardId}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}

