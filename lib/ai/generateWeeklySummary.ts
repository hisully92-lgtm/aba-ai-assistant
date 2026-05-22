export type ExportItem = {
  risk: "low" | "medium" | "high";
  forecastScore: number;
  escalationWarning: string | null;
};

export function generateWeeklySummary(data: ExportItem[]): string {
  const total = data.length;

  const highRisk = data.filter((x) => x.risk === "high").length;
  const mediumRisk = data.filter((x) => x.risk === "medium").length;

  const avgScore =
    data.reduce((sum, x) => sum + x.forecastScore, 0) / (total || 1);

  const escalationCount = data.filter((x) => x.escalationWarning).length;

  return `
Weekly Clinical Summary

Total exports: ${total}
High risk: ${highRisk}
Medium risk: ${mediumRisk}
Average score: ${avgScore.toFixed(1)}
Escalations: ${escalationCount}

System status: ${highRisk > 3 ? "Elevated risk" : "Stable"}
  `.trim();
}