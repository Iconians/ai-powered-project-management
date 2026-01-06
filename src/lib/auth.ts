import { prisma } from "./prisma";
import { authOptions } from "./auth-config";
import { getServerSession } from "next-auth";
import type { BoardMember, Member, User } from "@prisma/client";


type BoardMemberWithIncludes = BoardMember & {
  member: Member & {
    user: User;
  };
};

export async function getCurrentUser(): Promise<{
  id: string;
  email: string;
  name: string | null;
} | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }

  
  return {
    id: session.user.id,
    email: session.user.email || "",
    name: session.user.name || null,
  };
}

export async function getCurrentMember(organizationId: string) {
  const user = await getCurrentUser();
  if (!user) return null;

  const member = await prisma.member.findFirst({
    where: {
      userId: user.id,
      organizationId,
    },
    include: {
      organization: true,
      team: true,
    },
  });

  return member;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireMember(
  organizationId: string,
  role?: "ADMIN" | "MEMBER" | "VIEWER"
) {
  const member = await getCurrentMember(organizationId);
  if (!member) {
    throw new Error("Not a member of this organization");
  }
  if (role && member.role !== role && member.role !== "ADMIN") {
    throw new Error(`Requires ${role} role`);
  }
  return member;
}

export async function getBoardMember(
  boardId: string,
  userId?: string
): Promise<BoardMemberWithIncludes | null> {
  const user = userId ? { id: userId } : await getCurrentUser();
  if (!user) return null;

  
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { organizationId: true },
  });

  if (!board) return null;

  const orgMember = await prisma.member.findFirst({
    where: {
      userId: user.id,
      organizationId: board.organizationId,
    },
  });

  if (!orgMember) return null;

  
  const boardMember = await prisma.boardMember.findUnique({
    where: {
      boardId_memberId: {
        boardId,
        memberId: orgMember.id,
      },
    },
    include: {
      member: {
        include: {
          user: true,
        },
      },
    },
  });

  return boardMember;
}

export function hasBoardRole(
  userRole: "ADMIN" | "MEMBER" | "VIEWER",
  requiredRole: "ADMIN" | "MEMBER" | "VIEWER"
): boolean {
  const roleHierarchy = { ADMIN: 3, MEMBER: 2, VIEWER: 1 };
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

export async function requireBoardAccess(
  boardId: string,
  role?: "ADMIN" | "MEMBER" | "VIEWER"
) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      organization: true,
    },
  });

  if (!board) {
    throw new Error("Board not found");
  }

  
  const orgMember = await requireMember(board.organizationId);

  
  let boardMember = await getBoardMember(boardId, user.id);

  
  
  if (!boardMember && orgMember.role === "ADMIN") {
    
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser) {
      throw new Error("User not found");
    }

    
    
    boardMember = {
      id: `org-admin-${boardId}`,
      boardId,
      memberId: orgMember.id,
      role: "ADMIN" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      member: {
        ...orgMember,
        user: dbUser,
      },
    } as BoardMemberWithIncludes;
  }

  if (!boardMember) {
    throw new Error("No access to this board");
  }

  
  if (role && !hasBoardRole(boardMember.role, role)) {
    throw new Error(`Requires ${role} role on this board`);
  }

  return { boardMember, orgMember, board };
}

export async function requirePaidSubscription(organizationId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    include: {
      plan: true,
    },
  });

  if (!subscription) {
    throw new Error("No subscription found for this organization");
  }

  
  if (subscription.plan.price.toNumber() === 0) {
    throw new Error(
      "AI features require a paid subscription (Pro or Enterprise)"
    );
  }

  
  const isActive =
    subscription.status === "ACTIVE" ||
    subscription.status === "TRIALING" ||
    (subscription.status === "CANCELED" &&
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd > new Date());

  if (!isActive) {
    throw new Error(
      "AI features require an active paid subscription. Your subscription has expired."
    );
  }

  return subscription;
}
