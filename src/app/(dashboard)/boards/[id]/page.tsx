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
    // Check board access (requires both org membership and board access)
    const { board, boardMember } = await requireBoardAccess(id);

    return (
      <BoardPageClient
        boardId={id}
        boardName={board.name}
        boardDescription={board.description}
        userBoardRole={boardMember.role}
      />
    );
  } catch (error) {
    // Redirect if no access
    redirect("/boards");
  }
}
