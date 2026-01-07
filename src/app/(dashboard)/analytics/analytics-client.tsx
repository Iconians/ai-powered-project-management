"use client";

import { useState } from "react";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";

interface AnalyticsPageClientProps {
  organizations: Array<{ id: string; name: string }>;
}

export function AnalyticsPageClient({
  organizations,
}: AnalyticsPageClientProps) {
  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    organizations[0]?.id || ""
  );

  if (organizations.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Analytics
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          You need to be a member of an organization to view analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
        <AnalyticsDashboard organizationId={selectedOrgId} />
      </div>
    </div>
  );
}

