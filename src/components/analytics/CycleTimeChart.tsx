"use client";

interface CycleTimeChartProps {
  data: {
    averageCycleTime: number;
    tasksOverTime: Array<{
      date: string;
      status: string;
      completedAt: string | null;
    }>;
  };
}

export function CycleTimeChart({ data }: CycleTimeChartProps) {
  // Calculate cycle times for completed tasks
  const cycleTimes = data.tasksOverTime
    .filter((task) => task.status === "DONE" && task.completedAt)
    .map((task) => {
      const created = new Date(task.date).getTime();
      const completed = new Date(task.completedAt!).getTime();
      return (completed - created) / (1000 * 60 * 60 * 24); // days
    });

  // Group into buckets
  const buckets = {
    "0-1": 0,
    "1-3": 0,
    "3-7": 0,
    "7-14": 0,
    "14+": 0,
  };

  cycleTimes.forEach((time) => {
    if (time <= 1) buckets["0-1"]++;
    else if (time <= 3) buckets["1-3"]++;
    else if (time <= 7) buckets["3-7"]++;
    else if (time <= 14) buckets["7-14"]++;
    else buckets["14+"]++;
  });

  const maxCount = Math.max(...Object.values(buckets));

  return (
    <div className="h-48 flex items-end justify-between gap-2">
      {Object.entries(buckets).map(([range, count]) => (
        <div key={range} className="flex-1 flex flex-col items-center">
          <div
            className="w-full bg-purple-600 rounded-t"
            style={{
              height: maxCount > 0 ? `${(count / maxCount) * 100}%` : "0%",
            }}
            title={`${count} tasks (${range} days)`}
          />
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 text-center">
            <div>{range} days</div>
            <div className="font-medium">{count}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

