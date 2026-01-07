"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { TaskGenerator } from "../ai/TaskGenerator";
import { SprintPlanner } from "../ai/SprintPlanner";
import { CreateSprintModal } from "../sprints/CreateSprintModal";
import { BoardMembersModal } from "./BoardMembersModal";
import { GitHubRepoModal } from "./GitHubRepoModal";
import { ManageColumnsModal } from "./ManageColumnsModal";
import { TaskSearch } from "../tasks/TaskSearch";
import { TaskFilters } from "../tasks/TaskFilters";
import { ExportModal } from "./ExportModal";
import { ImportModal } from "./ImportModal";

interface BoardHeaderProps {
  boardId: string;
  boardName: string;
  boardDescription?: string | null;
  activeTab?: "board" | "sprints";
  onTabChange?: (tab: "board" | "sprints") => void;
  userBoardRole?: "ADMIN" | "MEMBER" | "VIEWER";
  organizationId?: string;
}

export function BoardHeader({
  boardId,
  boardName,
  boardDescription,
  activeTab = "board",
  onTabChange,
  userBoardRole,
  organizationId,
}: BoardHeaderProps) {
  const [showTaskGenerator, setShowTaskGenerator] = useState(false);
  const [showSprintPlanner, setShowSprintPlanner] = useState(false);
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [showBoardMembers, setShowBoardMembers] = useState(false);
  const [showGitHubRepo, setShowGitHubRepo] = useState(false);
  const [showManageColumns, setShowManageColumns] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(boardName);
  const queryClient = useQueryClient();
  
  // TaskFilters manages its own state, we just need a callback
  const handleFilterChange = (_filters: any) => {
    // Filters are managed internally by TaskFilters component
  };

  const updateBoardTitleMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`/api/boards/${boardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update board title");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      setIsEditingTitle(false);
    },
    onError: () => {
      setEditTitle(boardName);
      setIsEditingTitle(false);
    },
  });

  const handleSaveTitle = () => {
    if (editTitle.trim() && editTitle.trim() !== boardName) {
      updateBoardTitleMutation.mutate(editTitle.trim());
    } else {
      setIsEditingTitle(false);
      setEditTitle(boardName);
    }
  };

  const { data: activeSprint } = useQuery({
    queryKey: ["sprints", boardId, "active"],
    queryFn: async () => {
      const res = await fetch(`/api/sprints?boardId=${boardId}&isActive=true`);
      if (!res.ok) return null;
      const sprints = await res.json();
      return sprints.length > 0 ? sprints[0] : null;
    },
  });

  const { data: subscription } = useQuery({
    queryKey: ["subscription", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      try {
        const res = await fetch(
          `/api/subscriptions?organizationId=${organizationId}`
        );
        if (!res.ok) {
          return null;
        }
        return await res.json();
      } catch (e) {
        return null;
      }
    },
    enabled: !!organizationId,
    retry: false,
  });

  const { data: board } = useQuery({
    queryKey: ["board", boardId],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${boardId}`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const planPrice = subscription?.plan?.price;
  const priceValue = (() => {
    if (planPrice === null || planPrice === undefined) return 0;
    if (typeof planPrice === "number") return planPrice;
    if (typeof planPrice === "string") return parseFloat(planPrice) || 0;
    if (
      typeof planPrice === "object" &&
      "toNumber" in planPrice &&
      typeof (planPrice as { toNumber: () => number }).toNumber === "function"
    ) {
      return (planPrice as { toNumber: () => number }).toNumber();
    }
    return 0;
  })();

  let isSubscriptionActive = false;
  if (subscription) {
    if (
      subscription.status === "ACTIVE" ||
      subscription.status === "TRIALING"
    ) {
      isSubscriptionActive = true;
    } else if (
      subscription.status === "CANCELED" &&
      subscription.currentPeriodEnd
    ) {
      const periodEnd = new Date(subscription.currentPeriodEnd);
      const now = new Date();
      isSubscriptionActive = periodEnd > now;
    }
  }

  const hasPaidSubscription = priceValue > 0 && isSubscriptionActive;
  const isGitHubConnected =
    board?.githubSyncEnabled && board?.githubAccessToken;
  const needsRepoName =
    board?.githubSyncEnabled &&
    board?.githubAccessToken &&
    !board?.githubRepoName;

  const { data: githubLimit } = useQuery({
    queryKey: ["githubLimit", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const res = await fetch(
        `/api/organizations/${organizationId}/github-limit`
      );
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!organizationId && !isGitHubConnected,
  });

  const canConnectGitHub =
    isGitHubConnected ||
    (githubLimit?.allowed !== false && !githubLimit?.error);

  return (
    <>
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
          <div className="flex-1 min-w-0">
            {isEditingTitle &&
            (userBoardRole === "ADMIN" || userBoardRole === "MEMBER") ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-2 py-1 text-xl sm:text-2xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-blue-500 focus:outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveTitle();
                  } else if (e.key === "Escape") {
                    setIsEditingTitle(false);
                    setEditTitle(boardName);
                  }
                }}
                onBlur={handleSaveTitle}
              />
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
                  {boardName}
                </h1>
                {(userBoardRole === "ADMIN" || userBoardRole === "MEMBER") && (
                  <button
                    onClick={() => {
                      setIsEditingTitle(true);
                      setEditTitle(boardName);
                    }}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm flex-shrink-0"
                    title="Edit board title"
                  >
                    ✏️
                  </button>
                )}
              </div>
            )}
            {boardDescription && (
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                {boardDescription}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {(userBoardRole === "ADMIN" || userBoardRole === "MEMBER") && (
              <>
                <button
                  onClick={() => setShowExportModal(true)}
                  className="px-2 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 flex items-center gap-1 sm:gap-2 shadow-md transition-all text-xs sm:text-sm"
                  title="Export Board"
                >
                  <span>📥</span>
                  <span className="hidden sm:inline">Export</span>
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-2 sm:px-4 py-1.5 sm:py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 flex items-center gap-1 sm:gap-2 shadow-md transition-all text-xs sm:text-sm"
                  title="Import Tasks"
                >
                  <span>📤</span>
                  <span className="hidden sm:inline">Import</span>
                </button>
                <button
                  onClick={() => setShowManageColumns(true)}
                  className="px-2 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center gap-1 sm:gap-2 shadow-md transition-all text-xs sm:text-sm"
                  title="Manage Columns"
                >
                  <span>📊</span>
                  <span className="hidden sm:inline">Columns</span>
                </button>
              </>
            )}
            {userBoardRole === "ADMIN" && (
              <>
                <button
                  onClick={() => setShowBoardMembers(true)}
                  className="px-2 sm:px-4 py-1.5 sm:py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 flex items-center gap-1 sm:gap-2 shadow-md transition-all text-xs sm:text-sm"
                  title="Manage Board Members"
                >
                  <span>👥</span>
                  <span className="hidden sm:inline">Members</span>
                </button>
                {needsRepoName ? (
                  <button
                    onClick={() => setShowGitHubRepo(true)}
                    className="px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center gap-1 sm:gap-2 shadow-md transition-all text-xs sm:text-sm bg-yellow-600 text-white hover:bg-yellow-700 focus:ring-yellow-500"
                    title="Set GitHub Repository"
                  >
                    <span>🔗</span>
                    <span className="hidden sm:inline">Set GitHub Repo</span>
                  </button>
                ) : canConnectGitHub ? (
                  <a
                    href={`/api/github/connect?boardId=${boardId}`}
                    className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center gap-1 sm:gap-2 shadow-md transition-all text-xs sm:text-sm ${
                      isGitHubConnected
                        ? "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500"
                        : "bg-gray-700 text-white hover:bg-gray-800 focus:ring-gray-500"
                    }`}
                    title={
                      isGitHubConnected ? "GitHub Connected" : "Connect GitHub"
                    }
                  >
                    <span>🔗</span>
                    <span className="hidden sm:inline">
                      {isGitHubConnected ? "GitHub" : "Connect GitHub"}
                    </span>
                  </a>
                ) : (
                  <button
                    disabled
                    className="px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-gray-400 text-white cursor-not-allowed flex items-center gap-1 sm:gap-2 shadow-md text-xs sm:text-sm"
                    title={
                      githubLimit?.limit === 1
                        ? `GitHub integration limit reached (${githubLimit.current}/1). Upgrade to Pro or Enterprise for unlimited integrations.`
                        : `GitHub integration limit reached. Please upgrade your plan.`
                    }
                  >
                    <span>🔗</span>
                    <span className="hidden sm:inline">Connect GitHub</span>
                  </button>
                )}
              </>
            )}
            {(userBoardRole === "ADMIN" || userBoardRole === "MEMBER") && (
              <>
                <button
                  onClick={() => setShowCreateSprint(true)}
                  className="px-2 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center gap-1 sm:gap-2 shadow-md transition-all text-xs sm:text-sm"
                >
                  <span>📅</span>
                  <span className="hidden xs:inline">Create Sprint</span>
                </button>
                {hasPaidSubscription && (
                  <>
                    <button
                      onClick={() => setShowTaskGenerator(true)}
                      className="px-2 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 flex items-center gap-1 sm:gap-2 shadow-md transition-all text-xs sm:text-sm"
                    >
                      <span>✨</span>
                      <span className="hidden sm:inline">
                        AI Generate Tasks
                      </span>
                    </button>
                    <button
                      onClick={() => setShowSprintPlanner(true)}
                      className="px-2 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 flex items-center gap-1 sm:gap-2 shadow-md transition-all text-xs sm:text-sm"
                    >
                      <span>🚀</span>
                      <span className="hidden sm:inline">AI Plan Sprint</span>
                    </button>
                  </>
                )}
              </>
            )}
            <Link
              href="/boards"
              className="px-2 sm:px-4 py-1.5 sm:py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors text-xs sm:text-sm whitespace-nowrap"
            >
              ← Back
            </Link>
          </div>
        </div>

        {onTabChange && (
          <div className="flex gap-1 border-gray-200 dark:border-gray-700 overflow-x-auto">
            <button
              onClick={() => onTabChange("board")}
              className={`px-3 sm:px-4 py-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeTab === "board"
                  ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              📋 Board
            </button>
            <button
              onClick={() => onTabChange("sprints")}
              className={`px-3 sm:px-4 py-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeTab === "sprints"
                  ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              📅 Sprints
            </button>
          </div>
        )}

        {activeTab === "board" && (
          <div className="mt-4 space-y-2">
            <div className="max-w-md">
              <TaskSearch
                boardId={boardId}
                onTaskSelect={(taskId) => {
                  // Could open task detail modal here
                  console.log("Selected task:", taskId);
                }}
              />
            </div>
            <TaskFilters boardId={boardId} onFilterChange={handleFilterChange} />
          </div>
        )}
      </div>

      {showTaskGenerator && (
        <TaskGenerator
          boardId={boardId}
          onClose={() => setShowTaskGenerator(false)}
        />
      )}

      {showCreateSprint && (
        <CreateSprintModal
          boardId={boardId}
          onClose={() => setShowCreateSprint(false)}
        />
      )}

      {showSprintPlanner && (
        <SprintPlanner
          boardId={boardId}
          sprintId={activeSprint?.id || null}
          onClose={() => setShowSprintPlanner(false)}
        />
      )}

      {showBoardMembers && (
        <BoardMembersModal
          boardId={boardId}
          onClose={() => setShowBoardMembers(false)}
        />
      )}

      {showGitHubRepo && (
        <GitHubRepoModal
          boardId={boardId}
          currentRepoName={board?.githubRepoName}
          currentProjectId={board?.githubProjectId}
          onClose={() => setShowGitHubRepo(false)}
        />
      )}

      {showManageColumns && (
        <ManageColumnsModal
          boardId={boardId}
          userBoardRole={userBoardRole}
          onClose={() => setShowManageColumns(false)}
        />
      )}

      {showExportModal && (
        <ExportModal
          boardId={boardId}
          boardName={boardName}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {showImportModal && (
        <ImportModal
          boardId={boardId}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </>
  );
}
