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
