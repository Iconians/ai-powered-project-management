import { NextRequest, NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { socket_id, channel_name } = body;

    // Authorize private channels (you can add more logic here)
    if (channel_name.startsWith("private-")) {
      const auth = pusherServer.authorizeChannel(socket_id, channel_name, {
        user_id: user.id,
        user_info: {
          email: user.email,
          name: user.name,
        },
      });
      return NextResponse.json(auth);
    }

    // For presence channels
    if (channel_name.startsWith("presence-")) {
      const auth = pusherServer.authorizeChannel(socket_id, channel_name, {
        user_id: user.id,
        user_info: {
          email: user.email,
          name: user.name,
        },
      });
      return NextResponse.json(auth);
    }

    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to authenticate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
