"use client";

import { useState } from "react";
import Link from "next/link";
import { OrganizationMembers } from "./OrganizationMembers";

interface Organization {
  id: string;
  name: string;
  members: Array<{ role: string }>;
  _count: {
    members: number;
    boards: number;
  };
}

interface OrganizationsListProps {
  organizations: Organization[];
  currentUserId: string;
}

export function OrganizationsList({
  organizations,
  currentUserId: _currentUserId,
}: OrganizationsListProps) {
  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null);

  if (organizations.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Organizations
          </h1>
          <Link
            href="/organizations/new"
            className="px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm sm:text-base text-center"
          >
            New Organization
          </Link>
        </div>

        <div className="space-y-4">
          {organizations.map((org) => {
            const isAdmin = org.members[0]?.role === "ADMIN";
            const isExpanded = expandedOrgId === org.id;

            return (
              <div
                key={org.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                      {org.name}
                    </h2>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>
                        {org._count.members} member
                        {org._count.members !== 1 ? "s" : ""}
                      </span>
                      <span>•</span>
                      <span>
                        {org._count.boards} board
                        {org._count.boards !== 1 ? "s" : ""}
                      </span>
                      {isAdmin && (
                        <>
                          <span>•</span>
                          <span className="text-purple-600 dark:text-purple-400 font-medium">
                            Admin
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedOrgId(isExpanded ? null : org.id)}
                    className="px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    {isExpanded ? "Hide Members" : "Manage Members"}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <OrganizationMembers
                      organizationId={org.id}
                      isAdmin={isAdmin}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
