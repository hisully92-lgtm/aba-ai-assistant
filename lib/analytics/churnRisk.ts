import { supabaseAdmin } from "@/lib/supabase/server";
import { logEvent } from "@/lib/observability/logEvent";

export type ChurnRiskLevel = "high" | "medium" | "low";

export type UserChurnRisk = {
  userId: string;
  riskLevel: ChurnRiskLevel;
  lastActive: string | null;
  daysSinceActive: number;
  aiRequestsLast30Days: number;
  reason: string;
};

export async function detectChurnRisks(): Promise<UserChurnRisk[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Get all pro users
  const { data: proUsers } = await supabaseAdmin
    .from("profiles")
    .select("id, plan, subscription_status")
    .eq("plan", "pro")
    .eq("subscription_status", "active");

  if (!proUsers?.length) return [];

  const risks: UserChurnRisk[] = [];

  for (const user of proUsers) {
    // Get AI usage in last 30 days
    const { data: recentUsage } = await supabaseAdmin
      .from("ai_usage_logs")
      .select("created_at")
      .eq("user_id", user.id)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false });

    const aiRequestsLast30Days = recentUsage?.length ?? 0;
    const lastActive = recentUsage?.[0]?.created_at ?? null;

    const daysSinceActive = lastActive
      ? Math.floor((Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    let riskLevel: ChurnRiskLevel = "low";
    let reason = "Active user";

    if (daysSinceActive > 14) {
      riskLevel = "high";
      reason = `No activity in ${daysSinceActive} days`;
    } else if (daysSinceActive > 7 || aiRequestsLast30Days < 3) {
      riskLevel = "medium";
      reason = aiRequestsLast30Days < 3
        ? "Low AI usage this month"
        : `Inactive for ${daysSinceActive} days`;
    }

    if (riskLevel !== "low") {
      risks.push({
        userId: user.id,
        riskLevel,
        lastActive,
        daysSinceActive,
        aiRequestsLast30Days,
        reason,
      });
    }
  }

  await logEvent({
    userId: "system",
    type: "queue",
    event: "churn_risk_scan_complete",
    metadata: { total: risks.length, high: risks.filter((r) => r.riskLevel === "high").length },
  });

  return risks;
}