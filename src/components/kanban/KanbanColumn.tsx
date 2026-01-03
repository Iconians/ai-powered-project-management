"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { TaskCard } from "./TaskCard";
import { CreateTaskModal } from "../tasks/CreateTaskModal";
import type { TaskStatus } from "@prisma/client";

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

interface Status {
  id: string;
  name: string;
  status: TaskStatus;
  order: number;
}

interface KanbanColumnProps {
  id: string;
  status: Status;
  tasks: Task[];
  boardId: string;
  userBoardRole?: "ADMIN" | "MEMBER" | "VIEWER";
}

export function KanbanColumn({
  id,
  status,
  tasks,
  boardId,
  userBoardRole,
}: KanbanColumnProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <>
      <div
        ref={setNodeRef}
        className={`flex-shrink-0 w-full sm:w-80 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 sm:p-4 flex flex-col ${
          isOver ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20" : ""
        }`}
      >
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="font-semibold text-base sm:text-lg text-gray-900 dark:text-white truncate flex-1">
            {status.name}
          </h3>
          {userBoardRole !== "VIEWER" && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-xs sm:text-sm font-medium ml-2 flex-shrink-0"
            >
              + Add
            </button>
          )}
        </div>
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2 max-h-[80vh] overflow-y-auto flex-1 scroll-smooth">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                boardId={boardId}
                userBoardRole={userBoardRole}
              />
            ))}
            {tasks.length === 0 && (
              <div className="text-gray-400 text-sm text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded">
                Drop tasks here
              </div>
            )}
          </div>
        </SortableContext>
      </div>
      {showCreateModal && (
        <CreateTaskModal
          boardId={boardId}
          defaultStatus={status.status}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </>
  );
}
