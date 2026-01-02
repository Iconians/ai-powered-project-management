"use client";

import { useState } from "react";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { BoardHeader } from "@/components/boards/BoardHeader";
import { SprintsView } from "@/components/sprints/SprintsView";

interface BoardPageClientProps {
  boardId: string;
  boardName: string;
  boardDescription: string | null;
  userBoardRole?: "ADMIN" | "MEMBER" | "VIEWER";
}

export function BoardPageClient({ boardId, boardName, boardDescription, userBoardRole }: BoardPageClientProps) {
  const [activeTab, setActiveTab] = useState<"board" | "sprints">("board");

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <BoardHeader
        boardId={boardId}
        boardName={boardName}
        boardDescription={boardDescription}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        userBoardRole={userBoardRole}
      />
      <div className="flex-1 overflow-hidden">
        {activeTab === "board" ? (
          <KanbanBoard boardId={boardId} userBoardRole={userBoardRole} />
        ) : (
          <div className="h-full overflow-y-auto">
            <SprintsView boardId={boardId} userBoardRole={userBoardRole} />
          </div>
        )}
      </div>
    </div>
  );
}

