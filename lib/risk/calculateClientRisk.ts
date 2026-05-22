type RiskLevel = "low" | "medium" | "high";

type Client = {
  id: string;
  name: string;
  age: number;
  diagnosis: string;
};

export function calculateClientRisk(
  client: Client
): RiskLevel {
  const diagnosis =
    client.diagnosis.toLowerCase();

  const highRiskKeywords = [
    "aggression",
    "self-injury",
    "asd",
    "violent",
    "elopement",
  ];

  const mediumRiskKeywords = [
    "delay",
    "attention",
    "compliance",
    "communication",
  ];

  const hasHighRisk =
    highRiskKeywords.some((keyword) =>
      diagnosis.includes(keyword)
    );

  if (hasHighRisk) {
    return "high";
  }

  const hasMediumRisk =
    mediumRiskKeywords.some((keyword) =>
      diagnosis.includes(keyword)
    );

  if (hasMediumRisk || client.age > 10) {
    return "medium";
  }

  return "low";
}