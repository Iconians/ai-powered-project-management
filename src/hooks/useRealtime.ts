"use client";

import { useEffect, useState, useRef } from "react";
import Pusher from "pusher-js";

interface RealtimeOptions {
  channelName: string;
  eventName: string;
  callback: (data: unknown) => void;
}


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

    
    if (!globalPusher) {
      globalPusher = new Pusher(pusherKey, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "us2",
        
        authEndpoint:
          channelName.startsWith("private-") ||
          channelName.startsWith("presence-")
            ? "/api/pusher/auth"
            : undefined,
        enabledTransports: ["ws", "wss"], 
      });

      globalPusher.connection.bind("connected", () => {
        setIsConnected(true);
      });

      globalPusher.connection.bind("disconnected", () => {
        setIsConnected(false);
      });

      globalPusher.connection.bind("error", (err: Error) => {
        console.error("Pusher connection error:", err);
      });
    }

    
    const channel = globalPusher.subscribe(channelName);
    channelRef.current = channel;

    
    const eventHandler = (data: unknown) => {
      callbackRef.current(data);
    };

    
    const subscriptionHandler = () => {
      channel.bind(eventName, eventHandler);
    };

    
    const errorHandler = (status: number | Error) => {
      console.error(
        `Pusher subscription error for channel ${channelName}:`,
        status
      );
    };

    
    channel.bind("pusher:subscription_succeeded", subscriptionHandler);
    channel.bind("pusher:subscription_error", errorHandler);

    
    if (channel.subscribed) {
      channel.bind(eventName, eventHandler);
    }

    return () => {
      if (channelRef.current) {
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
