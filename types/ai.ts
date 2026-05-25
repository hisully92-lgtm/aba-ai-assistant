export type AIType = "note" | "summary" | "timeline" | "report" | "weekly_summary";

// =========================
// REQUEST TYPES
// =========================

export type AINoteRequest = {
  type: "note";
  client_name: string;
  behaviors_observed: string;
  interventions_used?: string;
  client_response?: string;
  programs_targeted?: string;
  date?: string;
  staff_member?: string;
};

export type AISummaryRequest = {
  type: "summary";
  client_id: string;
  date?: string;
  staff_member?: string;
};

export type AITimelineRequest = {
  type: "timeline";
  client_id: string;
  date?: string;
  staff_member?: string;
};

export type AIReportRequest = {
  type: "report";
  client_id: string;
  date?: string;
  staff_member?: string;
};

export type AIWeeklySummaryRequest = {
  type: "weekly_summary";
  total: number;
  highRisk: number;
  mediumRisk: number;
  avgForecastScore: number;
  escalationCount: number;
};

// =========================
// UNION (MAIN SDK TYPE)
// =========================

export type AIRequest =
  | AINoteRequest
  | AISummaryRequest
  | AITimelineRequest
  | AIReportRequest
  | AIWeeklySummaryRequest;

// =========================
// RESPONSE
// =========================

export interface AIResponse {
  result?: string;
  error?: string;
}