"use client";

import { useEffect, useState, useRef } from "react";
import Pusher from "pusher-js";

interface RealtimeOptions {
  channelName: string;
  eventName: string;
  callback: (data: unknown) => void;
}

// Shared Pusher instance across all hooks
let globalPusher: Pusher | null = null;

export function useRealtime({
  channelName,
  eventName,
  callback,
}: RealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const callbackRef = useRef(callback);
  const channelRef = useRef<ReturnType<Pusher["subscribe"]> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    if (!pusherKey) {
      console.warn("Pusher key not found, real-time updates disabled");
      return;
    }

    // Initialize shared Pusher instance
    if (!globalPusher) {
      globalPusher = new Pusher(pusherKey, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "us2",
        // Only use auth endpoint for private/presence channels
        authEndpoint:
          channelName.startsWith("private-") ||
          channelName.startsWith("presence-")
            ? "/api/pusher/auth"
            : undefined,
        enabledTransports: ["ws", "wss"], // Force WebSocket transport
      });

      // Connection state logging
      globalPusher.connection.bind("connected", () => {
        console.log("✅ Pusher connected");
        setIsConnected(true);
      });

      globalPusher.connection.bind("disconnected", () => {
        console.log("❌ Pusher disconnected");
        setIsConnected(false);
      });

      globalPusher.connection.bind("error", (err: Error) => {
        console.error("Pusher connection error:", err);
      });

      globalPusher.connection.bind(
        "state_change",
        (states: { previous: string; current: string }) => {
          console.log(
            "Pusher state changed:",
            states.previous,
            "->",
            states.current
          );
        }
      );
    }

    // Subscribe to channel and wait for subscription
    const channel = globalPusher.subscribe(channelName);
    channelRef.current = channel;

    // Handler for the event
    const eventHandler = (data: unknown) => {
      console.log(`📨 Received event ${eventName} on ${channelName}:`, data);
      callbackRef.current(data);
    };

    // Handler for subscription success
    const subscriptionHandler = () => {
      console.log(`✅ Subscribed to channel: ${channelName}`);
      // Bind to event after successful subscription
      channel.bind(eventName, eventHandler);
    };

    // Handler for subscription error
    const errorHandler = (status: number | Error) => {
      console.error(
        `❌ Subscription error for channel ${channelName}:`,
        status
      );
    };

    // Check if already subscribed
    if (channel.subscribed) {
      console.log(`✅ Channel ${channelName} already subscribed`);
      channel.bind(eventName, eventHandler);
    } else {
      // Wait for subscription
      channel.bind("pusher:subscription_succeeded", subscriptionHandler);
    }

    channel.bind("pusher:subscription_error", errorHandler);

    return () => {
      if (channelRef.current) {
        console.log(`🔌 Unsubscribing from ${channelName}`);
        channelRef.current.unbind(eventName, eventHandler);
        channelRef.current.unbind(
          "pusher:subscription_succeeded",
          subscriptionHandler
        );
        channelRef.current.unbind("pusher:subscription_error", errorHandler);
        globalPusher?.unsubscribe(channelName);
        channelRef.current = null;
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
