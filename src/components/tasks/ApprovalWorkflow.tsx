"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApprovalStatus } from "@prisma/client";

interface Approval {
  id: string;
  status: ApprovalStatus;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  requester: {
    id: string;
    name: string | null;
    email: string;
  };
  approver: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface ApprovalWorkflowProps {
  taskId: string;
  boardId: string;
  organizationId?: string;
}

export function ApprovalWorkflow({
  taskId,
  boardId,
  organizationId: _organizationId,
}: ApprovalWorkflowProps) {
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [approverId, setApproverId] = useState("");
  const [comment, setComment] = useState("");
  const queryClient = useQueryClient();

  const { data: approvals = [], isLoading } = useQuery<Approval[]>({
    queryKey: ["task-approvals", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/approvals`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: board } = useQuery({
    queryKey: ["board", boardId],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${boardId}`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const members = board?.boardMembers || [];

  const createApprovalMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approverId,
          comment: comment || undefined,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create approval request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-approvals", taskId] });
      setShowRequestModal(false);
      setApproverId("");
      setComment("");
    },
  });

  const updateApprovalMutation = useMutation({
    mutationFn: async ({
      approvalId,
      status,
      comment,
    }: {
      approvalId: string;
      status: "APPROVED" | "REJECTED";
      comment?: string;
    }) => {
      const res = await fetch(`/api/tasks/${taskId}/approvals/${approvalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, comment }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update approval");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-approvals", taskId] });
    },
  });

  const statusColors = {
    PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    APPROVED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    REJECTED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Approvals
        </h3>
        <button
          onClick={() => setShowRequestModal(true)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Request Approval
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-500">Loading approvals...</div>
      ) : approvals.length === 0 ? (
        <div className="text-sm text-gray-500">No approval requests</div>
      ) : (
        <div className="space-y-3">
          {approvals.map((approval) => (
            <div
              key={approval.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-1 text-xs rounded font-medium ${
                        statusColors[approval.status]
                      }`}
                    >
                      {approval.status}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Requested by {approval.requester.name || approval.requester.email}
                    </span>
                  </div>
                  {approval.approver && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {approval.status === ApprovalStatus.PENDING
                        ? "Waiting for"
                        : approval.status === ApprovalStatus.APPROVED
                        ? "Approved by"
                        : "Rejected by"}{" "}
                      {approval.approver.name || approval.approver.email}
                    </div>
                  )}
                  {approval.comment && (
                    <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                      {approval.comment}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-gray-500">
                    {new Date(approval.createdAt).toLocaleString()}
                  </div>
                </div>
                {approval.status === ApprovalStatus.PENDING && (
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() =>
                        updateApprovalMutation.mutate({
                          approvalId: approval.id,
                          status: ApprovalStatus.APPROVED,
                        })
                      }
                      disabled={updateApprovalMutation.isPending}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        const comment = prompt("Rejection reason (optional):");
                        if (comment !== null) {
                          updateApprovalMutation.mutate({
                            approvalId: approval.id,
                            status: ApprovalStatus.REJECTED,
                            comment: comment || undefined,
                          });
                        }
                      }}
                      disabled={updateApprovalMutation.isPending}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showRequestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
              Request Approval
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Approver *
                </label>
                <select
                  value={approverId}
                  onChange={(e) => setApproverId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                >
                  <option value="">Select an approver</option>
                  {members.map((bm: any) => (
                    <option key={bm.memberId} value={bm.member.user.id}>
                      {bm.member.user.name || bm.member.user.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Comment (optional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowRequestModal(false);
                    setApproverId("");
                    setComment("");
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => createApprovalMutation.mutate()}
                  disabled={createApprovalMutation.isPending || !approverId}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {createApprovalMutation.isPending ? "Requesting..." : "Request Approval"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
