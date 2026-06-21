import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get("x-worker-secret");
    if (secret !== process.env.WORKER_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date().toISOString();

    // Get pending SMS in queue
    const { data: pending } = await supabaseAdmin
      .from("sms_queue")
      .select("*")
      .eq("sent", false)
      .lte("scheduled_for", now)
      .limit(50);

    if (!pending || pending.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    let sent = 0;
    let failed = 0;

    for (const item of pending) {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/sms/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: item.to_number,
            message: item.message,
            companyId: item.company_id,
            triggerType: item.trigger_type,
          }),
        });

        const result = await res.json();

        if (result.success) {
          await supabaseAdmin.from("sms_queue").update({
            sent: true,
            sent_at: new Date().toISOString(),
          }).eq("id", item.id);
          sent++;
        } else {
          await supabaseAdmin.from("sms_queue").update({
            error: result.error,
          }).eq("id", item.id);
          failed++;
        }
      } catch (err: any) {
        await supabaseAdmin.from("sms_queue").update({
          error: err.message,
        }).eq("id", item.id);
        failed++;
      }
    }

    // Also check for expiring authorizations and queue alerts
    await checkExpiringAuths();

    // Queue appointment reminders for tomorrow
    await queueAppointmentReminders();

    return NextResponse.json({ processed: pending.length, sent, failed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function checkExpiringAuths() {
  try {
    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);

    const { data: auths } = await supabaseAdmin
      .from("insurance_authorizations")
      .select("id, client_id, authorization_end, clients(full_name, company_id)")
      .lte("authorization_end", thirtyDays.toISOString().split("T")[0])
      .gte("authorization_end", new Date().toISOString().split("T")[0]);

    if (!auths || auths.length === 0) return;

    for (const auth of auths) {
      const client = auth.clients as any;
      if (!client?.company_id) continue;

      // Get SMS template for this company
      const { data: template } = await supabaseAdmin
        .from("sms_templates")
        .select("*")
        .eq("company_id", client.company_id)
        .eq("trigger_type", "auth_expiring")
        .eq("enabled", true)
        .maybeSingle();

      if (!template) continue;

      // Get admin phone numbers
      const { data: admins } = await supabaseAdmin
        .from("company_users")
        .select("user_id")
        .eq("company_id", client.company_id)
        .eq("role", "admin")
        .eq("status", "active");

      if (!admins) continue;

      const userIds = admins.map((a: any) => a.user_id);
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("phone")
        .in("id", userIds)
        .not("phone", "is", null);

      if (!profiles) continue;

      const daysRemaining = Math.ceil((new Date(auth.authorization_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      // Check if already queued today
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await supabaseAdmin
        .from("sms_queue")
        .select("id")
        .eq("company_id", client.company_id)
        .eq("trigger_type", "auth_expiring")
        .gte("created_at", today)
        .maybeSingle();

      if (existing) continue;

      for (const profile of profiles) {
        if (!profile.phone) continue;
        const message = template.message_template
          .replace("{client_name}", client.full_name ?? "your client")
          .replace("{days_remaining}", String(daysRemaining))
          .replace("{clinic_name}", "your clinic");

        await supabaseAdmin.from("sms_queue").insert({
          company_id: client.company_id,
          to_number: profile.phone,
          message,
          trigger_type: "auth_expiring",
          scheduled_for: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.error("checkExpiringAuths error:", err);
  }
}

async function queueAppointmentReminders() {
  try {
    // Get all companies with appointment reminder templates
    const { data: templates } = await supabaseAdmin
      .from("sms_templates")
      .select("*")
      .eq("trigger_type", "appointment_reminder")
      .eq("enabled", true);

    if (!templates) return;

    for (const template of templates) {
      const hoursAhead = template.timing_hours ?? 24;
      const targetDate = new Date();
      targetDate.setHours(targetDate.getHours() + hoursAhead);
      const targetDateStr = targetDate.toISOString().split("T")[0];

      // Get sessions for that date
      const { data: sessions } = await supabaseAdmin
        .from("schedule_entries")
        .select("*, clients(full_name)")
        .eq("company_id", template.company_id)
        .eq("date", targetDateStr)
        .neq("status", "cancelled");

      if (!sessions || sessions.length === 0) continue;

      for (const session of sessions) {
        const client = session.clients as any;

        // Get assigned staff phone
        const { data: staffUser } = await supabaseAdmin
          .from("profiles")
          .select("phone, full_name")
          .eq("id", session.assigned_to)
          .maybeSingle();

        if (!staffUser?.phone) continue;

        // Check if already queued
        const { data: existing } = await supabaseAdmin
          .from("sms_queue")
          .select("id")
          .eq("company_id", template.company_id)
          .eq("trigger_type", "appointment_reminder")
          .contains("message", session.id)
          .maybeSingle();

        if (existing) continue;

        const message = template.message_template
          .replace("{client_name}", client?.full_name ?? "your client")
          .replace("{date}", targetDateStr)
          .replace("{time}", session.start_time ?? "")
          .replace("{clinician}", staffUser.full_name ?? "your clinician")
          .replace("{clinic_name}", "your clinic");

        const scheduledFor = new Date();
        scheduledFor.setHours(scheduledFor.getHours() + (hoursAhead - 1));

        await supabaseAdmin.from("sms_queue").insert({
          company_id: template.company_id,
          to_number: staffUser.phone,
          message,
          trigger_type: "appointment_reminder",
          scheduled_for: scheduledFor.toISOString(),
        });
      }
    }
  } catch (err) {
    console.error("queueAppointmentReminders error:", err);
  }
}
