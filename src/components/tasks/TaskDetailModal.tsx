"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { EditTaskModal } from "./EditTaskModal";
import { TagSelector } from "./TagSelector";
import { TaskChecklist } from "./TaskChecklist";
import { TaskDependencies } from "./TaskDependencies";
import { TimeTracker } from "./TimeTracker";
import { CustomFieldsDisplay } from "./CustomFieldsDisplay";

interface TaskDetailModalProps {
  taskId: string;
  boardId: string;
  organizationId?: string;
  userBoardRole?: "ADMIN" | "MEMBER" | "VIEWER";
  onClose: () => void;
}

export function TaskDetailModal({
  taskId,
  boardId,
  organizationId,
  userBoardRole,
  onClose,
}: TaskDetailModalProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"details" | "checklist" | "dependencies" | "time">("details");
  const [showEditModal, setShowEditModal] = useState(false);

  const { data: task, isLoading } = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) throw new Error("Failed to fetch task");
      return res.json();
    },
  });

  const { data: watchers } = useQuery({
    queryKey: ["task-watchers", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/watchers`);
      if (!res.ok) throw new Error("Failed to fetch watchers");
      return res.json();
    },
  });

  const watchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/watchers`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to watch task");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-watchers", taskId] });
    },
  });

  const unwatchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/watchers`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to unwatch task");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-watchers", taskId] });
    },
  });

  const cloneMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          includeSubtasks: true,
          includeChecklist: true,
          includeTags: true,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to clone task");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      alert("Task cloned successfully!");
    },
  });

  // Check if user is watching
  const currentUserId = session?.user?.id;
  const userIsWatching = watchers?.some((w: { userId: string }) => w.userId === currentUserId);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4">
          <div className="text-center">Loading task...</div>
        </div>
      </div>
    );
  }

  if (!task) {
    return null;
  }

  const canEdit = userBoardRole === "ADMIN" || userBoardRole === "MEMBER";

  return (
    <>
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4"
        onClick={(e) => {
          // Close modal when clicking backdrop
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div 
          className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-start justify-between z-10">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {task.title}
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                  {task.status}
                </span>
                <span className="text-xs px-2 py-1 rounded bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200">
                  {task.priority}
                </span>
                {task.assignee && (
                  <span className="text-xs px-2 py-1 rounded bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                    👤 {task.assignee.user?.name || task.assignee.user?.email}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              {canEdit && (
                <>
                  <button
                    onClick={() => {
                      if (userIsWatching) {
                        unwatchMutation.mutate();
                      } else {
                        watchMutation.mutate();
                      }
                    }}
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    title={userIsWatching ? "Unwatch" : "Watch"}
                  >
                    {userIsWatching ? "👁️ Watching" : "👁️ Watch"}
                  </button>
                  <button
                    onClick={() => cloneMutation.mutate()}
                    disabled={cloneMutation.isPending}
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                    title="Clone task"
                  >
                    📋 Clone
                  </button>
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Edit
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-4">
            <div className="flex gap-4">
              {["details", "checklist", "dependencies", "time"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 ${
                    activeTab === tab
                      ? "border-blue-600 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {activeTab === "details" && (
              <div className="space-y-6">
                {task.description && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description
                    </h3>
                    <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                      {task.description}
                    </p>
                  </div>
                )}

                {organizationId && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tags
                    </h3>
                    <TagSelector
                      taskId={taskId}
                      boardId={boardId}
                      organizationId={organizationId}
                      userBoardRole={userBoardRole}
                    />
                  </div>
                )}

                {task.dueDate && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Due Date
                    </h3>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {new Date(task.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {(task.estimatedHours || task.actualHours) && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Time
                    </h3>
                    <div className="text-sm text-gray-900 dark:text-white space-y-1">
                      {task.estimatedHours && (
                        <div>Estimated: {task.estimatedHours}h</div>
                      )}
                      {task.actualHours && (
                        <div>Actual: {task.actualHours.toFixed(2)}h</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "checklist" && (
              <TaskChecklist
                taskId={taskId}
                boardId={boardId}
                userBoardRole={userBoardRole}
              />
            )}

            {activeTab === "dependencies" && (
              <TaskDependencies
                taskId={taskId}
                boardId={boardId}
                userBoardRole={userBoardRole}
              />
            )}

            {activeTab === "time" && (
              <TimeTracker
                taskId={taskId}
                boardId={boardId}
                userBoardRole={userBoardRole}
              />
            )}

            {activeTab === "details" && (
              <CustomFieldsDisplay
                taskId={taskId}
                boardId={boardId}
                userBoardRole={userBoardRole}
              />
            )}
          </div>
        </div>
      </div>

      {showEditModal && (
        <EditTaskModal
          taskId={taskId}
          boardId={boardId}
          currentTitle={task.title}
          currentDescription={task.description}
          onClose={() => {
            setShowEditModal(false);
            queryClient.invalidateQueries({ queryKey: ["task", taskId] });
          }}
        />
      )}
    </>
  );
}

