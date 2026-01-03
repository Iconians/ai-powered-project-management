import { redirect } from "next/navigation";
import { getCurrentUser, getBoardMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function BoardsPage() {
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

  // Filter boards to only show those the user has access to
  // Organization admins see all boards in their organization
  const accessibleBoards = [];
  for (const org of organizations) {
    const userOrgMember = org.members.find((m) => m.userId === user.id);
    const isOrgAdmin = userOrgMember?.role === "ADMIN";
    
    for (const board of org.boards) {
      // Check if user has board access
      const boardMember = board.boardMembers.find(
        (bm) => bm.member && bm.member.userId === user.id
      );
      
      // Organization admins can see all boards, even if not explicitly added
      if (boardMember || isOrgAdmin) {
        accessibleBoards.push({
          ...board,
          userBoardRole: boardMember?.role || (isOrgAdmin ? "ADMIN" : "VIEWER"),
          organization: org,
        });
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Boards
          </h1>
          <div className="flex flex-col xs:flex-row gap-2 sm:gap-4">
            <Link
              href="/organizations"
              className="px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm sm:text-base text-center"
            >
              Manage Organizations
            </Link>
            <Link
              href="/organizations/new"
              className="px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm sm:text-base text-center"
            >
              New Organization
            </Link>
            <Link
              href="/boards/new"
              className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm sm:text-base text-center"
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
            {accessibleBoards.map((board) => (
              <Link
                key={board.id}
                href={`/boards/${board.id}`}
                className="block bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {board.name}
                  </h3>
                  <span className={`text-xs px-2 py-1 rounded ${
                    board.userBoardRole === "ADMIN"
                      ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                      : board.userBoardRole === "MEMBER"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                  }`}>
                    {board.userBoardRole}
                  </span>
                </div>
                {board.description && (
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                    {board.description}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500 dark:text-gray-500">
                    {board._count.tasks} tasks
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {board.organization.name}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

