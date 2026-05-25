import { supabaseAdmin } from "@/lib/supabase/server";
import { getCache, setCache } from "@/lib/cache";
import { logAudit } from "@/lib/observability/logAudit";
import { AppError } from "@/lib/errors";

// =========================
// PLAN DEFINITIONS
// =========================

export type Plan = "free" | "pro";

export type PlanConfig = {
  features: string[];
  exportLimit: number;
  clientLimit: number;
  aiRequestsPerMinute: number;
};

export const PLAN_CONFIG: Record<Plan, PlanConfig> = {
  free: {
    features: ["session_notes", "client_list"],
    exportLimit: 5,
    clientLimit: 5,
    aiRequestsPerMinute: 5,
  },
  pro: {
    features: [
      "session_notes",
      "client_list",
      "ai_summary",
      "ai_notes",
      "client_timeline",
      "export_reports",
      "ai_weekly_summary",
      "analytics",
      "supervisor_dashboard",
    ],
    exportLimit: 1000,
    clientLimit: 1000,
    aiRequestsPerMinute: 60,
  },
};

export const ALLOWED_STATUSES = ["active", "grace_period"];
const CACHE_TTL = 60;

// =========================
// USER TIER
// =========================

export type UserTier = {
  userId: string;
  plan: Plan;
  subscriptionStatus: string;
  config: PlanConfig;
  isActive: boolean;
  isPro: boolean;
};

export async function getUserTier(userId: string): Promise<UserTier> {
  const cacheKey = `tier:${userId}`;
  const cached = await getCache<{ plan: string; subscription_status: string }>(cacheKey);

  const profile = cached ?? await fetchProfile(userId);

  if (!cached) {
    await setCache(cacheKey, profile, CACHE_TTL);
  }

  const plan = (profile.plan === "pro" ? "pro" : "free") as Plan;
  const isActive = ALLOWED_STATUSES.includes(profile.subscription_status);
  const config = PLAN_CONFIG[plan];

  return {
    userId,
    plan,
    subscriptionStatus: profile.subscription_status,
    config,
    isActive,
    isPro: plan === "pro" && isActive,
  };
}

async function fetchProfile(userId: string) {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("plan, subscription_status")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    await logAudit({
      userId,
      action: "billing.profile_not_found",
      resource: "billing",
      metadata: { error: error?.message },
    });
    throw new AppError("UNAUTHORIZED", "Profile not found", { status: 401 });
  }

  return profile;
}

// =========================
// FEATURE GATE
// =========================

export function hasFeature(tier: UserTier, feature: string): boolean {
  return tier.config.features.includes(feature);
}

export function hasFeatureByPlan(plan: string, feature: string): boolean {
  const config = PLAN_CONFIG[(plan as Plan)] ?? PLAN_CONFIG.free;
  return config.features.includes(feature);
}

// =========================
// REQUIRE PRO (backward compatible)
// =========================

export async function requirePro(userId: string): Promise<UserTier> {
  const tier = await getUserTier(userId);

  if (!tier.isPro) {
    await logAudit({
      userId,
      action: tier.plan !== "pro"
        ? "billing.access_denied.not_pro"
        : "billing.access_denied.inactive",
      resource: "billing",
      metadata: {
        plan: tier.plan,
        subscriptionStatus: tier.subscriptionStatus,
      },
    });
    throw new AppError("FORBIDDEN", "Pro plan required", { status: 403 });
  }

  return tier;
}

// =========================
// EXPORT LIMIT CHECK
// =========================

export async function checkExportLimit(userId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
}> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("exports_used, export_limit, plan")
    .eq("id", userId)
    .single();

  if (!profile) return { allowed: false, used: 0, limit: 0 };

  const plan = (profile.plan === "pro" ? "pro" : "free") as Plan;
  const limit = profile.export_limit ?? PLAN_CONFIG[plan].exportLimit;
  const used = profile.exports_used ?? 0;

  return {
    allowed: used < limit,
    used,
    limit,
  };
}

export async function incrementExportUsage(userId: string): Promise<void> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("exports_used")
    .eq("id", userId)
    .single();

  if (!profile) return;

  await supabaseAdmin
    .from("profiles")
    .update({ exports_used: (profile.exports_used ?? 0) + 1 })
    .eq("id", userId);
}