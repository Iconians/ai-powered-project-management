"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { VelocityChart } from "./VelocityChart";
import { BurndownChart } from "./BurndownChart";
import { CycleTimeChart } from "./CycleTimeChart";

interface AnalyticsDashboardProps {
  boardId?: string;
  organizationId?: string;
  sprintId?: string;
}

export function AnalyticsDashboard({
  boardId,
  organizationId,
  sprintId,
}: AnalyticsDashboardProps) {
  const [period, setPeriod] = useState<"week" | "month" | "quarter" | "year">(
    "month"
  );

  const { data: analytics, isLoading } = useQuery({
    queryKey: ["analytics", boardId, organizationId, sprintId, period],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (boardId) params.append("boardId", boardId);
      if (organizationId) params.append("organizationId", organizationId);
      if (sprintId) params.append("sprintId", sprintId);
      params.append("period", period);

      const res = await fetch(`/api/analytics?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
  });

  if (isLoading) {
    return <div className="p-4">Loading analytics...</div>;
  }

  if (!analytics) {
    return <div className="p-4">No analytics data available</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Analytics Dashboard
        </h1>
        <select
          value={period}
          onChange={(e) =>
            setPeriod(e.target.value as "week" | "month" | "quarter" | "year")
          }
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="week">Last Week</option>
          <option value="month">Last Month</option>
          <option value="quarter">Last Quarter</option>
          <option value="year">Last Year</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Total Tasks
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {analytics.totalTasks}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Completed
          </div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {analytics.completedTasks}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Completion Rate
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {analytics.completionRate}%
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Avg Cycle Time
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {analytics.averageCycleTime.toFixed(1)} days
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Velocity
          </h2>
          <VelocityChart data={analytics} />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Burndown
          </h2>
          <BurndownChart data={analytics} />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Cycle Time Distribution
          </h2>
          <CycleTimeChart data={analytics} />
        </div>
      </div>

      {/* Status and Priority Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Tasks by Status
          </h2>
          <div className="space-y-2">
            {analytics.tasksByStatus.map((item: any) => (
              <div key={item.status} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {item.status}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Tasks by Priority
          </h2>
          <div className="space-y-2">
            {analytics.tasksByPriority.map((item: any) => (
              <div key={item.priority} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {item.priority}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

