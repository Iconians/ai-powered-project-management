"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

interface CreateSprintModalProps {
  boardId: string;
  onClose: () => void;
  onSprintCreated?: (sprintId: string) => void;
}

export function CreateSprintModal({
  boardId,
  onClose,
  onSprintCreated,
}: CreateSprintModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [goal, setGoal] = useState("");
  const [isActive, setIsActive] = useState(false);
  const queryClient = useQueryClient();

  
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoWeeksFromNow = new Date(today);
    twoWeeksFromNow.setDate(today.getDate() + 14);

    setStartDate((prev) => prev || today);
    setEndDate((prev) => prev || twoWeeksFromNow);
  }, []);

  const createSprintMutation = useMutation({
    mutationFn: async () => {
      if (!startDate || !endDate) {
        throw new Error("Start date and end date are required");
      }
      const res = await fetch("/api/sprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          boardId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          goal,
          isActive,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create sprint");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sprints", boardId] });
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      if (onSprintCreated) {
        onSprintCreated(data.id);
      }
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate) return;

    if (endDate <= startDate) {
      alert("End date must be after start date");
      return;
    }

    createSprintMutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Create Sprint
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Sprint Name *
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Sprint 1"
            />
          </div>
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Sprint description"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="startDate"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Start Date *
              </label>
              <DatePicker
                id="startDate"
                selected={startDate}
                onChange={(date: Date | null) => setStartDate(date)}
                selectsStart
                startDate={startDate || undefined}
                endDate={endDate || undefined}
                dateFormat="MMM d, yyyy"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                wrapperClassName="w-full"
                required
              />
            </div>
            <div>
              <label
                htmlFor="endDate"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                End Date *
              </label>
              <DatePicker
                id="endDate"
                selected={endDate}
                onChange={(date: Date | null) => setEndDate(date)}
                selectsEnd
                startDate={startDate || undefined}
                endDate={endDate || undefined}
                minDate={startDate || undefined}
                dateFormat="MMM d, yyyy"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                wrapperClassName="w-full"
                required
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="goal"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Sprint Goal
            </label>
            <input
              id="goal"
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="What do we want to achieve in this sprint?"
            />
          </div>
          <div className="flex items-center">
            <input
              id="isActive"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label
              htmlFor="isActive"
              className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
            >
              Set as active sprint
            </label>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                createSprintMutation.isPending ||
                !name.trim() ||
                !startDate ||
                !endDate
              }
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createSprintMutation.isPending ? "Creating..." : "Create Sprint"}
            </button>
          </div>
        </form>
        {createSprintMutation.isError && (
          <div className="mt-4 text-red-600 dark:text-red-400 text-sm">
            {createSprintMutation.error?.message || "Failed to create sprint"}
          </div>
        )}
      </div>
    </div>
  );
}
