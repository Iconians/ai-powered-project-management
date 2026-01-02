"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface BoardMember {
  id: string;
  memberId: string;
  role: string;
  member: {
    id: string;
    userId: string;
    role: string;
    user: {
      id: string;
      name: string | null;
      email: string;
    };
  };
}

interface Member {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface AssignTaskModalProps {
  taskId: string;
  boardId: string;
  currentAssigneeId: string | null;
  onClose: () => void;
}

export function AssignTaskModal({ taskId, boardId, currentAssigneeId, onClose }: AssignTaskModalProps) {
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(currentAssigneeId);
  const queryClient = useQueryClient();

  const { data: boardMembers, isLoading } = useQuery<BoardMember[]>({
    queryKey: ["members", boardId],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${boardId}/members`);
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
  });

  // Transform boardMembers to members for the dropdown
  const members: Member[] | undefined = boardMembers?.map((bm) => bm.member);

  const assignTaskMutation = useMutation({
    mutationFn: async (assigneeId: string | null) => {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to assign task");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    assignTaskMutation.mutate(selectedAssigneeId);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Assign Task
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="assignee" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Assign to
            </label>
            {isLoading ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">Loading members...</div>
            ) : (
              <select
                id="assignee"
                value={selectedAssigneeId || ""}
                onChange={(e) => setSelectedAssigneeId(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Unassigned</option>
                {members?.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.user.name || member.user.email}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={assignTaskMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {assignTaskMutation.isPending ? "Assigning..." : "Assign"}
            </button>
          </div>
        </form>
        {assignTaskMutation.isError && (
          <div className="mt-4 text-red-600 dark:text-red-400 text-sm">
            {assignTaskMutation.error?.message || "Failed to assign task"}
          </div>
        )}
      </div>
    </div>
  );
}

