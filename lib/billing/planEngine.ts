import { supabaseAdmin } from "@/lib/supabase/server";
import { getCache, setCache } from "@/lib/cache";
import { logAudit } from "@/lib/observability/logAudit";
import { AppError } from "@/lib/errors";

// =========================
// PLAN DEFINITIONS
//
// This matches the real 6-tier plan structure used across the app
// (see lib/hooks/usePlanGate.ts and the subscription_contracts table).
// Previously this file used its own disconnected "free"/"pro" system
// backed by a profiles.plan column that nothing in the signup/upgrade
// flow ever actually wrote to — meaning any real customer on a paid
// tier would hit this gate and be rejected. Reading from
// subscription_contracts (the real source of truth) fixes that.
// =========================

export type Plan = "starter" | "basic" | "professional" | "growth" | "enterprise" | "clinic";

export type PlanConfig = {
  features: string[];
  exportLimit: number;
  clientLimit: number;
  aiRequestsPerMinute: number;
};

const BASE_FEATURES = ["session_notes", "client_list"];
const AI_FEATURES = ["ai_notes", "ai_summary", "client_timeline", "ai_weekly_summary"];
const ANALYTICS_FEATURES = ["analytics", "supervisor_dashboard", "export_reports"];

export const PLAN_CONFIG: Record<Plan, PlanConfig> = {
  starter: {
    features: [...BASE_FEATURES],
    exportLimit: 5,
    clientLimit: 10,
    aiRequestsPerMinute: 5,
  },
  basic: {
    features: [...BASE_FEATURES, ...AI_FEATURES],
    exportLimit: 25,
    clientLimit: 25,
    aiRequestsPerMinute: 20,
  },
  professional: {
    features: [...BASE_FEATURES, ...AI_FEATURES, ...ANALYTICS_FEATURES],
    exportLimit: 1000,
    clientLimit: 9999,
    aiRequestsPerMinute: 60,
  },
  growth: {
    features: [...BASE_FEATURES, ...AI_FEATURES, ...ANALYTICS_FEATURES],
    exportLimit: 1000,
    clientLimit: 9999,
    aiRequestsPerMinute: 60,
  },
  enterprise: {
    features: [...BASE_FEATURES, ...AI_FEATURES, ...ANALYTICS_FEATURES],
    exportLimit: 5000,
    clientLimit: 9999,
    aiRequestsPerMinute: 120,
  },
  clinic: {
    features: [...BASE_FEATURES, ...AI_FEATURES, ...ANALYTICS_FEATURES],
    exportLimit: 999999,
    clientLimit: 9999,
    aiRequestsPerMinute: 240,
  },
};

export const ALLOWED_STATUSES = ["active", "trial", "grace_period"];
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
  // Kept as "isPro" for backward compatibility with existing callers —
  // true for any paid tier (Basic and above), matching the frontend's
  // "ai" feature flag cutoff in usePlanGate.ts.
  isPro: boolean;
};

export async function getUserTier(userId: string): Promise<UserTier> {
  const cacheKey = `tier:${userId}`;
  const cached = await getCache<{ plan_type: string; status: string }>(cacheKey);

  const contract = cached ?? await fetchContract(userId);

  if (!cached) {
    await setCache(cacheKey, contract, CACHE_TTL);
  }

  const plan = (PLAN_CONFIG[contract.plan_type as Plan] ? contract.plan_type : "starter") as Plan;
  const isActive = ALLOWED_STATUSES.includes(contract.status);
  const config = PLAN_CONFIG[plan];

  return {
    userId,
    plan,
    subscriptionStatus: contract.status,
    config,
    isActive,
    isPro: plan !== "starter" && isActive,
  };
}

async function fetchContract(userId: string): Promise<{ plan_type: string; status: string }> {
  const { data: contract, error } = await supabaseAdmin
    .from("subscription_contracts")
    .select("plan_type, status")
    .eq("user_id", userId)
    .in("status", ["active", "trial", "grace_period"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    await logAudit({
      userId,
      action: "billing.contract_lookup_failed",
      resource: "billing",
      metadata: { error: error.message },
    });
  }

  return {
    plan_type: contract?.plan_type ?? "starter",
    status: contract?.status ?? "none",
  };
}

// =========================
// FEATURE GATE
// =========================

export function hasFeature(tier: UserTier, feature: string): boolean {
  return tier.config.features.includes(feature);
}

export function hasFeatureByPlan(plan: string, feature: string): boolean {
  const config = PLAN_CONFIG[(plan as Plan)] ?? PLAN_CONFIG.starter;
  return config.features.includes(feature);
}

// =========================
// REQUIRE PRO (backward compatible name — really means "any paid tier")
// =========================

export async function requirePro(userId: string): Promise<UserTier> {
  const tier = await getUserTier(userId);

  if (!tier.isPro) {
    await logAudit({
      userId,
      action: tier.plan === "starter"
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
  const tier = await getUserTier(userId);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("exports_used, export_limit")
    .eq("id", userId)
    .single();

  const used = profile?.exports_used ?? 0;
  const limit = profile?.export_limit ?? tier.config.exportLimit;

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
