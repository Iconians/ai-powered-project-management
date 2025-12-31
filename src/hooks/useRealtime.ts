"use client";

import { useEffect, useState, useRef } from "react";
import Pusher from "pusher-js";

interface RealtimeOptions {
  channelName: string;
  eventName: string;
  callback: (data: unknown) => void;
}

export function useRealtime({ channelName, eventName, callback }: RealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const callbackRef = useRef(callback);
  const pusherRef = useRef<Pusher | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    if (!pusherKey) {
      console.warn("Pusher key not found, real-time updates disabled");
      return;
    }

    // Initialize Pusher
    if (!pusherRef.current) {
      pusherRef.current = new Pusher(pusherKey, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "us2",
        // Only use auth endpoint for private/presence channels
        authEndpoint: channelName.startsWith("private-") || channelName.startsWith("presence-")
          ? "/api/pusher/auth"
          : undefined,
      });

      pusherRef.current.connection.bind("connected", () => {
        setIsConnected(true);
      });

      pusherRef.current.connection.bind("disconnected", () => {
        setIsConnected(false);
      });
    }

    // Subscribe to channel (public channels don't need auth)
    const channel = pusherRef.current.subscribe(channelName);
    channelRef.current = channel;

    // Bind to event
    channel.bind(eventName, (data: unknown) => {
      callbackRef.current(data);
    });

    return () => {
      if (channelRef.current) {
        channelRef.current.unbind(eventName);
        pusherRef.current?.unsubscribe(channelName);
      }
    };
  }, [channelName, eventName]);

  return { isConnected };
}

// Alternative: Polling-based realtime (simpler, no external service)
export function useRealtimePolling<T>(
  fetchFn: () => Promise<T>,
  interval: number = 2000
) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await fetchFn();
        setData(result);
        setIsLoading(false);
      } catch (error) {
        console.error("Polling error:", error);
        setIsLoading(false);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, interval);

    return () => clearInterval(intervalId);
  }, [fetchFn, interval]);

  return { data, isLoading };
}
