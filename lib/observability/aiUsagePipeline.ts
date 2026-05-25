import { supabaseAdmin } from "@/lib/supabase/server";

export type AIPipelineEntry = {
  userId: string;
  type: string;
  durationMs: number;
  success: boolean;
  error?: string;
  jobId?: string;
  clientId?: string;
  cached?: boolean;
  metadata?: Record<string, unknown>;
};

export async function trackAIUsage(entry: AIPipelineEntry): Promise<void> {
  try {
    await supabaseAdmin.from("ai_usage_logs").insert({
      user_id: entry.userId,
      feature: `ai_${entry.type}`,
      duration_ms: entry.durationMs,
      success: entry.success,
      error: entry.error ?? null,
      job_id: entry.jobId ?? null,
      client_id: entry.clientId ?? null,
      cached: entry.cached ?? false,
      metadata: entry.metadata ?? {},
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[ai_usage_pipeline_failed]", err);
  }
}

export async function getAIUsageStats(userId: string): Promise<{
  totalRequests: number;
  successRate: number;
  avgDurationMs: number;
  byType: Record<string, number>;
}> {
  const { data } = await supabaseAdmin
    .from("ai_usage_logs")
    .select("feature, duration_ms, success")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (!data || data.length === 0) {
    return { totalRequests: 0, successRate: 0, avgDurationMs: 0, byType: {} };
  }

  const totalRequests = data.length;
  const successCount = data.filter((d: { success: boolean }) => d.success).length;
  const successRate = Math.round((successCount / totalRequests) * 100);

  const durations = data
    .map((d: { duration_ms: number | null }) => d.duration_ms)
    .filter((d): d is number => d != null);

  const avgDurationMs = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  const byType: Record<string, number> = {};
  data.forEach((d: { feature: string }) => {
    byType[d.feature] = (byType[d.feature] ?? 0) + 1;
  });

  return { totalRequests, successRate, avgDurationMs, byType };
}