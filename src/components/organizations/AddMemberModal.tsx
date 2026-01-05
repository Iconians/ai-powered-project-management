"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface AddMemberModalProps {
  organizationId: string;
  onClose: () => void;
}

export function AddMemberModal({
  organizationId,
  onClose,
}: AddMemberModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER" | "VIEWER">("MEMBER");
  const queryClient = useQueryClient();

  const addMemberMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const res = await fetch(`/api/organizations/${organizationId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to send invitation");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["organization", organizationId, "members"],
      });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    addMemberMutation.mutate({ email: email.trim(), role });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Add Member to Organization
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Email Address *
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              If the user doesn't have an account, they'll receive an invitation
              email to sign up.
            </p>
          </div>
          <div>
            <label
              htmlFor="role"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) =>
                setRole(e.target.value as "ADMIN" | "MEMBER" | "VIEWER")
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="VIEWER">Viewer - Can view only</option>
              <option value="MEMBER">Member - Can create and edit</option>
              <option value="ADMIN">Admin - Full access</option>
            </select>
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
              disabled={addMemberMutation.isPending || !email.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {addMemberMutation.isPending ? "Sending..." : "Send Invitation"}
            </button>
          </div>
        </form>
        {addMemberMutation.isError && (
          <div className="mt-4 text-red-600 dark:text-red-400 text-sm">
            {addMemberMutation.error?.message || "Failed to send invitation"}
          </div>
        )}
        {addMemberMutation.isSuccess && (
          <div className="mt-4 text-green-600 dark:text-green-400 text-sm">
            Invitation sent successfully!{" "}
            {addMemberMutation.data?.message || ""}
          </div>
        )}
      </div>
    </div>
  );
}
