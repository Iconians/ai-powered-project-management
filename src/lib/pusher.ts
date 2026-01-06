import Pusher from "pusher";


const pusherAppId = process.env.PUSHER_APP_ID;
const pusherKey = process.env.PUSHER_KEY;
const pusherSecret = process.env.PUSHER_SECRET;
const pusherCluster = process.env.PUSHER_CLUSTER || "us2";



export const pusherServer = new Pusher({
  appId: pusherAppId || "",
  key: pusherKey || "",
  secret: pusherSecret || "",
  cluster: pusherCluster,
  useTLS: true,
});


export async function triggerPusherEvent(
  channelName: string,
  eventName: string,
  data: unknown
) {
  if (!pusherAppId || !pusherKey || !pusherSecret) {
    return;
  }

  
  if (!/^[-a-zA-Z0-9_=@,.;]+$/.test(channelName)) {
    console.error(`Invalid channel name format: ${channelName}`);
    return;
  }

  if (channelName.length > 164) {
    console.error(
      `Channel name too long: ${channelName.length} chars (max 164)`
    );
    return;
  }

  
  if (!/^[-a-zA-Z0-9_=@,.;]+$/.test(eventName)) {
    console.error(`Invalid event name format: ${eventName}`);
    return;
  }

  try {
    await pusherServer.trigger(channelName, eventName, data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Pusher trigger error:`, errorMessage);
    throw error;
  }
}
