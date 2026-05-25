// =========================
// 📊 TRACK AI USAGE
// =========================

import { supabaseAdmin } from "@/lib/supabase/server";

export type AIUsageEntry = {
  userId: string;
  type: string;
  durationMs?: number;
  success: boolean;
  error?: string;
};

export async function trackUsage(entry: AIUsageEntry): Promise<void> {
  await supabaseAdmin.from("ai_usage_logs").insert({
    user_id: entry.userId,
    feature: `ai_${entry.type}`,
    duration_ms: entry.durationMs ?? null,
    success: entry.success,
    error: entry.error ?? null,
    created_at: new Date().toISOString(),
  });
}