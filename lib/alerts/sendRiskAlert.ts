type RiskLevel = "low" | "medium" | "high";

export async function sendRiskAlert(params: {
  clientId: string;
  risk: RiskLevel;
}) {
  try {
    await fetch("/api/alerts/risk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });
  } catch (err) {
    console.error("Alert send failed:", err);
  }
}