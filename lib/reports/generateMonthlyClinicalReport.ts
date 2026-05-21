import { supabase } from "@/lib/supabase/client";
import { getClientAnalytics } from "@/lib/analytics/clientAnalytics";
import { generateClinicalInsights } from "@/lib/ai/generateClinicalInsights";

export async function generateMonthlyClinicalReport(clientId: string, month: string) {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) return null;

  // 1. Pull analytics
  const analytics = await getClientAnalytics(clientId);

  // 2. AI insight (global trend)
  const insight = await generateClinicalInsights(analytics);

  // 3. Build structured summaries
  const sessionSummary = summarize(analytics.sessionsPerDay);
  const behaviorSummary = summarize(analytics.behaviorsPerDay);
  const programSummary = summarize(analytics.programsPerDay);

  const fullSummary =
    `${insight.summary}\n\n` +
    `Session Trends: ${sessionSummary}\n` +
    `Behavior Trends: ${behaviorSummary}\n` +
    `Program Trends: ${programSummary}`;

  const { data, error } = await supabase
    .from("monthly_clinical_reports")
    .insert([
      {
        client_id: clientId,
        created_by: user.id,
        month,
        summary: fullSummary,
        behavior_summary: behaviorSummary,
        session_summary: sessionSummary,
        program_summary: programSummary,
        ai_insight: JSON.stringify(insight),
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Monthly report error:", error.message);
    return null;
  }

  return data;
}

// simple aggregation helper
function summarize(obj: Record<string, number>) {
  const values = Object.values(obj);

  if (values.length === 0) return "No data available.";

  const total = values.reduce((a, b) => a + b, 0);
  const avg = total / values.length;

  return `Total: ${total}, Average per day: ${avg.toFixed(2)}`;
}