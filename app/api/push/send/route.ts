import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

webpush.setVapidDetails(
  "mailto:" + process.env.ALERT_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { user_id, title, body, url } = await req.json();

    if (!user_id || !title || !body) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get all push subscriptions for this user
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", user_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: "No subscriptions found" }, { status: 200 });
    }

    const payload = JSON.stringify({ title, body, url: url ?? "/dashboard/notifications" });

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        )
      )
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({ sent, failed });
  } catch (err: unknown) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Push failed"
    }, { status: 500 });
  }
}