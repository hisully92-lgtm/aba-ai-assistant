import { openai } from "./openaiClient";
import { GroupedTimeline } from "@/lib/timeline/getClientTimeline";
import { ClinicalSummary } from "./buildClinicalSummary";

export type ClinicalReport = {
  date: string;
  report: string;
};

export async function generateClinicalReport(
  timeline: GroupedTimeline[],
  summaries: ClinicalSummary[]
): Promise<ClinicalReport[]> {
  const results: ClinicalReport[] = [];

  for (let i = 0; i < timeline.length; i++) {
    const group = timeline[i];
    const summary = summaries[i];

    const prompt = buildPrompt(group, summary);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a clinical ABA documentation assistant. Write objective, insurance-ready ABA session summaries. Do not be overly verbose. Use professional clinical language.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.4,
    });

    const report =
      completion.choices[0]?.message?.content ||
      "No report generated.";

    results.push({
      date: group.date,
      report,
    });
  }

  return results;
}

function buildPrompt(
  group: GroupedTimeline,
  summary: ClinicalSummary
) {
  const sessionCount = group.items.filter(
    (i) => i.type === "session"
  ).length;

  const behaviorCount = group.items.filter(
    (i) => i.type === "behavior"
  ).length;

  const programCount = group.items.filter(
    (i) => i.type === "program"
  ).length;

  return `
Generate a clinical ABA progress note for the following day:

Date: ${group.date}

Data Summary:
- Sessions: ${sessionCount}
- Behaviors recorded: ${behaviorCount}
- Programs updated: ${programCount}

Pre-summary insight:
${summary.summaryText}

Requirements:
- Write in professional ABA clinical language
- Be objective and data-driven
- Avoid fluff
- Do not mention "AI"
- Make it suitable for insurance documentation
- 5–8 sentences max
`;
}