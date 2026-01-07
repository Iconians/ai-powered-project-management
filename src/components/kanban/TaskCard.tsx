"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import type { TaskStatus } from "@prisma/client";
import { AssignTaskModal } from "../tasks/AssignTaskModal";
import { EditTaskModal } from "../tasks/EditTaskModal";
import { TaskDetailModal } from "../tasks/TaskDetailModal";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: string;
  assigneeId: string | null;
  assignee: {
    id: string;
    userId: string;
    role: string;
    user: {
      id: string;
      name: string | null;
      email: string;
    };
  } | null;
  order: number;
  tags?: Array<{
    tag: {
      id: string;
      name: string;
      color: string;
    };
  }>;
  dependencies?: Array<{
    dependsOn: {
      id: string;
      title: string;
      status: string;
    };
  }>;
  dependsOn?: Array<{
    task: {
      id: string;
      title: string;
      status: string;
    };
  }>;
}

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
  boardId: string;
  organizationId?: string;
  userBoardRole?: "ADMIN" | "MEMBER" | "VIEWER";
}

const priorityColors = {
  LOW: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  MEDIUM: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  URGENT: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export function TaskCard({
  task,
  isDragging = false,
  boardId,
  organizationId,
  userBoardRole,
}: TaskCardProps) {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const queryClient = useQueryClient();

  // Check if task is blocked by dependencies
  const { data: dependencies } = useQuery({
    queryKey: ["task-dependencies", task.id],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${task.id}/dependencies`);
      if (!res.ok) return { dependencies: [], blockedBy: [] };
      return res.json();
    },
    enabled: showDetailModal,
  });

  const isBlocked =
    dependencies?.blockedBy?.some(
      (dep: { dependsOn: { status: string } }) =>
        dep.dependsOn.status !== "DONE"
    ) || false;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  const showAssignee =
    (task.status === "IN_PROGRESS" || task.status === "IN_REVIEW") &&
    task.assignee;
  const assigneeName =
    task.assignee?.user?.name ||
    task.assignee?.user?.email?.split("@")[0] ||
    "Unassigned";
  const canAssign =
    (task.status === "IN_PROGRESS" || task.status === "IN_REVIEW") &&
    userBoardRole !== "VIEWER";

  const handleAssigneeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAssignModal(true);
  };

  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete task");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${task.title}"?`)) {
      deleteTaskMutation.mutate();
    }
  };

  const isViewer = userBoardRole === "VIEWER";
  const isDone = task.status === "DONE";
  const canDelete =
    isDone &&
    !isViewer &&
    (userBoardRole === "ADMIN" || userBoardRole === "MEMBER");
  const canEdit =
    !isViewer && (userBoardRole === "ADMIN" || userBoardRole === "MEMBER");

  const duplicateTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${task.title} (Copy)`,
          description: task.description,
          boardId,
          status: task.status,
          priority: task.priority,
          assigneeId: null, // Don't copy assignee
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to duplicate task");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
  });

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateTaskMutation.mutate();
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowEditModal(true);
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,

        touchAction: isViewer ? "auto" : "pan-y",
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
      {...(isViewer ? {} : { ...attributes, ...listeners })}
      className={`bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow ${
        isDragging ? "opacity-50" : ""
      } ${isViewer ? "cursor-default" : "cursor-grab active:cursor-grabbing"} ${
        isBlocked ? "border-l-4 border-yellow-500" : ""
      }`}
      onClick={() => setShowDetailModal(true)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-1">
            {task.title}
          </h4>
          {task.description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
              {task.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          {canEdit && (
            <>
              <button
                onClick={handleEdit}
                onTouchStart={(e) => e.stopPropagation()}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                title="Edit task"
              >
                ✏️
              </button>
              <button
                onClick={handleDuplicate}
                onTouchStart={(e) => e.stopPropagation()}
                disabled={duplicateTaskMutation.isPending}
                className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-sm p-1 rounded hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50"
                title="Duplicate task"
              >
                📋
              </button>
            </>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              onTouchStart={(e) => e.stopPropagation()}
              disabled={deleteTaskMutation.isPending}
              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
              title="Delete task"
            >
              🗑️
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`text-xs px-2 py-1 rounded ${
            priorityColors[task.priority as keyof typeof priorityColors] ||
            priorityColors.MEDIUM
          }`}
        >
          {task.priority}
        </span>
        {isBlocked && (
          <span
            className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
            title="Blocked by dependencies"
          >
            ⏳ Blocked
          </span>
        )}
        {task.tags && Array.isArray(task.tags) && task.tags.length > 0 && (
          <div className="flex items-center gap-1">
            {task.tags.slice(0, 2).map((taskTag) => (
              <span
                key={taskTag.tag.id}
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: `${taskTag.tag.color}20`,
                  color: taskTag.tag.color,
                  border: `1px solid ${taskTag.tag.color}40`,
                }}
              >
                {taskTag.tag.name}
              </span>
            ))}
            {task.tags.length > 2 && (
              <span className="text-xs text-gray-500">
                +{task.tags.length - 2}
              </span>
            )}
          </div>
        )}
        {canAssign && (
          <>
            {showAssignee ? (
              <button
                onClick={handleAssigneeClick}
                onTouchStart={(e) => e.stopPropagation()}
                className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 flex items-center gap-1 hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors cursor-pointer"
                title="Click to change assignee"
              >
                <span>👤</span>
                <span>{assigneeName}</span>
              </button>
            ) : (
              <button
                onClick={handleAssigneeClick}
                onTouchStart={(e) => e.stopPropagation()}
                className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-800 transition-colors cursor-pointer"
                title="Click to assign"
              >
                Unassigned
              </button>
            )}
          </>
        )}
      </div>

      {showAssignModal && (
        <AssignTaskModal
          taskId={task.id}
          boardId={boardId}
          currentAssigneeId={task.assigneeId}
          onClose={() => setShowAssignModal(false)}
        />
      )}

      {showEditModal && (
        <EditTaskModal
          taskId={task.id}
          boardId={boardId}
          currentTitle={task.title}
          currentDescription={task.description}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {showDetailModal && organizationId && (
        <TaskDetailModal
          taskId={task.id}
          boardId={boardId}
          organizationId={organizationId}
          userBoardRole={userBoardRole}
          onClose={() => setShowDetailModal(false)}
        />
      )}
    </div>
  );
}
