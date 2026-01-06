"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface SprintPlannerProps {
  boardId: string;
  sprintId: string | null;
  onClose: () => void;
}

interface TaskInfo {
  id: string;
  title: string;
  priority: string;
  estimatedHours: number | null;
}

interface SprintSuggestion {
  goal: string;
  taskIds: string[];
  tasks?: TaskInfo[];
  reasoning: string;
}

export function SprintPlanner({
  boardId,
  sprintId,
  onClose,
}: SprintPlannerProps) {
  const [capacity, setCapacity] = useState("40");
  const [isPlanning, setIsPlanning] = useState(false);
  const [suggestion, setSuggestion] = useState<SprintSuggestion | null>(null);
  const queryClient = useQueryClient();

  const planSprintMutation = useMutation({
    mutationFn: async () => {
      if (!sprintId) {
        throw new Error("Sprint ID is required");
      }
      setIsPlanning(true);
      const res = await fetch("/api/ai/sprint-planning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId,
          sprintId,
          capacity: parseInt(capacity, 10),
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to plan sprint");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setIsPlanning(false);
      setSuggestion(data);
    },
    onError: (error) => {
      setIsPlanning(false);
      console.error("Sprint planning error:", error);
    },
  });

  const applySuggestionMutation = useMutation({
    mutationFn: async (taskIds: string[]) => {
      
      const results = await Promise.allSettled(
        taskIds.map((taskId) =>
          fetch(`/api/tasks/${taskId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sprintId }),
          }).then(async (res) => {
            if (!res.ok) {
              const error = await res.json();
              throw new Error(error.error || `Failed to update task ${taskId}`);
            }
            return res.json();
          })
        )
      );

      
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        const errorMessages = failures
          .map((f) => (f.status === "rejected" ? f.reason?.message : ""))
          .filter(Boolean);
        throw new Error(
          `Failed to update ${failures.length} task(s): ${errorMessages.join(
            ", "
          )}`
        );
      }

      return results;
    },
    onSuccess: (_data, _variables) => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      queryClient.invalidateQueries({ queryKey: ["sprints", boardId] });
      
      setTimeout(() => {
        onClose();
      }, 2000);
    },
    onError: (error) => {
      console.error("Failed to apply sprint plan:", error);
    },
  });

  const handlePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sprintId) {
      alert("Please create a sprint first");
      return;
    }
    planSprintMutation.mutate();
  };

  const handleApply = () => {
    if (!suggestion || suggestion.taskIds.length === 0) return;
    applySuggestionMutation.mutate(suggestion.taskIds);
  };

  if (!sprintId) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-md">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            AI Sprint Planner
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Please create a sprint first before using AI sprint planning.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-2xl">🚀</span>
            AI Sprint Planner
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          AI will analyze your backlog and suggest which tasks to include in
          this sprint based on priority, estimated hours, and your team
          capacity.
        </p>

        {!suggestion ? (
          <form onSubmit={handlePlan} className="space-y-4">
            <div>
              <label
                htmlFor="capacity"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Team Capacity (hours) *
              </label>
              <input
                id="capacity"
                type="number"
                required
                min="1"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="40"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Total available hours for this sprint
              </p>
            </div>

            {isPlanning && (
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>
                  AI is analyzing your backlog and planning the sprint...
                </span>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isPlanning}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPlanning || !capacity}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center gap-2"
              >
                {isPlanning ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Planning...
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    Plan Sprint
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                Sprint Goal
              </h3>
              <p className="text-blue-800 dark:text-blue-300">
                {suggestion.goal}
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Selected Tasks ({suggestion.taskIds.length})
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {suggestion.reasoning}
              </p>
              {suggestion.taskIds.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  No tasks selected. The backlog might be empty or tasks don't
                  fit the capacity.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {suggestion.taskIds.length} task
                    {suggestion.taskIds.length !== 1 ? "s" : ""} will be added
                    to this sprint:
                  </p>
                  {suggestion.tasks && suggestion.tasks.length > 0 ? (
                    <ul className="space-y-1 list-disc list-inside">
                      {suggestion.tasks.map((task) => (
                        <li
                          key={task.id}
                          className="text-sm text-gray-700 dark:text-gray-300"
                        >
                          <span className="font-medium">{task.title}</span>
                          {task.estimatedHours && (
                            <span className="text-gray-500 dark:text-gray-400 ml-2">
                              ({task.estimatedHours}h)
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                      Task details not available
                    </p>
                  )}
                  {applySuggestionMutation.isSuccess && (
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium mt-2">
                      ✓ Successfully assigned {suggestion.taskIds.length} task
                      {suggestion.taskIds.length !== 1 ? "s" : ""} to the
                      sprint!
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setSuggestion(null);
                  setCapacity("40");
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Plan Again
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={
                  applySuggestionMutation.isPending ||
                  suggestion.taskIds.length === 0
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {applySuggestionMutation.isPending
                  ? "Applying..."
                  : "Apply to Sprint"}
              </button>
            </div>

            {applySuggestionMutation.isError && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-600 dark:text-red-400 text-sm font-medium">
                  Error applying sprint plan
                </p>
                <p className="text-red-500 dark:text-red-500 text-xs mt-1">
                  {applySuggestionMutation.error?.message ||
                    "Failed to assign tasks to sprint. Please try again."}
                </p>
              </div>
            )}
          </div>
        )}

        {planSprintMutation.isError && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400 text-sm font-medium">
              Error planning sprint
            </p>
            <p className="text-red-500 dark:text-red-500 text-xs mt-1">
              {planSprintMutation.error?.message ||
                "Failed to plan sprint. Please try again."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
