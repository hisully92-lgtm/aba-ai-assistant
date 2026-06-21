import { supabaseAdmin } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { getModelConfig, logModelSelection, type AITaskType } from "@/lib/ai/modelRouter";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MAX_ATTEMPTS = 3;

async function processSessionCancellationSMS(payload: any): Promise<void> {
  const { scheduleEntryId, companyId, clientId, date, startTime, sessionType } = payload;

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("full_name, caregiver_name, caregiver_phone")
    .eq("id", clientId)
    .maybeSingle();

  if (!client) throw new Error("Client not found");

  const { data: template } = await supabaseAdmin
    .from("sms_templates")
    .select("*")
    .eq("company_id", companyId)
    .eq("trigger_type", "session_cancelled")
    .eq("enabled", true)
    .maybeSingle();

  const defaultMessage = `Your session for ${client.full_name} on ${date} at ${startTime ?? "TBD"} (${sessionType}) has been cancelled. Please contact your clinic for more information.`;

  const message = template
    ? template.message_template
        .replace("{client_name}", client.full_name ?? "your child")
        .replace("{date}", date ?? "")
        .replace("{time}", startTime ?? "TBD")
        .replace("{session_type}", sessionType ?? "")
        .replace("{clinic_name}", "your clinic")
    : defaultMessage;

  const phones: string[] = [];
  if (client.caregiver_phone) phones.push(client.caregiver_phone);

  const { data: entry } = await supabaseAdmin
    .from("schedule_entries")
    .select("assigned_to")
    .eq("id", scheduleEntryId)
    .maybeSingle();

  if (entry?.assigned_to) {
    const { data: staffProfile } = await supabaseAdmin
      .from("profiles")
      .select("phone")
      .eq("id", entry.assigned_to)
      .maybeSingle();
    if (staffProfile?.phone) phones.push(staffProfile.phone);
  }

  if (phones.length === 0) return;

  for (const phone of phones) {
    await supabaseAdmin.from("sms_queue").insert({
      company_id: companyId,
      to_number: phone,
      message,
      trigger_type: "session_cancelled",
      scheduled_for: new Date().toISOString(),
    });
  }
}

async function sendSMSJob(payload: any): Promise<void> {
  const { to, message, companyId, triggerType } = payload;
  if (!to || !message) throw new Error("Missing to or message");

  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/sms/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, message, companyId, triggerType }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "SMS send failed");
}

async function processAppointmentReminders(): Promise<number> {
  const { data: templates } = await supabaseAdmin
    .from("sms_templates")
    .select("*")
    .eq("trigger_type", "appointment_reminder")
    .eq("enabled", true);

  if (!templates || templates.length === 0) return 0;
  let queued = 0;

  for (const template of templates) {
    const hoursAhead = template.timing_hours ?? 24;
    const targetDate = new Date();
    targetDate.setHours(targetDate.getHours() + hoursAhead);
    const targetDateStr = targetDate.toISOString().split("T")[0];

    const { data: sessions } = await supabaseAdmin
      .from("schedule_entries")
      .select("*, clients(full_name)")
      .eq("company_id", template.company_id)
      .eq("date", targetDateStr)
      .neq("status", "cancelled");

    if (!sessions) continue;

    for (const session of sessions) {
      const client = session.clients as any;

      const { data: staffProfile } = await supabaseAdmin
        .from("profiles")
        .select("phone, full_name")
        .eq("id", session.assigned_to)
        .maybeSingle();

      if (!staffProfile?.phone) continue;

      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await supabaseAdmin
        .from("sms_queue")
        .select("id")
        .eq("company_id", template.company_id)
        .eq("trigger_type", "appointment_reminder")
        .eq("to_number", staffProfile.phone)
        .gte("created_at", today)
        .maybeSingle();

      if (existing) continue;

      const message = template.message_template
        .replace("{client_name}", client?.full_name ?? "your client")
        .replace("{date}", targetDateStr)
        .replace("{time}", session.start_time ?? "")
        .replace("{clinician}", staffProfile.full_name ?? "")
        .replace("{clinic_name}", "your clinic");

      await supabaseAdmin.from("sms_queue").insert({
        company_id: template.company_id,
        to_number: staffProfile.phone,
        message,
        trigger_type: "appointment_reminder",
        scheduled_for: new Date().toISOString(),
      });
      queued++;
    }
  }
  return queued;
}

