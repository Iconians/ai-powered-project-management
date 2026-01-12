"use client";

interface VelocityChartProps {
  data: {
    velocity: number;
    completedTasks: number;
  };
}

export function VelocityChart({ data }: VelocityChartProps) {
  return (
    <div className="h-48 flex items-end justify-center gap-2">
      <div className="flex flex-col items-center">
        <div
          className="w-16 bg-blue-600 rounded-t"
          style={{ height: `${Math.min((data.velocity / 50) * 100, 100)}%` }}
        />
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {data.velocity} tasks
        </div>
      </div>
    </div>
  );
}

