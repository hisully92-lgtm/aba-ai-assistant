import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUsers } from "@/lib/push-server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Send reminders for anything starting within this many minutes.
const REMINDER_WINDOW_MINUTES = 30;

function combineDateTime(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const timeStr = time.length === 5 ? `${time}:00` : time; // "HH:MM" -> "HH:MM:SS"
  const d = new Date(`${date}T${timeStr}`);
  return isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== "Bearer " + process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: entries, error } = await supabaseAdmin
    .from("schedule_entries")
    .select("id, client_id, date, start_time, assigned_to, status, reminder_sent")
    .eq("reminder_sent", false)
    .not("assigned_to", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date();
  let remindersSent = 0;

  for (const entry of entries ?? []) {
    if (entry.status && String(entry.status).toLowerCase().includes("cancel")) continue;

    const start = combineDateTime(entry.date, entry.start_time);
    if (!start) continue;

    const minutesUntilStart = (start.getTime() - now.getTime()) / (1000 * 60);
    if (minutesUntilStart <= REMINDER_WINDOW_MINUTES && minutesUntilStart >= 0) {
      let clientName = "a client";
      if (entry.client_id) {
        const { data: client } = await supabaseAdmin
          .from("clients")
          .select("full_name")
          .eq("id", entry.client_id)
          .single();
        if (client?.full_name) clientName = client.full_name;
      }

      try {
        await sendPushToUsers([entry.assigned_to], {
          title: "Upcoming session",
          body: `Session with ${clientName} starts at ${entry.start_time}.`,
          url: "/dashboard/schedule",
        });
        remindersSent++;
      } catch (err) {
        console.error("Schedule reminder push failed:", err);
      }

      await supabaseAdmin
        .from("schedule_entries")
        .update({ reminder_sent: true })
        .eq("id", entry.id);
    }
  }

  return NextResponse.json({ success: true, checked: entries?.length ?? 0, remindersSent });
}