async function processAuthExpiryAlerts(): Promise<number> {
  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);

  const { data: auths } = await supabaseAdmin
    .from("insurance_authorizations")
    .select("id, client_id, authorization_end, clients(full_name, company_id)")
    .lte("authorization_end", thirtyDays.toISOString().split("T")[0])
    .gte("authorization_end", new Date().toISOString().split("T")[0]);

  if (!auths || auths.length === 0) return 0;
  let queued = 0;

  for (const auth of auths) {
    const client = auth.clients as any;
    if (!client?.company_id) continue;

    const { data: template } = await supabaseAdmin
      .from("sms_templates")
      .select("*")
      .eq("company_id", client.company_id)
      .eq("trigger_type", "auth_expiring")
      .eq("enabled", true)
      .maybeSingle();

    if (!template) continue;

    const today = new Date().toISOString().split("T")[0];
    const { data: existing } = await supabaseAdmin
      .from("sms_queue")
      .select("id")
      .eq("company_id", client.company_id)
      .eq("trigger_type", "auth_expiring")
      .gte("created_at", today)
      .maybeSingle();

    if (existing) continue;

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

    const daysRemaining = Math.ceil(
      (new Date(auth.authorization_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

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
      queued++;
    }
  }
  return queued;
}

async function processSMSQueue(): Promise<number> {
  const now = new Date().toISOString();
  const { data: pending } = await supabaseAdmin
    .from("sms_queue")
    .select("*")
    .eq("sent", false)
    .lte("scheduled_for", now)
    .limit(50);

  if (!pending || pending.length === 0) return 0;
  let sent = 0;

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
      }
    } catch (err: any) {
      await supabaseAdmin.from("sms_queue").update({
        error: err.message,
      }).eq("id", item.id);
    }
  }
  return sent;
}

export async function processJob(jobId: string) {
  const { data: job, error } = await supabaseAdmin
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error || !job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  if (job.attempts >= MAX_ATTEMPTS) {
    await supabaseAdmin
      .from("jobs")
      .update({
        status: "dead",
        error: `Max attempts (${MAX_ATTEMPTS}) reached`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    return { success: false, jobId, reason: "max_attempts_reached" };
  }

  await supabaseAdmin
    .from("jobs")
    .update({
      status: "processing",
      attempts: job.attempts + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  // HANDLE NON-AI JOB TYPES
  if (job.payload?.type === "session_cancellation_sms") {
    try {
      await processSessionCancellationSMS(job.payload);
      await supabaseAdmin.from("jobs").update({
        status: "complete",
        result: { text: "Cancellation SMS queued" },
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);
      return { success: true, jobId, result: "Cancellation SMS queued" };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await supabaseAdmin.from("jobs").update({
        status: job.attempts + 1 < MAX_ATTEMPTS ? "pending" : "dead",
        error: message,
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);
      throw err;
    }
  }

  // RESOLVE MODEL FROM JOB TYPE
  const jobType = (job.payload?.jobType ?? "summary") as AITaskType;
  const modelConfig = getModelConfig(jobType);
  logModelSelection(jobType);

  try {
    const response = await anthropic.messages.create({
      model: modelConfig.model,
      max_tokens: modelConfig.maxTokens,
      messages: [
        {
          role: "user",
          content: job.payload.prompt,
        },
      ],
    });

    const result = response.content
      .map((block: any) => (block.type === "text" ? block.text : ""))
      .join("\n");

    await supabaseAdmin
      .from("jobs")
      .update({
        status: "complete",
        result: { text: result, model: modelConfig.model },
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return { success: true, jobId, result, model: modelConfig.model };

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const attempts = job.attempts + 1;
    const willRetry = attempts < MAX_ATTEMPTS;

    await supabaseAdmin
      .from("jobs")
      .update({
        status: willRetry ? "pending" : "dead",
        error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    throw err;
  }
}
