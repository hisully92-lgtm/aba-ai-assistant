export type Feature =
  | "clients"
  | "sessions"
  | "exports"
  | "ai_notes";

export const featureLimits: Record<Feature, "free" | "pro"> = {
  clients: "free",
  sessions: "free",
  exports: "pro",
  ai_notes: "pro",
};