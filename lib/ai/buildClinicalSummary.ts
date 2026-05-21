import { GroupedTimeline } from "@/lib/timeline/getClientTimeline";

export type ClinicalSummary = {
  date: string;
  totalEvents: number;
  sessions: number;
  behaviors: number;
  programs: number;
  summaryText: string;
};

export function buildClinicalSummary(
  timeline: GroupedTimeline[]
): ClinicalSummary[] {
  return timeline.map((group) => {
    let sessions = 0;
    let behaviors = 0;
    let programs = 0;

    for (const item of group.items) {
      if (item.type === "session") sessions++;
      if (item.type === "behavior") behaviors++;
      if (item.type === "program") programs++;
    }

    const summaryText = generateSummaryText(
      sessions,
      behaviors,
      programs
    );

    return {
      date: group.date,
      totalEvents: group.items.length,
      sessions,
      behaviors,
      programs,
      summaryText,
    };
  });
}

function generateSummaryText(
  sessions: number,
  behaviors: number,
  programs: number
): string {
  let parts: string[] = [];

  if (sessions > 0) {
    parts.push(`${sessions} session${sessions > 1 ? "s" : ""} completed`);
  }

  if (behaviors > 0) {
    parts.push(`${behaviors} behavior${behaviors > 1 ? "s" : ""} recorded`);
  }

  if (programs > 0) {
    parts.push(`${programs} skill program${programs > 1 ? "s" : ""} updated`);
  }

  if (parts.length === 0) {
    return "No clinical activity recorded for this day.";
  }

  return parts.join(", ") + ".";
}