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

interface ListViewProps {
  boardId: string;
  organizationId?: string;
  userBoardRole?: "ADMIN" | "MEMBER" | "VIEWER";
  filters?: FilterState;
}

type SortField = "title" | "status" | "priority" | "dueDate" | "createdAt";
type SortDirection = "asc" | "desc";

export function ListView({
  boardId,
  organizationId: _organizationId,
  userBoardRole: _userBoardRole,
  filters = {},
}: ListViewProps) {
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const { data: board, isLoading } = useQuery({
    queryKey: ["board", boardId],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${boardId}`);
      if (!res.ok) throw new Error("Failed to fetch board");
      return res.json();
    },
  });

  if (isLoading) {
    return <div className="p-4">Loading tasks...</div>;
  }

  if (!board) {
    return <div className="p-4">Board not found</div>;
  }

  let tasks = [...(board.tasks || [])];

  // Apply filters
  if (filters.status) {
    tasks = tasks.filter((task) => task.status === filters.status);
  }
  if (filters.priority) {
    tasks = tasks.filter((task) => task.priority === filters.priority);
  }
  if (filters.assigneeId) {
    tasks = tasks.filter((task) => task.assignee?.id === filters.assigneeId);
  }
  if (filters.tagId && tasks[0]?.tags) {
    tasks = tasks.filter((task: any) => 
      task.tags?.some((tt: any) => tt.tag?.id === filters.tagId)
    );
  }
  if (filters.dueDateFrom) {
    const fromDate = new Date(filters.dueDateFrom);
    tasks = tasks.filter((task) => {
      if (!task.dueDate) return false;
      return new Date(task.dueDate) >= fromDate;
    });
  }
  if (filters.dueDateTo) {
    const toDate = new Date(filters.dueDateTo);
    toDate.setHours(23, 59, 59, 999);
    tasks = tasks.filter((task) => {
      if (!task.dueDate) return false;
      return new Date(task.dueDate) <= toDate;
    });
  }
  if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
    const query = filters.searchQuery.toLowerCase();
    tasks = tasks.filter((task) => {
      const titleMatch = task.title?.toLowerCase().includes(query);
      const descMatch = task.description?.toLowerCase().includes(query);
      return titleMatch || descMatch;
    });
  }

  // Sort tasks
  tasks.sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];

    if (sortField === "dueDate" || sortField === "createdAt") {
      aValue = aValue ? new Date(aValue).getTime() : 0;
      bValue = bValue ? new Date(bValue).getTime() : 0;
    } else {
      aValue = aValue || "";
      bValue = bValue || "";
    }

    if (sortDirection === "asc") {
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    } else {
      return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
    }
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? "↑" : "↓";
  };

  return (
    <div className="h-full flex flex-col">

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
            <tr>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort("title")}
              >
                Title <SortIcon field="title" />
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort("status")}
              >
                Status <SortIcon field="status" />
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort("priority")}
              >
                Priority <SortIcon field="priority" />
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort("dueDate")}
              >
                Due Date <SortIcon field="dueDate" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Assignee
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No tasks found
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr
                  key={task.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {task.title}
                    </div>
                    {task.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                        {task.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                      {task.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs px-2 py-1 rounded bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200">
                      {task.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {task.dueDate
                      ? new Date(task.dueDate).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {task.assignee?.user?.name ||
                      task.assignee?.user?.email?.split("@")[0] ||
                      "Unassigned"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

