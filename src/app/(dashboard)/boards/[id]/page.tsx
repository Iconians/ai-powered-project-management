import { redirect } from "next/navigation";
import { requireBoardAccess } from "@/lib/auth";
import { BoardPageClient } from "./board-client";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    
    const { board, boardMember } = await requireBoardAccess(id);

    return (
      <BoardPageClient
        boardId={id}
        boardName={board.name}
        boardDescription={board.description}
        userBoardRole={boardMember.role}
        organizationId={board.organizationId}
      />
    );
  } catch (error) {
    
    redirect("/boards");
  }
}
