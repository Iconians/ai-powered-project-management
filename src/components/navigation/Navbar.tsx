"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [showMenu, setShowMenu] = useState(false);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  // Don't show navbar on auth pages
  if (pathname?.startsWith("/login") || pathname?.startsWith("/signup")) {
    return null;
  }

  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-4">
            <Link
              href="/boards"
              className="text-xl font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Project Manager
            </Link>
            <div className="hidden sm:flex items-center gap-4">
              <Link
                href="/boards"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname?.startsWith("/boards")
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                Boards
              </Link>
              <Link
                href="/organizations"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname?.startsWith("/organizations")
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                Organizations
              </Link>
              <Link
                href="/billing"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname?.startsWith("/billing")
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                Billing
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {session?.user && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <span className="hidden sm:inline">{session.user.email}</span>
                  <span className="sm:hidden">👤</span>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {showMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-20 border border-gray-200 dark:border-gray-700">
                      <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                        <div className="font-medium">
                          {session.user.name || "User"}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {session.user.email}
                        </div>
                      </div>
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile menu */}
        <div className="sm:hidden pb-4">
          <div className="flex flex-col gap-2">
            <Link
              href="/boards"
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                pathname?.startsWith("/boards")
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                  : "text-gray-600 dark:text-gray-300"
              }`}
            >
              Boards
            </Link>
            <Link
              href="/organizations"
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                pathname?.startsWith("/organizations")
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                  : "text-gray-600 dark:text-gray-300"
              }`}
            >
              Organizations
            </Link>
            <Link
              href="/billing"
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                pathname?.startsWith("/billing")
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                  : "text-gray-600 dark:text-gray-300"
              }`}
            >
              Billing
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
