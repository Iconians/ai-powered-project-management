"use client";

interface BurndownChartProps {
  data: {
    tasksOverTime: Array<{
      date: string;
      status: string;
      completedAt: string | null;
    }>;
  };
}

export function BurndownChart({ data }: BurndownChartProps) {
  // Group tasks by date
  const tasksByDate = data.tasksOverTime.reduce((acc: any, task) => {
    const date = new Date(task.date).toLocaleDateString();
    if (!acc[date]) {
      acc[date] = { total: 0, completed: 0 };
    }
    acc[date].total++;
    if (task.status === "DONE") {
      acc[date].completed++;
    }
    return acc;
  }, {});

  const dates = Object.keys(tasksByDate).sort();
  const maxTasks = Math.max(
    ...Object.values(tasksByDate).map((d: any) => d.total)
  );

  return (
    <div className="h-48 flex items-end justify-between gap-1">
      {dates.map((date, index) => {
        const dayData = tasksByDate[date];
        const remaining = dayData.total - dayData.completed;
        return (
          <div key={date} className="flex-1 flex flex-col items-center">
            <div className="w-full flex flex-col-reverse gap-0.5">
              <div
                className="bg-red-500 rounded-t"
                style={{
                  height: `${(remaining / maxTasks) * 100}%`,
                }}
                title={`${remaining} remaining on ${date}`}
              />
              <div
                className="bg-green-500 rounded-t"
                style={{
                  height: `${(dayData.completed / maxTasks) * 100}%`,
                }}
                title={`${dayData.completed} completed on ${date}`}
              />
            </div>
            {index % Math.ceil(dates.length / 7) === 0 && (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 transform -rotate-45 origin-left">
                {new Date(date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

