export type PlanId = "starter" | "basic" | "professional" | "growth" | "enterprise" | "clinic";

export type PlanLimits = {
  clinicians: number;
  clients: number;
  locations: number;
  label: string;
  price: number;
};

// NOTE: "basic" tier limits are estimated between Starter and Professional.
// Double check these numbers match your actual intended entitlements.
export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  starter: { clinicians: 1, clients: 10, locations: 1, label: "Starter", price: 199 },
  basic: { clinicians: 3, clients: 25, locations: 1, label: "Basic", price: 299 },
  professional: { clinicians: 5, clients: 9999, locations: 2, label: "Professional", price: 449 },
  growth: { clinicians: 25, clients: 9999, locations: 5, label: "Growth", price: 649 },
  enterprise: { clinicians: 75, clients: 9999, locations: 15, label: "Enterprise", price: 849 },
  clinic: { clinicians: 9999, clients: 9999, locations: 9999, label: "Clinic", price: 1099 },
};

export const PLAN_ORDER: PlanId[] = ["starter", "basic", "professional", "growth", "enterprise", "clinic"];

export function getNextPlan(currentPlan: string): PlanId | null {
  const idx = PLAN_ORDER.indexOf(currentPlan as PlanId);
  if (idx === -1 || idx === PLAN_ORDER.length - 1) return null;
  return PLAN_ORDER[idx + 1];
}

export function getLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan as PlanId] ?? PLAN_LIMITS.starter;
}
