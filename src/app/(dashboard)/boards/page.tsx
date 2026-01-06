import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { BoardSettings } from "@/components/boards/BoardSettings";

export default async function BoardsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  let organizations;
  try {
    organizations = await prisma.organization.findMany({
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
      },
      boards: {
        include: {
          _count: {
            select: { tasks: true },
          },
          boardMembers: {
            include: {
              member: {
                include: {
                  user: {
                    select: {
                      id: true,
                      email: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400 mb-4">
              An error occurred while loading boards. Please try again later.
            </p>
            <Link
              href="/boards"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Refresh
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const accessibleBoards = [];
  for (const org of organizations) {
    const userOrgMember = org.members.find((m) => m.userId === user.id);
    const isOrgAdmin = userOrgMember?.role === "ADMIN";

    for (const board of org.boards) {
      
      const boardMember = board.boardMembers.find(
        (bm) => bm.member && bm.member.userId === user.id
      );

      
      if (boardMember || isOrgAdmin) {
        accessibleBoards.push({
          ...board,
          userBoardRole: boardMember?.role || (isOrgAdmin ? "ADMIN" : "VIEWER"),
          organization: { ...org, isOrgAdmin },
        });
      }
    }
  }

  
  if (organizations.length === 0) {
    redirect("/organizations/new?onboarding=true");
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Boards
          </h1>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Link
              href="/organizations"
              className="px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-xs sm:text-sm whitespace-nowrap"
            >
              <span className="hidden sm:inline">Manage Organizations</span>
              <span className="sm:hidden">Organizations</span>
            </Link>
            <Link
              href="/profile"
              className="px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-xs sm:text-sm whitespace-nowrap"
            >
              Profile
            </Link>
            <Link
              href="/organizations/new"
              className="px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-xs sm:text-sm whitespace-nowrap"
            >
              <span className="hidden sm:inline">New Organization</span>
              <span className="sm:hidden">New Org</span>
            </Link>
            <Link
              href="/boards/new"
              className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs sm:text-sm whitespace-nowrap"
            >
              Create Board
            </Link>
          </div>
        </div>

        {organizations.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No organizations found. Create one to get started.
            </p>
            <Link
              href="/organizations/new"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Create Organization
            </Link>
          </div>
        ) : accessibleBoards.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No boards available. You need to be granted access to boards.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accessibleBoards.map((board) => {
              const isOrgAdmin = board.organization.isOrgAdmin || false;

              return (
                <div
                  key={board.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2 mb-2 overflow-hidden">
                    <Link href={`/boards/${board.id}`} className="flex-1 min-w-0">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate">
                        {board.name}
                      </h3>
                    </Link>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`text-xs px-2 py-1 rounded whitespace-nowrap ${
                          board.userBoardRole === "ADMIN"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                            : board.userBoardRole === "MEMBER"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {board.userBoardRole}
                      </span>
                      {isOrgAdmin && (
                        <BoardSettings
                          boardId={board.id}
                          boardName={board.name}
                          organizationId={board.organizationId}
                          isOrgAdmin={isOrgAdmin}
                        />
                      )}
                    </div>
                  </div>
                  {board.description && (
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                      {board.description}
                    </p>
                  )}
                  <Link href={`/boards/${board.id}`} className="block">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-500 dark:text-gray-500">
                        {board._count.tasks} tasks
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {board.organization.name}
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
