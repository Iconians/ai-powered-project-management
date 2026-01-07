"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface TaskDependency {
  id: string;
  dependsOnId: string;
  type: string;
  dependsOn: {
    id: string;
    title: string;
    status: string;
    priority: string;
  };
}

interface TaskDependenciesProps {
  taskId: string;
  boardId: string;
  userBoardRole?: "ADMIN" | "MEMBER" | "VIEWER";
}

export function TaskDependencies({
  taskId,
  boardId,
  userBoardRole,
}: TaskDependenciesProps) {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [dependencyType, setDependencyType] = useState("BLOCKS");

  const { data, isLoading } = useQuery({
    queryKey: ["task-dependencies", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/dependencies`);
      if (!res.ok) throw new Error("Failed to fetch dependencies");
      return res.json() as Promise<{
        dependencies: TaskDependency[];
        blockedBy: TaskDependency[];
      }>;
    },
  });

  const { data: boardTasks, isLoading: isLoadingTasks } = useQuery({
    queryKey: ["board-tasks", boardId],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${boardId}`);
      if (!res.ok) throw new Error("Failed to fetch board");
      const board = await res.json();
      // Ensure we always return an array
      const tasks = Array.isArray(board?.tasks) ? board.tasks : [];
      console.log("Fetched tasks for dependencies:", tasks.length, tasks);
      return tasks;
    },
    enabled: !!boardId,
  });

  const createDependencyMutation = useMutation({
    mutationFn: async ({
      dependsOnId,
      type,
    }: {
      dependsOnId: string;
      type: string;
    }) => {
      const res = await fetch(`/api/tasks/${taskId}/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependsOnId, type }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create dependency");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-dependencies", taskId] });
      // Use refetchQueries instead of invalidateQueries to ensure data is fresh
      queryClient.refetchQueries({ queryKey: ["board", boardId] });
      queryClient.invalidateQueries({ queryKey: ["board-tasks", boardId] });
      setShowAddModal(false);
      setSelectedTaskId("");
    },
  });

  const deleteDependencyMutation = useMutation({
    mutationFn: async (dependsOnId: string) => {
      const res = await fetch(
        `/api/tasks/${taskId}/dependencies?dependsOnId=${dependsOnId}`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete dependency");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-dependencies", taskId] });
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
  });

  const canEdit = userBoardRole === "ADMIN" || userBoardRole === "MEMBER";

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading dependencies...</div>;
  }

  const dependencies = data?.dependencies || [];
  const blockedBy = data?.blockedBy || [];

  // Filter out current task from available tasks
  const availableTasks = Array.isArray(boardTasks)
    ? boardTasks.filter((t: { id: string }) => t.id !== taskId)
    : [];

  console.log("Available tasks for dependency:", availableTasks.length, availableTasks);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
          Dependencies
        </h3>
        {canEdit && (
          <button
            onClick={() => setShowAddModal(true)}
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Add
          </button>
        )}
      </div>

      {blockedBy.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Blocked by:
          </h4>
          <div className="space-y-1">
            {blockedBy.map((dep) => {
              const isComplete = dep.dependsOn.status === "DONE";
              return (
                <div
                  key={dep.id}
                  className={`text-xs p-2 rounded ${
                    isComplete
                      ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
                      : "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>
                      {isComplete ? "✓" : "⏳"} {dep.dependsOn.title}
                    </span>
                    {canEdit && (
                      <button
                        onClick={() => deleteDependencyMutation.mutate(dep.dependsOnId)}
                        className="text-red-600 hover:text-red-700 ml-2"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {dependencies.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Depends on:
          </h4>
          <div className="space-y-1">
            {dependencies.map((dep) => {
              const isComplete = dep.dependsOn.status === "DONE";
              return (
                <div
                  key={dep.id}
                  className={`text-xs p-2 rounded ${
                    isComplete
                      ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
                      : "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>
                      {isComplete ? "✓" : "⏳"} {dep.dependsOn.title} ({dep.type})
                    </span>
                    {canEdit && (
                      <button
                        onClick={() =>
                          deleteDependencyMutation.mutate(dep.dependsOnId)
                        }
                        className="text-red-600 hover:text-red-700 ml-2"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {dependencies.length === 0 && blockedBy.length === 0 && (
        <p className="text-xs text-gray-500">No dependencies</p>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">
              Add Dependency
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Task
                </label>
                <select
                  value={selectedTaskId}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  disabled={isLoadingTasks}
                >
                  <option value="">
                    {isLoadingTasks ? "Loading tasks..." : "Select a task"}
                  </option>
                  {availableTasks.map((task: { id: string; title: string }) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type
                </label>
                <select
                  value={dependencyType}
                  onChange={(e) => setDependencyType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="BLOCKS">Blocks</option>
                  <option value="RELATED">Related</option>
                  <option value="DUPLICATE">Duplicate</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedTaskId("");
                  }}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (selectedTaskId) {
                      createDependencyMutation.mutate({
                        dependsOnId: selectedTaskId,
                        type: dependencyType,
                      });
                    }
                  }}
                  disabled={!selectedTaskId || createDependencyMutation.isPending}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

