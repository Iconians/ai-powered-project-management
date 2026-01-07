"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface TimeEntry {
  id: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  billable: boolean;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface TimeTrackerProps {
  taskId: string;
  boardId: string;
  userBoardRole?: "ADMIN" | "MEMBER" | "VIEWER";
}

export function TimeTracker({
  taskId,
  boardId,
  userBoardRole,
}: TimeTrackerProps) {
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [description, setDescription] = useState("");

  const { data: timeEntries, isLoading } = useQuery({
    queryKey: ["time-entries", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/time`);
      if (!res.ok) throw new Error("Failed to fetch time entries");
      return res.json() as Promise<TimeEntry[]>;
    },
  });

  const startTimerMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const res = await fetch(`/api/tasks/${taskId}/time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: now.toISOString(),
          description: description || null,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to start timer");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries", taskId] });
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      setIsRunning(true);
      setStartTime(new Date());
      setElapsed(0);
    },
  });

  const stopTimerMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const now = new Date();
      const duration = Math.floor((now.getTime() - startTime!.getTime()) / 1000);
      const res = await fetch(`/api/tasks/${taskId}/time`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId,
          endTime: now.toISOString(),
          duration,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to stop timer");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries", taskId] });
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      setIsRunning(false);
      setStartTime(null);
      setElapsed(0);
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const res = await fetch(`/api/tasks/${taskId}/time?entryId=${entryId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete entry");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries", taskId] });
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
  });

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && startTime) {
      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, startTime]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const canEdit = userBoardRole === "ADMIN" || userBoardRole === "MEMBER";
  const entries = timeEntries || [];
  const totalSeconds = entries.reduce((sum, entry) => sum + (entry.duration || 0), 0);

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading time entries...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
          Time Tracking
        </h3>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Total: {formatDuration(totalSeconds)}
        </div>
      </div>

      {canEdit && (
        <div className="space-y-2">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What are you working on?"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            disabled={isRunning}
          />
          {!isRunning ? (
            <button
              onClick={() => startTimerMutation.mutate()}
              disabled={startTimerMutation.isPending}
              className="w-full px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              Start Timer
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex-1 px-4 py-2 bg-red-50 dark:bg-red-900/20 rounded text-center">
                <div className="text-lg font-mono text-red-600 dark:text-red-400">
                  {formatDuration(elapsed)}
                </div>
              </div>
              <button
                onClick={() => {
                  // Find the running entry and stop it
                  const runningEntry = entries.find((e) => !e.endTime);
                  if (runningEntry) {
                    stopTimerMutation.mutate(runningEntry.id);
                  }
                }}
                disabled={stopTimerMutation.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                Stop
              </button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded"
          >
            <div className="flex-1">
              <div className="text-sm text-gray-900 dark:text-white">
                {entry.description || "No description"}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {entry.user.name || entry.user.email} •{" "}
                {entry.duration ? formatDuration(entry.duration) : "Running..."}
              </div>
            </div>
            {canEdit && (
              <button
                onClick={() => deleteEntryMutation.mutate(entry.id)}
                className="text-red-600 hover:text-red-700 text-sm ml-2"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

