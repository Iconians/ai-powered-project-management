import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuditLogsPageClient } from "./audit-logs-client";

export default async function AuditLogsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Get user's organizations where they are admin
  const members = await prisma.member.findMany({
    where: {
      userId: user.id,
      role: "ADMIN",
    },
    include: {
      organization: true,
    },
  });

  return (
    <AuditLogsPageClient
      organizations={members.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
      }))}
    />
  );
}

