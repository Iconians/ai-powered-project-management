"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AddMemberModal } from "./AddMemberModal";

interface Member {
  id: string;
  role: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

interface OrganizationMembersProps {
  organizationId: string;
  isAdmin: boolean;
}

export function OrganizationMembers({ organizationId, isAdmin }: OrganizationMembersProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: members, isLoading } = useQuery<Member[]>({
    queryKey: ["organization", organizationId, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/members`);
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/organizations/${organizationId}/members/${memberId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to remove member");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", organizationId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });

  const handleRemove = (memberId: string, memberEmail: string) => {
    if (confirm(`Are you sure you want to remove ${memberEmail} from this organization?`)) {
      removeMemberMutation.mutate(memberId);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-gray-500 dark:text-gray-400">Loading members...</div>;
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Members ({members?.length || 0})
          </h3>
          {isAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              + Add Member
            </button>
          )}
        </div>
        <div className="space-y-2">
          {members && members.length > 0 ? (
            members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {member.user.name || member.user.email}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {member.user.email}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded ${
                    member.role === "ADMIN"
                      ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                      : member.role === "MEMBER"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200"
                  }`}>
                    {member.role}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => handleRemove(member.id, member.user.email)}
                      disabled={removeMemberMutation.isPending}
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No members yet
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <AddMemberModal
          organizationId={organizationId}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </>
  );
}

