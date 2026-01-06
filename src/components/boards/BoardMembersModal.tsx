"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface BoardMember {
  id: string;
  role: "ADMIN" | "MEMBER" | "VIEWER";
  member: {
    id: string;
    user: {
      id: string;
      email: string;
      name: string | null;
    };
  };
}

interface OrganizationMember {
  id: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

interface BoardMembersModalProps {
  boardId: string;
  onClose: () => void;
}

export function BoardMembersModal({
  boardId,
  onClose,
}: BoardMembersModalProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: boardMembers, isLoading } = useQuery<BoardMember[]>({
    queryKey: ["board", boardId, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${boardId}/members`);
      if (!res.ok) throw new Error("Failed to fetch board members");
      return res.json();
    },
  });

  
  const { data: orgMembers } = useQuery<OrganizationMember[]>({
    queryKey: ["board", boardId, "org-members"],
    queryFn: async () => {
      
      const boardRes = await fetch(`/api/boards/${boardId}`);
      if (!boardRes.ok) throw new Error("Failed to fetch board");
      const board = await boardRes.json();

      
      const orgRes = await fetch(
        `/api/organizations/${board.organizationId}/members`
      );
      if (!orgRes.ok) throw new Error("Failed to fetch organization members");
      return orgRes.json();
    },
    enabled: showAddModal,
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/boards/${boardId}/members/${memberId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to remove board member");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", boardId, "members"],
      });
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({
      memberId,
      role,
    }: {
      memberId: string;
      role: string;
    }) => {
      const res = await fetch(`/api/boards/${boardId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update role");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", boardId, "members"],
      });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({
      memberId,
      role,
    }: {
      memberId: string;
      role: string;
    }) => {
      const res = await fetch(`/api/boards/${boardId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, role }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add board member");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", boardId, "members"],
      });
      queryClient.invalidateQueries({
        queryKey: ["board", boardId, "org-members"],
      });
      setShowAddModal(false);
    },
  });

  const handleRemove = (memberId: string, memberEmail: string) => {
    if (
      confirm(`Are you sure you want to remove ${memberEmail} from this board?`)
    ) {
      removeMemberMutation.mutate(memberId);
    }
  };

  const handleRoleChange = (memberId: string, newRole: string) => {
    updateRoleMutation.mutate({ memberId, role: newRole });
  };

  
  const availableMembers =
    orgMembers?.filter(
      (orgMember) => !boardMembers?.some((bm) => bm.member.id === orgMember.id)
    ) || [];

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-2xl">
          <div className="text-center text-gray-600 dark:text-gray-400">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Board Members
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        {!showAddModal ? (
          <>
            <div className="mb-4">
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                + Add Member
              </button>
            </div>

            <div className="space-y-2">
              {boardMembers && boardMembers.length > 0 ? (
                boardMembers.map((boardMember) => (
                  <div
                    key={boardMember.id}
                    className="flex items-center justify-between gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {boardMember.member.user.name ||
                          boardMember.member.user.email}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {boardMember.member.user.email}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select
                        value={boardMember.role}
                        onChange={(e) =>
                          handleRoleChange(
                            boardMember.member.id,
                            e.target.value
                          )
                        }
                        className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="VIEWER">Viewer</option>
                        <option value="MEMBER">Member</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                      <button
                        onClick={() =>
                          handleRemove(
                            boardMember.member.id,
                            boardMember.member.user.email
                          )
                        }
                        disabled={removeMemberMutation.isPending}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xs sm:text-sm disabled:opacity-50 whitespace-nowrap"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No members yet
                </div>
              )}
            </div>
          </>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add Member to Board
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {availableMembers.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                All organization members already have access to this board
              </div>
            ) : (
              <div className="space-y-2">
                {availableMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {member.user.name || member.user.email}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {member.user.email}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select
                        id={`role-${member.id}`}
                        className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        defaultValue="VIEWER"
                      >
                        <option value="VIEWER">Viewer</option>
                        <option value="MEMBER">Member</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                      <button
                        onClick={() => {
                          const roleSelect = document.getElementById(
                            `role-${member.id}`
                          ) as HTMLSelectElement;
                          addMemberMutation.mutate({
                            memberId: member.id,
                            role: roleSelect.value,
                          });
                        }}
                        disabled={addMemberMutation.isPending}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {(removeMemberMutation.isError ||
          updateRoleMutation.isError ||
          addMemberMutation.isError) && (
          <div className="mt-4 text-red-600 dark:text-red-400 text-sm">
            {removeMemberMutation.error?.message ||
              updateRoleMutation.error?.message ||
              addMemberMutation.error?.message}
          </div>
        )}
      </div>
    </div>
  );
}
