"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useRealtime } from "@/hooks/useRealtime";
import { EditSprintModal } from "./EditSprintModal";

interface Sprint {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  goal: string | null;
  isActive: boolean;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    estimatedHours: number | null;
    actualHours: number | null;
  }>;
}

interface SprintsListProps {
  boardId: string;
  userBoardRole?: "ADMIN" | "MEMBER" | "VIEWER";
}

export function SprintsList({ boardId, userBoardRole }: SprintsListProps) {
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [deletingSprintId, setDeletingSprintId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: sprints, isLoading } = useQuery<Sprint[]>({
    queryKey: ["sprints", boardId],
    queryFn: async () => {
      const res = await fetch(`/api/sprints?boardId=${boardId}`);
      if (!res.ok) throw new Error("Failed to fetch sprints");
      return res.json();
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Real-time updates for sprint changes
  useRealtime({
    channelName: `board-${boardId}`,
    eventName: "sprint-created",
    callback: () => {
      queryClient.invalidateQueries({ queryKey: ["sprints", boardId] });
    },
  });

  useRealtime({
    channelName: `board-${boardId}`,
    eventName: "sprint-updated",
    callback: () => {
      queryClient.invalidateQueries({ queryKey: ["sprints", boardId] });
    },
  });

  useRealtime({
    channelName: `board-${boardId}`,
    eventName: "sprint-deleted",
    callback: () => {
      queryClient.invalidateQueries({ queryKey: ["sprints", boardId] });
    },
  });

  const deleteSprintMutation = useMutation({
    mutationFn: async (sprintId: string) => {
      const res = await fetch(`/api/sprints/${sprintId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete sprint");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sprints", boardId] });
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      setDeletingSprintId(null);
    },
  });

  const handleDelete = (sprintId: string) => {
    if (confirm("Are you sure you want to delete this sprint? Tasks assigned to this sprint will not be deleted, but will be removed from the sprint.")) {
      setDeletingSprintId(sprintId);
      deleteSprintMutation.mutate(sprintId);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 text-gray-600 dark:text-gray-400">
        Loading sprints...
      </div>
    );
  }

  if (!sprints || sprints.length === 0) {
    return (
      <div className="p-4 text-center text-gray-600 dark:text-gray-400">
        <p className="mb-2">No sprints yet.</p>
        <p className="text-sm">Create your first sprint to get started!</p>
      </div>
    );
  }

  const now = new Date();

  return (
    <div className="space-y-3">
      {sprints.map((sprint) => {
        const startDate = new Date(sprint.startDate);
        const endDate = new Date(sprint.endDate);
        const isCurrent = sprint.isActive;
        const isUpcoming = startDate > now;
        const isPast = endDate < now;
        const isOngoing = startDate <= now && endDate >= now && !isPast;

        const statusBadge = isCurrent ? (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            Active
          </span>
        ) : isOngoing ? (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            Ongoing
          </span>
        ) : isUpcoming ? (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            Upcoming
          </span>
        ) : (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
            Completed
          </span>
        );

        const completedTasks = sprint.tasks.filter((t) => t.status === "DONE").length;
        const totalTasks = sprint.tasks.length;
        const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        
        // Calculate total estimated and actual hours
        const totalEstimatedHours = sprint.tasks.reduce((sum, task) => sum + (task.estimatedHours || 0), 0);
        const totalActualHours = sprint.tasks.reduce((sum, task) => sum + (task.actualHours || 0), 0);

        return (
          <div
            key={sprint.id}
            className={`p-3 sm:p-4 rounded-lg border-2 ${
              isCurrent
                ? "bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-600"
                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            }`}
          >
            <div className="flex items-start justify-between mb-2 gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white truncate">
                    {sprint.name}
                  </h3>
                  {statusBadge}
                </div>
                {userBoardRole !== "VIEWER" && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <button
                      onClick={() => setEditingSprint(sprint)}
                      className="text-xs px-2 py-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDelete(sprint.id)}
                      disabled={deleteSprintMutation.isPending && deletingSprintId === sprint.id}
                      className="text-xs px-2 py-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                )}
                {sprint.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {sprint.description}
                  </p>
                )}
                {sprint.goal && (
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
                    🎯 {sprint.goal}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span className="whitespace-nowrap">
                  📅 {format(startDate, "MMM d")} - {format(endDate, "MMM d, yyyy")}
                </span>
                <span className="hidden sm:inline">•</span>
                <span className="whitespace-nowrap">
                  {totalTasks} task{totalTasks !== 1 ? "s" : ""} ({completedTasks} done)
                </span>
                {totalEstimatedHours > 0 && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span className="whitespace-nowrap">
                      ⏱️ {totalEstimatedHours}h estimated
                      {totalActualHours > 0 && ` (${totalActualHours}h actual)`}
                    </span>
                  </>
                )}
              </div>

              {sprint.tasks.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tasks:</p>
                  <ul className="space-y-1">
                    {sprint.tasks.map((task) => (
                      <li key={task.id} className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${
                          task.status === "DONE" ? "bg-green-500" :
                          task.status === "IN_PROGRESS" ? "bg-blue-500" :
                          task.status === "BLOCKED" ? "bg-red-500" :
                          "bg-gray-400"
                        }`} />
                        <span className={task.status === "DONE" ? "line-through text-gray-400" : ""}>
                          {task.title}
                        </span>
                        {task.estimatedHours && (
                          <span className="text-gray-500 dark:text-gray-500 ml-auto">
                            {task.estimatedHours}h
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {totalTasks > 0 && (
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}

      {editingSprint && (
        <EditSprintModal
          sprint={editingSprint}
          boardId={boardId}
          onClose={() => setEditingSprint(null)}
        />
      )}

      {deleteSprintMutation.isError && (
        <div className="fixed bottom-4 right-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 shadow-lg z-50">
          <p className="text-red-600 dark:text-red-400 text-sm font-medium">
            Error deleting sprint
          </p>
          <p className="text-red-500 dark:text-red-500 text-xs mt-1">
            {deleteSprintMutation.error?.message || "Failed to delete sprint. Please try again."}
          </p>
        </div>
      )}
    </div>
  );
}

