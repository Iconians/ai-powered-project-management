"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { TaskGenerator } from "../ai/TaskGenerator";
import { SprintPlanner } from "../ai/SprintPlanner";
import { CreateSprintModal } from "../sprints/CreateSprintModal";
import { BoardMembersModal } from "./BoardMembersModal";
import { GitHubRepoModal } from "./GitHubRepoModal";
import { ManageColumnsModal } from "./ManageColumnsModal";
import { TagManagerModal } from "../tags/TagManagerModal";
import { TaskSearch } from "../tasks/TaskSearch";
import { TaskFilters } from "../tasks/TaskFilters";
import { ExportModal } from "./ExportModal";
import { ImportModal } from "./ImportModal";
import { TemplateEditor } from "../templates/TemplateEditor";
import { RecurringTaskManager } from "../recurring-tasks/RecurringTaskManager";

interface FilterState {
  assigneeId?: string;
  status?: string;
  priority?: string;
  tagId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  searchQuery?: string;
}

interface BoardHeaderProps {
  boardId: string;
  boardName: string;
  boardDescription?: string | null;
  activeTab?: "board" | "sprints";
  onTabChange?: (tab: "board" | "sprints") => void;
  userBoardRole?: "ADMIN" | "MEMBER" | "VIEWER";
  organizationId?: string;
  filters?: FilterState;
  onFiltersChange?: (filters: FilterState) => void;
}

export function BoardHeader({
  boardId,
  boardName,
  boardDescription,
  activeTab = "board",
  onTabChange,
  userBoardRole,
  organizationId,
  filters = {},
  onFiltersChange,
}: BoardHeaderProps) {
  const [showTaskGenerator, setShowTaskGenerator] = useState(false);
  const [showSprintPlanner, setShowSprintPlanner] = useState(false);
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [showBoardMembers, setShowBoardMembers] = useState(false);
  const [showGitHubRepo, setShowGitHubRepo] = useState(false);
  const [showManageColumns, setShowManageColumns] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [showRecurringTasks, setShowRecurringTasks] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(boardName);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);
  
  const handleFilterChange = (newFilters: FilterState) => {
    if (onFiltersChange) {
      onFiltersChange(newFilters);
    }
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
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-2 xs:px-4 sm:px-6 lg:px-8 py-2 xs:py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 xs:gap-3 sm:gap-4 mb-2 xs:mb-3 sm:mb-4">
          <div className="flex-1 min-w-0 w-full">
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
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 sm:py-2.5 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center gap-1.5 xs:gap-2 shadow-md transition-all text-xs sm:text-sm flex-shrink-0"
                title="Board Actions"
              >
                <span className="text-base xs:text-lg">⚙️</span>
                <span className="hidden xs:inline">Actions</span>
                <span className="text-xs xs:text-sm">▼</span>
              </button>
              
              {showMenu && (
                <div className="absolute right-0 mt-1 w-56 xs:w-64 sm:w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-[calc(100vh-8rem)] overflow-y-auto">
                  <div className="py-1">
                    {(userBoardRole === "ADMIN" || userBoardRole === "MEMBER") && (
                      <>
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                          Board Management
                        </div>
                        <button
                          onClick={() => {
                            setShowExportModal(true);
                            setShowMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <span>📥</span>
                          <span>Export Board</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowImportModal(true);
                            setShowMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <span>📤</span>
                          <span>Import Tasks</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowManageColumns(true);
                            setShowMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <span>📊</span>
                          <span>Manage Columns</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowTagManager(true);
                            setShowMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <span>🏷️</span>
                          <span>Manage Tags</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowTemplateEditor(true);
                            setShowMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <span>📋</span>
                          <span>Manage Templates</span>
                        </button>
                      </>
                    )}
                    
                    {userBoardRole === "ADMIN" && (
                      <>
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 mt-1">
                          Team & Integration
                        </div>
                        <button
                          onClick={() => {
                            setShowBoardMembers(true);
                            setShowMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <span>👥</span>
                          <span>Manage Members</span>
                        </button>
                        {needsRepoName ? (
                          <button
                            onClick={() => {
                              setShowGitHubRepo(true);
                              setShowMenu(false);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-yellow-700 dark:text-yellow-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <span>🔗</span>
                            <span>Set GitHub Repo</span>
                          </button>
                        ) : canConnectGitHub ? (
                          <a
                            href={`/api/github/connect?boardId=${boardId}`}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            onClick={() => setShowMenu(false)}
                          >
                            <span>🔗</span>
                            <span>{isGitHubConnected ? "GitHub Connected" : "Connect GitHub"}</span>
                          </a>
                        ) : (
                          <div
                            className="w-full px-4 py-2 text-left text-sm text-gray-400 dark:text-gray-500 cursor-not-allowed flex items-center gap-2"
                            title={
                              githubLimit?.limit === 1
                                ? `GitHub integration limit reached (${githubLimit.current}/1). Upgrade to Pro or Enterprise for unlimited integrations.`
                                : `GitHub integration limit reached. Please upgrade your plan.`
                            }
                          >
                            <span>🔗</span>
                            <span>Connect GitHub (Limit Reached)</span>
                          </div>
                        )}
                      </>
                    )}
                    
                    {(userBoardRole === "ADMIN" || userBoardRole === "MEMBER") && (
                      <>
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 mt-1">
                          Sprint & AI
                        </div>
                        <button
                          onClick={() => {
                            setShowCreateSprint(true);
                            setShowMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <span>📅</span>
                          <span>Create Sprint</span>
                        </button>
                        {hasPaidSubscription && (
                          <>
                            <button
                              onClick={() => {
                                setShowTaskGenerator(true);
                                setShowMenu(false);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                              <span>✨</span>
                              <span>AI Generate Tasks</span>
                            </button>
                            <button
                              onClick={() => {
                                setShowSprintPlanner(true);
                                setShowMenu(false);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                              <span>🚀</span>
                              <span>AI Plan Sprint</span>
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <Link
              href="/boards"
              className="px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 sm:py-2.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
            >
              ← Back
            </Link>
          </div>
        </div>

        {onTabChange && (
          <div className="flex gap-1 border-gray-200 dark:border-gray-700 overflow-x-auto -mx-2 xs:-mx-4 sm:-mx-6 lg:-mx-8 px-2 xs:px-4 sm:px-6 lg:px-8 scrollbar-hide">
            <button
              onClick={() => onTabChange("board")}
              className={`px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === "board"
                  ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              📋 Board
            </button>
            <button
              onClick={() => onTabChange("sprints")}
              className={`px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 ${
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
                onSearchChange={(searchQuery) => {
                  handleFilterChange({ ...filters, searchQuery });
                }}
                searchQuery={filters.searchQuery}
              />
            </div>
            <TaskFilters boardId={boardId} onFilterChange={handleFilterChange} filters={filters} />
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

      {showTagManager && (
        <TagManagerModal
          boardId={boardId}
          organizationId={organizationId}
          userBoardRole={userBoardRole}
          onClose={() => setShowTagManager(false)}
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

      {showTemplateEditor && (
        <TemplateEditor
          boardId={boardId}
          organizationId={organizationId}
          onClose={() => setShowTemplateEditor(false)}
        />
      )}

      {showRecurringTasks && (
        <RecurringTaskManager
          boardId={boardId}
          organizationId={organizationId}
          onClose={() => setShowRecurringTasks(false)}
        />
      )}
    </>
  );
}
