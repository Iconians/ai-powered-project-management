"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "../notifications/NotificationBell";

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [showMenu, setShowMenu] = useState(false);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  if (
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/signup") ||
    pathname === "/" ||
    pathname === "/home"
  ) {
    return null;
  }

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-2 xs:px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-4">
            <Link
              href="/boards"
              className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent hover:from-blue-700 hover:to-purple-700 dark:hover:from-blue-300 dark:hover:to-purple-300 transition-all"
            >
              IntelliTask Pro
            </Link>
            <div className="hidden sm:flex items-center gap-4">
              <Link
                href="/boards"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  pathname?.startsWith("/boards")
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Boards
              </Link>
              <Link
                href="/organizations"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  pathname?.startsWith("/organizations")
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Organizations
              </Link>
              <Link
                href="/billing"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  pathname?.startsWith("/billing")
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Plans
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {session?.user && <NotificationBell />}
            <ThemeToggle />

            {session?.user && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
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
                    <div className="absolute right-0 mt-2 w-48 xs:w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl py-1 z-20 border border-gray-200 dark:border-gray-700 backdrop-blur-sm max-w-[calc(100vw-2rem)]">
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
                        className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all rounded-md mx-1"
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

        {}
        <div className="sm:hidden pb-4">
          <div className="flex flex-col gap-2">
            <Link
              href="/boards"
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                pathname?.startsWith("/boards")
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              Boards
            </Link>
            <Link
              href="/organizations"
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                pathname?.startsWith("/organizations")
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              Organizations
            </Link>
            <Link
              href="/billing"
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                pathname?.startsWith("/billing")
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              Plans
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
