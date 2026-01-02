"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TaskStatus } from "@prisma/client";
import { AssignTaskModal } from "../tasks/AssignTaskModal";

interface Task {
  id: string;
  title: string;
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

export function TaskCard({ task, isDragging = false, boardId, userBoardRole }: TaskCardProps) {
  const [showAssignModal, setShowAssignModal] = useState(false);
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

  const showAssignee = (task.status === "IN_PROGRESS" || task.status === "IN_REVIEW") && task.assignee;
  const assigneeName = task.assignee?.user?.name || task.assignee?.user?.email?.split("@")[0] || "Unassigned";
  const canAssign = (task.status === "IN_PROGRESS" || task.status === "IN_REVIEW") && userBoardRole !== "VIEWER";

  const handleAssigneeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAssignModal(true);
  };

  const isViewer = userBoardRole === "VIEWER";
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isViewer ? {} : { ...attributes, ...listeners })}
      className={`bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow ${
        isDragging ? "opacity-50" : ""
      } ${isViewer ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-gray-900 dark:text-white text-sm">
          {task.title}
        </h4>
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
                className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 flex items-center gap-1 hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors cursor-pointer"
                title="Click to change assignee"
              >
                <span>👤</span>
                <span>{assigneeName}</span>
              </button>
            ) : (
              <button
                onClick={handleAssigneeClick}
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
    </div>
  );
}

