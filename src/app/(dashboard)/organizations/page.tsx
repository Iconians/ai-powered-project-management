import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrganizationsList } from "@/components/organizations/OrganizationsList";

export default async function OrganizationsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const organizations = await prisma.organization.findMany({
    where: {
      members: {
        some: {
          userId: user.id,
        },
      },
    },
    include: {
      members: {
        where: {
          userId: user.id,
        },
        select: {
          role: true,
        },
      },
      _count: {
        select: {
          members: true,
          boards: true,
        },
      },
    },
  });

  return <OrganizationsList organizations={organizations} currentUserId={user.id} />;
}


