import { NextResponse } from "next/server";

function getSupabaseAdmin() {
  const { createClient } = require("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function sendExpoPushNotification(token: string, title: string, body: string, data?: any) {
  const message = {
    to: token,
    sound: "default",
    title,
    body,
    data: data ?? {},
    priority: "high",
  };

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  return response.json();
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await req.json();
    const { type, company_id, client_id, data } = body;

    // Get all users in this company with push tokens
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("user_id, expo_push_token, push_enabled, notify_high_severity, notify_session_submitted, notify_target_mastered, notify_missed_session, notify_schedule_change, notify_team_chat, severity_threshold, quiet_hours_enabled, quiet_start, quiet_end, digest_mode")
      .eq("company_id", company_id)
      .eq("push_enabled", true)
      .not("expo_push_token", "is", null);

    if (!prefs || prefs.length === 0) {
      return NextResponse.json({ sent: 0, message: "No push tokens found" });
    }

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const results = await Promise.allSettled(
      prefs.map(async (pref: any) => {
        // Check quiet hours
        if (pref.quiet_hours_enabled) {
          const start = pref.quiet_start;
          const end = pref.quiet_end;
          if (start < end) {
            if (currentTime >= start && currentTime <= end) return null;
          } else {
            if (currentTime >= start || currentTime <= end) return null;
          }
        }

        // Check digest mode
        if (pref.digest_mode) return null;

        // Check notification type preferences
        let shouldSend = false;
        let title = "";
        let body = "";

        switch (type) {
          case "high_severity_behavior":
            if (!pref.notify_high_severity) return null;
            if (data.severity_level < pref.severity_threshold) return null;
            shouldSend = true;
            title = "⚠️ High Severity Behavior";
            body = `${data.behavior_name} (Level ${data.severity_level}) recorded for ${data.client_name}`;
            break;
          case "session_submitted":
            if (!pref.notify_session_submitted) return null;
            shouldSend = true;
            title = "📋 Session Note Submitted";
            body = `${data.staff_name} submitted a session note for ${data.client_name}`;
            break;
          case "target_mastered":
            if (!pref.notify_target_mastered) return null;
            shouldSend = true;
            title = "🎯 Target Mastered!";
            body = `${data.client_name} mastered ${data.target_name} at ${data.accuracy}% accuracy`;
            break;
          case "missed_session":
            if (!pref.notify_missed_session) return null;
            shouldSend = true;
            title = "⚠️ Session Cancelled";
            body = `Session for ${data.client_name} was marked cancelled`;
            break;
          case "session_reminder":
            shouldSend = true;
            title = "📅 Session Starting Soon";
            body = `Your session with ${data.client_name} starts in 30 minutes`;
            break;
          case "schedule_change":
            if (!pref.notify_schedule_change) return null;
            shouldSend = true;
            title = "📅 Schedule Change";
            body = data.message ?? "Your schedule has been updated";
            break;
          case "team_chat":
            if (!pref.notify_team_chat) return null;
            shouldSend = true;
            title = "💬 New Team Message";
            body = `${data.sender_name}: ${data.message?.slice(0, 80)}`;
            break;
        }

        if (!shouldSend) return null;

        // Check for duplicate (same type + reference within last hour)
        if (data?.reference_id) {
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
          const { data: existing } = await supabase
            .from("notification_log")
            .select("id")
            .eq("user_id", pref.user_id)
            .eq("type", type)
            .eq("reference_id", data.reference_id)
            .gte("sent_at", oneHourAgo)
            .limit(1)
            .maybeSingle();
          if (existing) return null;
        }

        // Send push notification
        const result = await sendExpoPushNotification(pref.expo_push_token, title, body, { type, client_id });

        // Log it
        await supabase.from("notification_log").insert({
          user_id: pref.user_id,
          type,
          reference_id: data?.reference_id ?? null,
        });

        // Also save to notifications table
        await supabase.from("notifications").insert({
          user_id: pref.user_id,
          message: body,
          type: type === "high_severity_behavior" ? "alert" : type === "team_chat" ? "chat" : "ping",
          read: false,
        });

        return result;
      })
    );

    const sent = results.filter(r => r.status === "fulfilled" && r.value !== null).length;
    return NextResponse.json({ sent });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}