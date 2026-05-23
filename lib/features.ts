export const FEATURES = {
  ai_notes: "ai_notes",
  ai_summary: "ai_summary",
  export_reports: "export_reports",
  client_timeline: "client_timeline",
} as const;

export const PLAN_FEATURES: Record<string, string[]> = {
  free: [],
  pro: [
    FEATURES.ai_notes,
    FEATURES.ai_summary,
    FEATURES.export_reports,
    FEATURES.client_timeline,
  ],
};

/**
 * Check if a plan has access to a feature
 */
export function hasFeature(plan: string, feature: string): boolean {
  const features = PLAN_FEATURES[plan] ?? [];
  return features.includes(feature);
}