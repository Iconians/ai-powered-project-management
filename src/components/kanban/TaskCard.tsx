"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TaskStatus } from "@prisma/client";
import { AssignTaskModal } from "../tasks/AssignTaskModal";
import { EditTaskModal } from "../tasks/EditTaskModal";

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
}

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
  boardId: string;
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
  userBoardRole,
}: TaskCardProps) {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const queryClient = useQueryClient();
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
      } ${isViewer ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
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
            <button
              onClick={handleEdit}
              onTouchStart={(e) => e.stopPropagation()}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
              title="Edit task"
            >
              ✏️
            </button>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              onTouchStart={(e) => e.stopPropagation()}
              disabled={deleteTaskMutation.isPending}
              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm disabled:opacity-50"
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
    </div>
  );
}
