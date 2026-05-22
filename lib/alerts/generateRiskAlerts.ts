type RiskLevel = "low" | "medium" | "high";

type Alert = {
  client_id: string;
  risk: RiskLevel;
  message: string;
  severity: "info" | "warning" | "critical";
};

export function generateRiskAlerts(
  items: { client_id: string; risk: RiskLevel }[]
): Alert[] {
  const alerts: Alert[] = [];

  for (const item of items) {
    if (item.risk === "high") {
      alerts.push({
        client_id: item.client_id,
        risk: "high",
        severity: "critical",
        message: "Client shows HIGH risk indicators. Immediate review recommended.",
      });
    }

    if (item.risk === "medium") {
      alerts.push({
        client_id: item.client_id,
        risk: "medium",
        severity: "warning",
        message: "Client shows elevated risk patterns. Monitor closely.",
      });
    }
  }

  return alerts;
}