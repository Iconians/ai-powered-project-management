"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RecurringTaskModal } from "./RecurringTaskModal";

interface RecurringTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  assigneeId: string | null;
  estimatedHours: number | null;
  pattern: string;
  interval: number;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  monthOfYear: number | null;
  startDate: string;
  endDate: string | null;
  nextOccurrence: string;
  isActive: boolean;
  assignee: {
    id: string;
    user: {
      id: string;
      name: string | null;
      email: string;
    };
  } | null;
}

interface RecurringTaskManagerProps {
  boardId: string;
  organizationId?: string;
  onClose: () => void;
}

export function RecurringTaskManager({
  boardId,
  organizationId,
  onClose,
}: RecurringTaskManagerProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState<RecurringTask | null>(null);
  const queryClient = useQueryClient();

  const { data: recurringTasks = [], isLoading } = useQuery<RecurringTask[]>({
    queryKey: ["recurring-tasks", boardId],
    queryFn: async () => {
      const res = await fetch(`/api/recurring-tasks?boardId=${boardId}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/recurring-tasks/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete recurring task");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-tasks", boardId] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/recurring-tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update recurring task");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-tasks", boardId] });
    },
  });

  const formatPattern = (task: RecurringTask) => {
    switch (task.pattern) {
      case "DAILY":
        return `Every ${task.interval} day${task.interval !== 1 ? "s" : ""}`;
      case "WEEKLY":
        if (task.dayOfWeek !== null) {
          const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          return `Every ${task.interval} week${task.interval !== 1 ? "s" : ""} on ${days[task.dayOfWeek]}`;
        }
        return `Every ${task.interval} week${task.interval !== 1 ? "s" : ""}`;
      case "MONTHLY":
        if (task.dayOfMonth !== null) {
          return `Monthly on day ${task.dayOfMonth}`;
        }
        return `Every ${task.interval} month${task.interval !== 1 ? "s" : ""}`;
      case "YEARLY":
        if (task.monthOfYear !== null && task.dayOfMonth !== null) {
          const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
          return `Yearly on ${months[task.monthOfYear]} ${task.dayOfMonth}`;
        }
        return `Every ${task.interval} year${task.interval !== 1 ? "s" : ""}`;
      default:
        return `Custom (every ${task.interval} days)`;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Recurring Tasks
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + Create Recurring Task
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : recurringTasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No recurring tasks. Create one to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {recurringTasks.map((task) => (
              <div
                key={task.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {task.title}
                      </h3>
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          task.isActive
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {task.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {task.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>{formatPattern(task)}</span>
                      <span>Priority: {task.priority}</span>
                      {task.assignee && (
                        <span>
                          Assignee: {task.assignee.user.name || task.assignee.user.email}
                        </span>
                      )}
                      {task.estimatedHours && (
                        <span>Est: {task.estimatedHours}h</span>
                      )}
                      <span>
                        Next: {new Date(task.nextOccurrence).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => setEditingTask(task)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() =>
                        toggleActiveMutation.mutate({ id: task.id, isActive: task.isActive })
                      }
                      disabled={toggleActiveMutation.isPending}
                      className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                    >
                      {task.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this recurring task?")) {
                          deleteMutation.mutate(task.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showCreateModal && (
          <RecurringTaskModal
            boardId={boardId}
            organizationId={organizationId}
            onClose={() => setShowCreateModal(false)}
          />
        )}

        {editingTask && (
          <RecurringTaskModal
            boardId={boardId}
            organizationId={organizationId}
            task={editingTask}
            onClose={() => setEditingTask(null)}
          />
        )}
      </div>
    </div>
  );
}
