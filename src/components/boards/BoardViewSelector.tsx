"use client";

import { useState } from "react";
import { KanbanBoard } from "../kanban/KanbanBoard";
import { ListView } from "../views/ListView";
import { CalendarView } from "../views/CalendarView";
import { TimelineView } from "../views/TimelineView";

type ViewType = "kanban" | "list" | "calendar" | "timeline";

interface BoardViewSelectorProps {
  boardId: string;
  organizationId?: string;
  userBoardRole?: "ADMIN" | "MEMBER" | "VIEWER";
}

export function BoardViewSelector({
  boardId,
  organizationId,
  userBoardRole,
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
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="flex gap-2">
          {views.map((view) => (
            <button
              key={view.id}
              onClick={() => setCurrentView(view.id)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                currentView === view.id
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <span className="mr-2">{view.icon}</span>
              {view.name}
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
          />
        )}
        {currentView === "list" && (
          <ListView
            boardId={boardId}
            organizationId={organizationId}
            userBoardRole={userBoardRole}
          />
        )}
        {currentView === "calendar" && (
          <CalendarView
            boardId={boardId}
            organizationId={organizationId}
            userBoardRole={userBoardRole}
          />
        )}
        {currentView === "timeline" && (
          <TimelineView
            boardId={boardId}
            organizationId={organizationId}
            userBoardRole={userBoardRole}
          />
        )}
      </div>
    </div>
  );
}

