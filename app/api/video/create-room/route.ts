import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { sessionId, clientName, duration } = await req.json();

  const apiKey = process.env.DAILY_API_KEY;
  const domain = process.env.DAILY_DOMAIN;

  // SCAFFOLD — Daily.co not yet configured
  if (!apiKey || !domain) {
    const mockRoom = `aba-session-${sessionId ?? "demo"}`;
    return NextResponse.json({
      success: false,
      scaffold: true,
      room_url: `https://your-domain.daily.co/${mockRoom}`,
      room_name: mockRoom,
      message: "Video scaffold ready. Add DAILY_API_KEY and DAILY_DOMAIN to .env.local to activate.",
    });
  }

  try {
    const expiryTime = Math.floor(Date.now() / 1000) + (duration ?? 7200);

    // Create room
    const roomResponse = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `aba-session-${sessionId}`,
        properties: {
          exp: expiryTime,
          max_participants: 10,
          enable_chat: true,
          enable_screenshare: true,
          enable_recording: "cloud",
          hipaa: true,
        },
      }),
    });

    const room = await roomResponse.json();

    if (!roomResponse.ok) {
      return NextResponse.json({ error: room.error }, { status: 400 });
    }

    // Create token for host
    const tokenResponse = await fetch("https://api.daily.co/v1/meeting-tokens", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          room_name: room.name,
          exp: expiryTime,
          is_owner: true,
          user_name: clientName ?? "Host",
        },
      }),
    });

    const token = await tokenResponse.json();

    return NextResponse.json({
      success: true,
      room_url: room.url,
      room_name: room.name,
      token: token.token,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}