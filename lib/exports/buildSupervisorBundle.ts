import { ClientExport } from "@/lib/exports/buildClientExport";

export type SupervisorBundle = {
  clientId: string;
  clinicalSummary: string;
  riskFlags: string[];
  recommendations: string[];
};

export function buildSupervisorBundle(
  data: ClientExport
): SupervisorBundle {
  const riskFlags: string[] = [];

  if (data.summary.totalBehaviors > data.summary.totalSessions * 2) {
    riskFlags.push("High behavior frequency relative to sessions");
  }

  if (data.summary.totalSessions === 0) {
    riskFlags.push("No session data recorded");
  }

  return {
    clientId: data.clientId,

    clinicalSummary:
      `Client has ${data.summary.totalSessions} sessions, ` +
      `${data.summary.totalBehaviors} behaviors, and ` +
      `${data.summary.totalPrograms} programs recorded.`,

    riskFlags,

    recommendations: [
      "Continue structured data collection",
      "Review behavior escalation patterns",
      "Maintain weekly program updates",
    ],
  };
}