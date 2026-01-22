"use client";

import { useState } from "react";
import { KanbanBoard } from "../kanban/KanbanBoard";
import { ListView } from "../views/ListView";
import { CalendarView } from "../views/CalendarView";
import { TimelineView } from "../views/TimelineView";

type ViewType = "kanban" | "list" | "calendar" | "timeline";

interface FilterState {
  assigneeId?: string;
  status?: string;
  priority?: string;
  tagId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  searchQuery?: string;
}

interface BoardViewSelectorProps {
  boardId: string;
  organizationId?: string;
  userBoardRole?: "ADMIN" | "MEMBER" | "VIEWER";
  filters?: FilterState;
}

export function BoardViewSelector({
  boardId,
  organizationId,
  userBoardRole,
  filters = {},
}: BoardViewSelectorProps) {
  const [currentView, setCurrentView] = useState<ViewType>("kanban");

  const views: Array<{ id: ViewType; name: string; icon: string }> = [
    { id: "kanban", name: "Kanban", icon: "📋" },
    { id: "list", name: "List", icon: "📝" },
    { id: "calendar", name: "Calendar", icon: "📅" },
    { id: "timeline", name: "Timeline", icon: "📊" },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* View Selector */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-2 xs:px-3 sm:px-4 py-2 overflow-x-auto scrollbar-hide">
        <div className="flex gap-1 xs:gap-2 min-w-max">
          {views.map((view) => (
            <button
              key={view.id}
              onClick={() => setCurrentView(view.id)}
              className={`px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 text-xs xs:text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${
                currentView === view.id
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <span className="mr-1 xs:mr-2">{view.icon}</span>
              <span className="hidden xs:inline">{view.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* View Content */}
      <div className="flex-1 overflow-hidden">
        {currentView === "kanban" && (
          <KanbanBoard
            boardId={boardId}
            organizationId={organizationId}
            userBoardRole={userBoardRole}
            filters={filters}
          />
        )}
        {currentView === "list" && (
          <ListView
            boardId={boardId}
            organizationId={organizationId}
            userBoardRole={userBoardRole}
            filters={filters}
          />
        )}
        {currentView === "calendar" && (
          <CalendarView
            boardId={boardId}
            organizationId={organizationId}
            userBoardRole={userBoardRole}
            filters={filters}
          />
        )}
        {currentView === "timeline" && (
          <TimelineView
            boardId={boardId}
            organizationId={organizationId}
            userBoardRole={userBoardRole}
            filters={filters}
          />
        )}
      </div>
    </div>
  );
}

