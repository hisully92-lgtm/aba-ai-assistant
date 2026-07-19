import crypto from "crypto";
import { rateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logEvent } from "@/lib/observability/logEvent";
import { logAudit } from "@/lib/observability/logAudit";
import { logAccess } from "@/lib/observability/logAccess";
import { getUserTier } from "@/lib/billing/planEngine";
import { getCache } from "@/lib/cache";
import { createJob } from "@/lib/queue";
import { decryptSessionFields } from "@/lib/security/encryptSession";
import { buildSessionNotePrompt } from "@/lib/ai/prompts";
import type { AIRequestInput } from "@/lib/ai/schemas";
export async function handleNote(
  body: Extract<AIRequestInput, { type: "note" }>,
  userId: string
) {
  // Checks the caller's actual plan. (Previously this hardcoded the
  // literal string "pro" here, so it always passed regardless of who
  // was calling — a silent no-op.) The route-level requirePro() also
  // gates this, but this keeps the handler correct on its own too.
  const tier = await getUserTier(userId);
  if (!tier.config.features.includes("ai_notes")) {
    return { error: "Feature not available", status: 403 };
  }
  const allowed = await rateLimit(`session-note:${userId}`, 20, 60_000);
  if (!allowed) {
    await logAudit({
      userId,
      action: "rate_limit_exceeded",
      resource: `client:${userId}`,
      metadata: { route: "/api/ai", type: "note" },
    });
    return { error: "Rate limit exceeded", status: 429 };
  }
  const {
    client_id,
    client_name,
    behaviors_observed,
    interventions_used,
    client_response,
    programs_targeted,
    date,
    staff_member,
  } = body;
  const safeClientId = client_id || "unknown";
  const safeDate = date || "no-date";
  const cacheKey = `ai:session-note:${safeClientId}:${safeDate}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    await logAudit({
      userId,
      action: "ai.session_note.cache_hit",
      resource: `client:${safeClientId}`,
      metadata: { route: "/api/ai", type: "note" },
    });
    return { result: cached, cached: true, status: 200 };
  }
  await logAccess({
    userId,
    resource: "sessions",
    action: "write",
    recordId: safeClientId,
    metadata: { jobType: "session_note", containsPHI: true },
  });
  const decrypted = decryptSessionFields({
    behaviors_observed,
    interventions_used,
    client_response,
    programs_targeted,
    staff_member,
  });
  const prompt = buildSessionNotePrompt({
    clientName: client_name,
    staffMember: decrypted.staff_member || "Not specified",
    date: safeDate,
    behaviorsObserved: decrypted.behaviors_observed,
    interventionsUsed: decrypted.interventions_used,
    clientResponse: decrypted.client_response,
    programsTargeted: decrypted.programs_targeted,
  });
  const jobId = crypto.randomUUID();
  await createJob({
    id: jobId,
    userId,
    type: "ai_summary",
    payload: {
      client_id: safeClientId,
      prompt,
      cacheKey,
      jobType: "session_note",
      security: {
        sensitive: true,
        containsPHI: true,
      },
    },
    status: "pending",
  });
  await logEvent({
    userId,
    type: "ai",
    event: "session_note_queued",
    metadata: { route: "/api/ai", jobId },
  });
  await supabaseAdmin.from("usage_logs").insert({
    user_id: userId,
    feature: "ai_notes",
  });
  await logAudit({
    userId,
    action: "ai.session_note",
    resource: `client:${safeClientId}`,
    metadata: { route: "/api/ai", jobId },
  });
  return { success: true, jobId, status: 200 };
}
