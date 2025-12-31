import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BoardPageClient } from "./board-client";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const board = await prisma.board.findUnique({
    where: { id },
    include: {
      organization: true,
    },
  });

  if (!board) {
    redirect("/boards");
  }

  // Check if user is a member
  const member = await prisma.member.findFirst({
    where: {
      userId: user.id,
      organizationId: board.organizationId,
    },
  });

  if (!member) {
    redirect("/boards");
  }

  return (
    <BoardPageClient
      boardId={id}
      boardName={board.name}
      boardDescription={board.description}
    />
  );
}
