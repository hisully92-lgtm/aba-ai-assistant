import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPushToUsers } from "@/lib/push-server";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await sendPushToUsers([user.id], {
    title: "Test Notification",
    body: "If you're seeing this, push notifications are working!",
    url: "/app/home",
  });

  return NextResponse.json({ success: true });
}