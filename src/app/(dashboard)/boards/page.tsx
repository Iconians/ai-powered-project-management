import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
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
      boards: {
        include: {
          _count: {
            select: { tasks: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {organizations.map((org) =>
              org.boards.map((board) => (
                <Link
                  key={board.id}
                  href={`/boards/${board.id}`}
                  className="block bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
                >
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {board.name}
                  </h3>
                  {board.description && (
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                      {board.description}
                    </p>
                  )}
                  <div className="text-sm text-gray-500 dark:text-gray-500">
                    {board._count.tasks} tasks
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

