import { getClientTimeline } from "@/lib/timeline/getClientTimeline";
import { TimelineItem } from "@/lib/timeline/getClientTimeline";

export type ClientExport = {
  clientId: string;
  generatedAt: string;
  summary: {
    totalSessions: number;
    totalBehaviors: number;
    totalPrograms: number;
  };
  timeline: TimelineItem[];
  sections: {
    sessions: TimelineItem[];
    behaviors: TimelineItem[];
    programs: TimelineItem[];
  };
  insights?: {
    riskFlags: string[];
    recommendations: string[];
  };
};

export async function buildClientExport(
  clientId: string
): Promise<ClientExport> {
  const groupedTimeline = await getClientTimeline(clientId);

  const timeline: TimelineItem[] = groupedTimeline.flatMap(
    (group) => group.items
  );

  const sessions = timeline.filter((t) => t.type === "session");
  const behaviors = timeline.filter((t) => t.type === "behavior");
  const programs = timeline.filter((t) => t.type === "program");

  const riskFlags: string[] = [];

  if (behaviors.length > sessions.length * 2) {
    riskFlags.push("High behavior frequency relative to sessions");
  }

  if (sessions.length === 0) {
    riskFlags.push("No session data recorded");
  }

  const recommendations: string[] = [
    "Continue structured ABA data collection",
    "Monitor behavior trends weekly",
    "Maintain consistent skill program updates",
  ];

  return {
    clientId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalSessions: sessions.length,
      totalBehaviors: behaviors.length,
      totalPrograms: programs.length,
    },
    timeline,
    sections: {
      sessions,
      behaviors,
      programs,
    },
    insights: {
      riskFlags,
      recommendations,
    },
  };
}