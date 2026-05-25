import { supabase } from "@/lib/supabase/client";

export async function getWeeklySummary(clientId?: string): Promise<{
  total: number;
  highRisk: number;
  mediumRisk: number;
  avgForecastScore: number;
  escalationCount: number;
}> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let exportsQuery = supabase
    .from("client_exports")
    .select("id, status")
    .gte("created_at", sevenDaysAgo);

  if (clientId) {
    exportsQuery = exportsQuery.eq("client_id", clientId);
  }

  const { data: exports } = await exportsQuery;

  let riskQuery = supabase
    .from("client_risk")
    .select("risk_level, forecast_score");

  if (clientId) {
    riskQuery = riskQuery.eq("client_id", clientId);
  }

  const { data: riskData } = await riskQuery;

  const total = exports?.length ?? 0;
  const highRisk = (riskData ?? []).filter((r: { risk_level: string }) => r.risk_level === "high").length;
  const mediumRisk = (riskData ?? []).filter((r: { risk_level: string }) => r.risk_level === "medium").length;
  const escalationCount = (exports ?? []).filter((e: { status: string }) => e.status === "pending").length;

  const forecastScores = (riskData ?? [])
    .map((r: { forecast_score: number | null }) => r.forecast_score)
    .filter((s): s is number => s != null);

  const avgForecastScore = forecastScores.length
    ? forecastScores.reduce((a, b) => a + b, 0) / forecastScores.length
    : 0;

  return { total, highRisk, mediumRisk, avgForecastScore, escalationCount };
}