"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRealtime } from "@/hooks/useRealtime";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?limit=20");
      if (!res.ok) return [];
      return res.json() as Promise<Notification[]>;
    },
    enabled: !!session,
  });

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  // Listen for new notifications
  useRealtime({
    channelName: session?.user?.id ? `user-${session.user.id}` : "",
    eventName: "notification-created",
    callback: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId, read: true }),
      });
      if (!res.ok) throw new Error("Failed to mark as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  if (!session) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-600 ring-2 ring-white dark:ring-gray-800" />
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] xs:w-80 max-w-[calc(100vw-2rem)] xs:max-w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 text-sm text-blue-600 dark:text-blue-400">
                    ({unreadCount} new)
                  </span>
                )}
              </h3>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {notifications && notifications.length > 0 ? (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                      !notification.read ? "bg-blue-50 dark:bg-blue-900/20" : ""
                    }`}
                    onClick={() => {
                      if (!notification.read) {
                        markAsReadMutation.mutate(notification.id);
                      }
                      if (notification.link) {
                        window.location.href = notification.link;
                      }
                      setIsOpen(false);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                          {notification.title}
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {!notification.read && (
                        <span className="ml-2 h-2 w-2 rounded-full bg-blue-600" />
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No notifications
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

