import { prisma } from "./prisma";
import { authOptions } from "./auth-config";
import { getServerSession } from "next-auth";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }

  // Return user in format compatible with existing code
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

export async function getBoardMember(boardId: string, userId?: string) {
  const user = userId ? { id: userId } : await getCurrentUser();
  if (!user) return null;

  // First check if user is a member of the organization
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

  // Then check board-specific access
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

  // Get the board to check organization
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      organization: true,
    },
  });

  if (!board) {
    throw new Error("Board not found");
  }

  // Check organization membership
  const orgMember = await requireMember(board.organizationId);

  // Check board access
  let boardMember = await getBoardMember(boardId, user.id);

  // Organization admins have access to all boards in their organization
  // If they don't have explicit board access, grant them ADMIN access
  if (!boardMember && orgMember.role === "ADMIN") {
    // Get the user for the virtual board member
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    
    if (!dbUser) {
      throw new Error("User not found");
    }

    // Create a virtual board member for organization admins
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
    } as any;
  }

  if (!boardMember) {
    throw new Error("No access to this board");
  }

  // Check role if specified
  if (role && !hasBoardRole(boardMember.role, role)) {
    throw new Error(`Requires ${role} role on this board`);
  }

  return { boardMember, orgMember, board };
}
