import { usePlan } from "./usePlan";
import { featureLimits, Feature } from "@/lib/permissions/features";

export function useFeatureAccess(feature: Feature) {
  const { plan } = usePlan();

  const required = featureLimits[feature];

  const hasAccess =
    plan === "pro" || required === "free";

  return {
    hasAccess,
    plan,
  };
}