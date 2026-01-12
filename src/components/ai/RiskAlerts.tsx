"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface RiskAlertsProps {
  boardId: string;
}

interface Risk {
  type: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  recommendation: string;
}

export function RiskAlerts({ boardId }: RiskAlertsProps) {
  const [dismissedRisks, setDismissedRisks] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["ai-risks", boardId],
    queryFn: async () => {
      const res = await fetch("/api/ai/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId }),
      });
      if (!res.ok) return { risks: [] };
      return res.json() as Promise<{ risks: Risk[] }>;
    },
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  if (isLoading) {
    return null;
  }

  const risks = data?.risks || [];
  const visibleRisks = risks.filter((r) => !dismissedRisks.has(r.type));

  if (visibleRisks.length === 0) {
    return null;
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "HIGH":
        return "bg-red-100 border-red-500 text-red-800 dark:bg-red-900/20 dark:border-red-500 dark:text-red-200";
      case "MEDIUM":
        return "bg-yellow-100 border-yellow-500 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-500 dark:text-yellow-200";
      case "LOW":
        return "bg-blue-100 border-blue-500 text-blue-800 dark:bg-blue-900/20 dark:border-blue-500 dark:text-blue-200";
      default:
        return "bg-gray-100 border-gray-500 text-gray-800 dark:bg-gray-900/20 dark:border-gray-500 dark:text-gray-200";
    }
  };

  return (
    <div className="space-y-2 mb-4">
      {visibleRisks.map((risk) => (
        <div
          key={risk.type}
          className={`p-4 border-l-4 rounded ${getSeverityColor(risk.severity)}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold">{risk.severity} Risk</span>
                <span className="text-xs opacity-75">{risk.type}</span>
              </div>
              <p className="text-sm mb-2">{risk.description}</p>
              <p className="text-xs opacity-90">
                <strong>Recommendation:</strong> {risk.recommendation}
              </p>
            </div>
            <button
              onClick={() => {
                setDismissedRisks((prev) => new Set(prev).add(risk.type));
              }}
              className="ml-4 text-sm opacity-75 hover:opacity-100"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

