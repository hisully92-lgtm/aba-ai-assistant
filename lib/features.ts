import { PLAN_CONFIG } from "@/lib/billing/planEngine";

export const FEATURES = {
  ai_notes: "ai_notes",
  ai_summary: "ai_summary",
  export_reports: "export_reports",
  client_timeline: "client_timeline",
  ai_weekly_summary: "ai_weekly_summary",
  analytics: "analytics",
  supervisor_dashboard: "supervisor_dashboard",
  session_notes: "session_notes",
  client_list: "client_list",
} as const;

export const PLAN_FEATURES: Record<string, string[]> = Object.fromEntries(
  Object.entries(PLAN_CONFIG).map(([plan, config]) => [plan, config.features])
);

export function hasFeature(plan: string, feature: string): boolean {
  const features = PLAN_FEATURES[plan] ?? [];
  return features.includes(feature);
}