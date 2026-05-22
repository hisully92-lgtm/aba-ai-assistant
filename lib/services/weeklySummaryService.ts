import { generateWeeklySummary, ExportItem } from "@/lib/ai/generateWeeklySummary";

/**
 * This is the orchestration layer.
 * In the future this will fetch from Supabase or API.
 */
export async function getWeeklySummary(): Promise<string> {
  // TEMP MOCK DATA (replace later with database call)
  const data: ExportItem[] = [
    { risk: "high", forecastScore: 85, escalationWarning: null },
    { risk: "medium", forecastScore: 60, escalationWarning: "watch" },
    { risk: "low", forecastScore: 40, escalationWarning: null },
    { risk: "medium", forecastScore: 70, escalationWarning: null },
  ];

  return generateWeeklySummary(data);
}