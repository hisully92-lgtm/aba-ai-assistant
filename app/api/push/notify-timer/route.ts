import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPushToUsers } from "@/lib/push-server";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { label, url } = await req.json();

    await sendPushToUsers([user.id], {
      title: "Timer finished",
      body: label ? `"${label}" has finished.` : "Your timer has finished.",
      url: url || "/dashboard/timers",
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("notify-timer error:", err);
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });
  }
}
