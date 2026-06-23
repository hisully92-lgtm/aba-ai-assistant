import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { sessionId, clientName, duration = 60, companyId } = await req.json();

    // Check if company has their own Daily.co config
    let apiKey = process.env.DAILY_API_KEY;
    let domain = process.env.NEXT_PUBLIC_DAILY_DOMAIN ?? "aba-ai-assistant.daily.co";

    if (companyId) {
      const { data: config } = await supabaseAdmin
        .from("company_telehealth_config")
        .select("api_key, domain, use_hosted")
        .eq("company_id", companyId)
        .eq("platform", "daily")
        .eq("is_active", true)
        .maybeSingle();

      if (config?.api_key && !config.use_hosted) {
        apiKey = config.api_key;
        domain = config.domain ?? domain;
      }
    }

    if (!apiKey) {
      return NextResponse.json({ error: "Daily.co not configured" }, { status: 400 });
    }

    const roomName = `aba-${sessionId}-${Date.now()}`.slice(0, 50).replace(/[^a-z0-9-]/gi, "-").toLowerCase();
    const expiryTime = Math.floor(Date.now() / 1000) + duration * 60 + 3600;

    const res = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        name: roomName,
        properties: {
          exp: expiryTime,
          max_participants: 10,
          enable_screenshare: true,
          enable_chat: true,
          start_video_off: false,
          start_audio_off: false,
          lang: "en",
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.error ?? "Failed to create room" }, { status: 500 });
    }

    const room = await res.json();
    const roomUrl = `https://${domain}/${roomName}`;

    return NextResponse.json({ success: true, room_url: roomUrl, room_name: roomName });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
