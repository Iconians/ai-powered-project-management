"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface PrioritySuggestionsProps {
  taskIds: string[];
  boardId: string;
  onApply?: (suggestions: Array<{ taskId: string; priority: string }>) => void;
}

interface Suggestion {
  taskId: string;
  priority: string;
  reasoning: string;
}

export function PrioritySuggestions({
  taskIds,
  boardId,
  onApply,
}: PrioritySuggestionsProps) {
  const queryClient = useQueryClient();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/prioritize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds, boardId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to analyze priorities");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSuggestions(data.suggestions || []);
    },
  });

  const applyMutation = useMutation({
    mutationFn: async (suggestions: Suggestion[]) => {
      // Apply priorities in bulk
      const res = await fetch("/api/tasks/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskIds: suggestions.map((s) => s.taskId),
          updates: {
            priority: suggestions[0].priority, // Apply first suggestion's priority
          },
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to apply priorities");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      if (onApply) {
        onApply(suggestions);
      }
    },
  });

  return (
    <div className="space-y-4">
      <button
        onClick={() => analyzeMutation.mutate()}
        disabled={analyzeMutation.isPending}
        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
      >
        {analyzeMutation.isPending ? "Analyzing..." : "Get AI Priority Suggestions"}
      </button>

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900 dark:text-white">
            AI Suggestions:
          </h4>
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.taskId}
              className="p-3 bg-gray-50 dark:bg-gray-800 rounded"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    Priority: {suggestion.priority}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {suggestion.reasoning}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={() => applyMutation.mutate(suggestions)}
            disabled={applyMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {applyMutation.isPending ? "Applying..." : "Apply Suggestions"}
          </button>
        </div>
      )}
    </div>
  );
}

