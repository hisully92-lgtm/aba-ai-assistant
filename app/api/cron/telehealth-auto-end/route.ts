import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const IN_PROGRESS_TIMEOUT_HOURS = 6; // a session actually connected shouldn't run longer than this
const SCHEDULED_TIMEOUT_HOURS = 24; // a session that never got joined should be cancelled after this

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== "Bearer " + process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const results: { id: string; action: string }[] = [];

  // Orphaned in-progress sessions — connected but never got a room-ended webhook
  const inProgressCutoff = new Date(now - IN_PROGRESS_TIMEOUT_HOURS * 60 * 60 * 1000).toISOString();
  const { data: staleInProgress } = await supabaseAdmin
    .from("telehealth_video_sessions")
    .select("id, room_sid, company_id")
    .eq("status", "in_progress")
    .lt("actual_start", inProgressCutoff);

  for (const session of staleInProgress ?? []) {
    try {
      if (session.room_sid) {
        await twilioClient.video.v1.rooms(session.room_sid).update({ status: "completed" });
      }
    } catch (err) {
      // Room may already be completed on Twilio's side — safe to ignore and just fix our own record
      console.log(`Twilio room ${session.room_sid} already closed or errored:`, err);
    }

    await supabaseAdmin
      .from("telehealth_video_sessions")
      .update({ status: "completed", actual_end: new Date().toISOString() })
      .eq("id", session.id);

    await supabaseAdmin.from("telehealth_session_audit_log").insert({
      video_session_id: session.id,
      company_id: session.company_id,
      actor_type: "system",
      actor_id: null,
      actor_name: "Auto-end cron",
      event: "auto_ended_stale_in_progress",
    });

    results.push({ id: session.id, action: "auto_ended_in_progress" });
  }

  // Sessions that were created but never actually joined — clean up as cancelled
  const scheduledCutoff = new Date(now - SCHEDULED_TIMEOUT_HOURS * 60 * 60 * 1000).toISOString();
  const { data: staleScheduled } = await supabaseAdmin
    .from("telehealth_video_sessions")
    .select("id, room_sid, company_id")
    .eq("status", "scheduled")
    .lt("scheduled_start", scheduledCutoff);

  for (const session of staleScheduled ?? []) {
    try {
      if (session.room_sid) {
        await twilioClient.video.v1.rooms(session.room_sid).update({ status: "completed" });
      }
    } catch (err) {
      console.log(`Twilio room ${session.room_sid} already closed or errored:`, err);
    }

    await supabaseAdmin
      .from("telehealth_video_sessions")
      .update({ status: "cancelled" })
      .eq("id", session.id);

    await supabaseAdmin.from("telehealth_session_audit_log").insert({
      video_session_id: session.id,
      company_id: session.company_id,
      actor_type: "system",
      actor_id: null,
      actor_name: "Auto-end cron",
      event: "auto_cancelled_never_joined",
    });

    results.push({ id: session.id, action: "auto_cancelled_never_joined" });
  }

  return NextResponse.json({ processed: results.length, results });
}
