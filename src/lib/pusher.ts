import Pusher from "pusher";

// Validate Pusher configuration
const pusherAppId = process.env.PUSHER_APP_ID;
const pusherKey = process.env.PUSHER_KEY;
const pusherSecret = process.env.PUSHER_SECRET;
const pusherCluster = process.env.PUSHER_CLUSTER || "us2";

// Pusher configuration validation happens in triggerPusherEvent

export const pusherServer = new Pusher({
  appId: pusherAppId || "",
  key: pusherKey || "",
  secret: pusherSecret || "",
  cluster: pusherCluster,
  useTLS: true,
});

// Helper function to safely trigger events with validation
export async function triggerPusherEvent(
  channelName: string,
  eventName: string,
  data: unknown
) {
  if (!pusherAppId || !pusherKey || !pusherSecret) {
    return;
  }

  // Validate channel name (Pusher requirements)
  if (!/^[-a-zA-Z0-9_=@,.;]+$/.test(channelName)) {
    console.error(`Invalid channel name format: ${channelName}`);
    return;
  }

  if (channelName.length > 164) {
    console.error(`Channel name too long: ${channelName.length} chars (max 164)`);
    return;
  }

  // Validate event name (Pusher requirements)
  if (!/^[-a-zA-Z0-9_=@,.;]+$/.test(eventName)) {
    console.error(`Invalid event name format: ${eventName}`);
    return;
  }

  try {
    await pusherServer.trigger(channelName, eventName, data);
  } catch (error: any) {
    console.error(`Pusher trigger error:`, error?.message || error);
    throw error;
  }
}


