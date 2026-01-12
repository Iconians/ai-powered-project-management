"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface FilterState {
  assigneeId?: string;
  status?: string;
  priority?: string;
  tagId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  searchQuery?: string;
}

interface TimelineViewProps {
  boardId: string;
  organizationId?: string;
  userBoardRole?: "ADMIN" | "MEMBER" | "VIEWER";
  filters?: FilterState;
}

export function TimelineView({
  boardId,
  organizationId: _organizationId,
  userBoardRole: _userBoardRole,
  filters: _filters,
}: TimelineViewProps) {
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date;
  });

  const { data: board, isLoading } = useQuery({
    queryKey: ["board", boardId],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${boardId}`);
      if (!res.ok) throw new Error("Failed to fetch board");
      return res.json();
    },
  });

  if (isLoading) {
    return <div className="p-4">Loading timeline...</div>;
  }

  if (!board) {
    return <div className="p-4">Board not found</div>;
  }

  const tasks = board.tasks || [];
  const tasksWithDates = tasks.filter(
    (task: any) => task.dueDate || task.createdAt
  );

  const getDaysBetween = (start: Date, end: Date) => {
    const days = [];
    const current = new Date(start);
    while (current <= end) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const days = getDaysBetween(startDate, endDate);
  const totalDays = days.length;
  const dayWidth = 100 / totalDays;

  const getTaskPosition = (task: any) => {
    if (!task.dueDate && !task.createdAt) return null;
    const taskDate = new Date(task.dueDate || task.createdAt);
    const daysFromStart = Math.floor(
      (taskDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysFromStart < 0 || daysFromStart >= totalDays) return null;
    return {
      left: (daysFromStart / totalDays) * 100,
      width: Math.max(dayWidth * 2, 5), // Minimum width
    };
  };

  return (
    <div className="h-full flex flex-col p-4">
      {/* Controls */}
      <div className="mb-4 flex items-center gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
            Start Date:
          </label>
          <input
            type="date"
            value={startDate.toISOString().split("T")[0]}
            onChange={(e) => setStartDate(new Date(e.target.value))}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
            End Date:
          </label>
          <input
            type="date"
            value={endDate.toISOString().split("T")[0]}
            onChange={(e) => setEndDate(new Date(e.target.value))}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-auto">
        <div className="relative min-h-96">
          {/* Date headers */}
          <div className="sticky top-0 bg-white dark:bg-gray-800 z-10 border-b border-gray-200 dark:border-gray-700">
            <div className="flex">
              {days.map((day, index) => {
                if (index % Math.ceil(totalDays / 20) !== 0 && index !== 0) {
                  return null;
                }
                return (
                  <div
                    key={index}
                    className="border-r border-gray-200 dark:border-gray-700 p-2 text-xs text-gray-600 dark:text-gray-400"
                    style={{ width: `${dayWidth}%` }}
                  >
                    {day.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tasks */}
          <div className="relative mt-4">
            {tasksWithDates.map((task: any, index: number) => {
              const position = getTaskPosition(task);
              if (!position) return null;

              return (
                <div
                  key={task.id}
                  className="absolute h-8 rounded px-2 py-1 text-xs text-white truncate"
                  style={{
                    left: `${position.left}%`,
                    width: `${position.width}%`,
                    top: `${index * 40}px`,
                    backgroundColor:
                      task.status === "DONE"
                        ? "#10b981"
                        : task.status === "IN_PROGRESS"
                        ? "#3b82f6"
                        : task.status === "BLOCKED"
                        ? "#ef4444"
                        : "#6b7280",
                  }}
                  title={task.title}
                >
                  {task.title}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

