import { PLAN_FEATURES } from "../features";

export function hasFeature(plan: string, feature: string) {
  const allowed = PLAN_FEATURES[plan] || [];
  return allowed.includes(feature);
}
