import crypto from "crypto";

import { rateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logEvent } from "@/lib/observability/logEvent";
import { logAudit } from "@/lib/observability/logAudit";
import { logAccess } from "@/lib/observability/logAccess";
import { hasFeature } from "@/lib/features";
import { getCache } from "@/lib/cache";
import { createJob } from "@/lib/queue";
import { decryptSessionFields } from "@/lib/security/encryptSession";
import { buildClientSummaryPrompt } from "@/lib/ai/prompts";
import type { AIRequestInput } from "@/lib/ai/schemas";

export async function handleSummary(
  body: Extract<AIRequestInput, { type: "summary" }>,
  userId: string
) {
  if (!hasFeature("pro", "ai_summary")) {
    return { error: "Feature not available", status: 403 };
  }

  const allowed = await rateLimit(`client-summary:${userId}`, 20, 60_000);

  if (!allowed) {
    await logAudit({
      userId,
      action: "rate_limit_exceeded",
      resource: `client:${userId}`,
      metadata: { route: "/api/ai", type: "summary" },
    });
    return { error: "Rate limit exceeded", status: 429 };
  }

  const { client_id } = body;

  const cacheKey = `ai:client-summary:${client_id}`;
  const cached = await getCache(cacheKey);

  if (cached) {
    await logAudit({
      userId,
      action: "ai.client_summary.cache_hit",
      resource: `client:${client_id}`,
      metadata: { route: "/api/ai", type: "summary" },
    });
    return { result: cached, cached: true, status: 200 };
  }

  const { data: sessions, error } = await supabaseAdmin
    .from("sessions")
    .select(`
      date,
      behaviors_observed,
      interventions_used,
      client_response,
      programs_targeted
    `)
    .eq("client_id", client_id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);

  await logAccess({
    userId,
    resource: "sessions",
    action: "read",
    recordId: client_id,
    metadata: { jobType: "client_summary" },
  });

  const historyText =
    sessions
      ?.map((s) => {
        const decrypted = decryptSessionFields(s);
        return `
Date: ${s.date}
Behaviors: ${decrypted.behaviors_observed}
Interventions: ${decrypted.interventions_used}
Response: ${decrypted.client_response}
Programs: ${decrypted.programs_targeted}
---`;
      })
      .join("\n") || "";

  const prompt = buildClientSummaryPrompt(historyText);

  const jobId = crypto.randomUUID();

  await createJob({
    id: jobId,
    userId,
    type: "ai_summary",
    payload: {
      client_id,
      prompt,
      cacheKey,
      sessionCount: sessions?.length || 0,
      jobType: "client_summary",
    },
    status: "pending",
  });

  await logEvent({
    userId,
    type: "ai",
    event: "client_summary_queued",
    metadata: { route: "/api/ai", jobId },
  });

  await supabaseAdmin.from("usage_logs").insert({
    user_id: userId,
    feature: "ai_summary",
  });

  await logAudit({
    userId,
    action: "ai.client_summary",
    resource: `client:${client_id}`,
    metadata: { route: "/api/ai", jobId },
  });

  return { success: true, jobId, status: 200 };
}