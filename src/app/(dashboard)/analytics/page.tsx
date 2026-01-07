import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AnalyticsPageClient } from "./analytics-client";

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Get user's organizations
  const members = await prisma.member.findMany({
    where: { userId: user.id },
    include: {
      organization: true,
    },
  });

  return (
    <AnalyticsPageClient
      organizations={members.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
      }))}
    />
  );
}

