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
import { buildClientTimelinePrompt } from "@/lib/ai/prompts";
import type { AIRequestInput } from "@/lib/ai/schemas";

export async function handleTimeline(
  body: Extract<AIRequestInput, { type: "timeline" }>,
  userId: string
) {
  if (!hasFeature("pro", "client_timeline")) {
    return { error: "Feature not available", status: 403 };
  }

  const allowed = await rateLimit(`client-timeline:${userId}`, 20, 60_000);

  if (!allowed) {
    await logAudit({
      userId,
      action: "rate_limit_exceeded",
      resource: `client:${userId}`,
      metadata: { route: "/api/ai", type: "timeline" },
    });
    return { error: "Rate limit exceeded", status: 429 };
  }

  const { client_id } = body;

  const cacheKey = `ai:client-timeline:${client_id}`;
  const cached = await getCache(cacheKey);

  if (cached) {
    await logAudit({
      userId,
      action: "ai.client_timeline.cache_hit",
      resource: `client:${client_id}`,
      metadata: { route: "/api/ai", type: "timeline" },
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
    .order("date", { ascending: true })
    .limit(50);

  if (error) throw new Error(error.message);

  if (!sessions?.length) {
    await logAudit({
      userId,
      action: "ai.client_timeline.empty",
      resource: `client:${client_id}`,
      metadata: { route: "/api/ai", type: "timeline" },
    });
    return { result: "No session data available for timeline analysis.", status: 200 };
  }

  await logAccess({
    userId,
    resource: "sessions",
    action: "read",
    recordId: client_id,
    metadata: { jobType: "client_timeline" },
  });

  const timelineData = sessions
    .map((s, i) => {
      const decrypted = decryptSessionFields(s);
      return `
Session ${i + 1}
Date: ${s.date}
Behaviors: ${decrypted.behaviors_observed}
Interventions: ${decrypted.interventions_used}
Response: ${decrypted.client_response}
Programs: ${decrypted.programs_targeted}
---`;
    })
    .join("\n");

  const prompt = buildClientTimelinePrompt(timelineData);

  const jobId = crypto.randomUUID();

  await createJob({
    id: jobId,
    userId,
    type: "ai_summary",
    payload: {
      client_id,
      prompt,
      cacheKey,
      sessionCount: sessions.length,
      jobType: "client_timeline",
    },
    status: "pending",
  });

  await logEvent({
    userId,
    type: "ai",
    event: "client_timeline_queued",
    metadata: { route: "/api/ai", jobId },
  });

  await supabaseAdmin.from("usage_logs").insert({
    user_id: userId,
    feature: "client_timeline",
  });

  await logAudit({
    userId,
    action: "ai.client_timeline",
    resource: `client:${client_id}`,
    metadata: { route: "/api/ai", jobId },
  });

  return { success: true, jobId, status: 200 };
}