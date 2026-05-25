import crypto from "crypto";

import { rateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logEvent } from "@/lib/observability/logEvent";
import { logAudit } from "@/lib/observability/logAudit";
import { hasFeature } from "@/lib/features";
import { createJob } from "@/lib/queue";
import { buildWeeklySummaryPrompt } from "@/lib/ai/prompts";
import type { AIRequestInput } from "@/lib/ai/schemas";

export async function handleWeeklySummary(
  body: Extract<AIRequestInput, { type: "weekly_summary" }>,
  userId: string
) {
  if (!hasFeature("pro", "ai_summary")) {
    return { error: "Feature not available", status: 403 };
  }

  const allowed = await rateLimit(`weekly-summary:${userId}`, 10, 60_000);

  if (!allowed) {
    await logAudit({
      userId,
      action: "rate_limit_exceeded",
      resource: `user:${userId}`,
      metadata: { route: "/api/ai", type: "weekly_summary" },
    });
    return { error: "Rate limit exceeded", status: 429 };
  }

  const { total, highRisk, mediumRisk, avgForecastScore, escalationCount } = body;

  const prompt = buildWeeklySummaryPrompt({
    total,
    highRisk,
    mediumRisk,
    avgForecastScore,
    escalationCount,
  });

  const jobId = crypto.randomUUID();

  await createJob({
    id: jobId,
    userId,
    type: "ai_weekly_summary",
    payload: {
      prompt,
      total,
      highRisk,
      mediumRisk,
      avgForecastScore,
      escalationCount,
      jobType: "weekly_summary",
    },
    status: "pending",
  });

  await logEvent({
    userId,
    type: "ai",
    event: "weekly_summary_queued",
    metadata: { route: "/api/ai", jobId },
  });

  await logAudit({
    userId,
    action: "ai.weekly_summary",
    resource: `user:${userId}`,
    metadata: { route: "/api/ai", jobId },
  });

  await supabaseAdmin.from("usage_logs").insert({
    user_id: userId,
    feature: "ai_weekly_summary",
  });

  return { success: true, jobId, status: 200 };
}