// =========================
// PROMPT REGISTRY
// =========================

export type PromptType =
  | "client_summary"
  | "client_timeline"
  | "export_report"
  | "session_note"
  | "weekly_summary";

// CLIENT SUMMARY
export function buildClientSummaryPrompt(historyText: string): string {
  return `
You are an expert ABA clinical analyst.

Analyze the client's session history and produce:

1. Behavioral Trends
2. Skill Acquisition Progress
3. Response to Interventions
4. Areas of Concern
5. Strengths
6. Clinical Summary
7. Recommendations

Be objective, clinical, and concise.

CLIENT HISTORY:
${historyText}
`.trim();
}

// CLIENT TIMELINE
export function buildClientTimelinePrompt(timelineData: string): string {
  return `
You are an expert ABA clinical analyst.

Analyze this chronological client timeline and produce:

1. Behavioral progression over time
2. Intervention effectiveness trends
3. Skill acquisition trajectory
4. Regression or risk periods
5. Notable improvements
6. Clinical timeline summary
7. Recommendations

Be structured, objective, and clinically concise.

TIMELINE DATA:
${timelineData}
`.trim();
}

// EXPORT REPORT
export function buildExportReportPrompt(history: string): string {
  return `
You are an expert ABA clinical report generator.

Generate a structured export report including:

1. Clinical Summary
2. Behavioral Trends
3. Intervention Effectiveness
4. Progress Overview
5. Risk Areas
6. Recommendations
7. Formal Export Formatting

Be concise, structured, and professional.

SESSION DATA:
${history}
`.trim();
}

// SESSION NOTE
export function buildSessionNotePrompt(params: {
  clientName: string;
  staffMember: string;
  date: string;
  behaviorsObserved: string | null | undefined;
  interventionsUsed: string | null | undefined;
  clientResponse: string | null | undefined;
  programsTargeted: string | null | undefined;
}): string {
  return `
You are an expert ABA clinical documentation assistant.

Write a professional ABA session note.

Structure:

1. Objective Summary
2. Target Behaviors
3. Interventions Applied
4. Client Response
5. Skill Acquisition / Programs
6. Clinical Analysis
7. Recommendations

Tone:
- clinical
- objective
- insurance-ready
- concise

SESSION DATA:

Client: ${params.clientName}
Staff: ${params.staffMember}
Date: ${params.date}

Behaviors Observed:
${params.behaviorsObserved || "Not recorded"}

Interventions Used:
${params.interventionsUsed || "Not recorded"}

Client Response:
${params.clientResponse || "Not recorded"}

Programs Targeted:
${params.programsTargeted || "Not recorded"}
`.trim();
}

// WEEKLY SUMMARY
export function buildWeeklySummaryPrompt(params: {
  total: number;
  highRisk: number;
  mediumRisk: number;
  avgForecastScore: number;
  escalationCount: number;
}): string {
  return `
You are an expert ABA clinical supervisor reviewing a weekly clinic report.

Here is this week's data:
- Total exports reviewed: ${params.total}
- High risk cases: ${params.highRisk}
- Medium risk cases: ${params.mediumRisk}
- Average forecast score: ${params.avgForecastScore.toFixed(1)}%
- Cases with escalation warnings: ${params.escalationCount}

Based on this data, produce a concise weekly clinical summary including:
1. Overall clinic status (Stable / Elevated / Critical)
2. Key risk observations
3. Recommended supervisor actions
4. Any patterns of concern

Be direct, clinical, and actionable. Keep it under 150 words.
`.trim();
}