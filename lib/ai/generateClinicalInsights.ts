import { openai } from "./openaiClient";
import { ClientAnalytics } from "@/lib/analytics/clientAnalytics";

export type ClinicalInsight = {
  summary: string;
  status: "improving" | "stable" | "regressing";
  reasoning: string;
};

export async function generateClinicalInsights(
  analytics: ClientAnalytics
): Promise<ClinicalInsight> {
  const prompt = buildPrompt(analytics);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a licensed ABA clinical supervisor AI. You analyze behavioral and skill acquisition trends and provide objective clinical insights. Be conservative and evidence-based.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.3,
  });

  const text = completion.choices[0]?.message?.content || "";

  try {
    return JSON.parse(text);
  } catch {
    return {
      summary: text,
      status: "stable",
      reasoning: "AI output was not structured JSON",
    };
  }
}

function buildPrompt(analytics: ClientAnalytics) {
  return `
Analyze the following ABA client data trends and return ONLY valid JSON.

DATA:

Sessions per day:
${JSON.stringify(analytics.sessionsPerDay, null, 2)}

Behaviors per day:
${JSON.stringify(analytics.behaviorsPerDay, null, 2)}

Programs per day:
${JSON.stringify(analytics.programsPerDay, null, 2)}

OUTPUT FORMAT (STRICT JSON ONLY):

{
  "summary": "short clinical summary (3–6 sentences)",
  "status": "improving | stable | regressing",
  "reasoning": "clinical reasoning for classification"
}

RULES:
- Be conservative
- Do NOT hallucinate improvement
- Use only provided data trends
- Focus on behavior frequency change over time
`;
}