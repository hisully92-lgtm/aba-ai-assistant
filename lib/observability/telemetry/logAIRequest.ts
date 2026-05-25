// =========================
// 📡 LOG AI REQUEST
// =========================

import { logEvent } from "@/lib/observability/logEvent";
import { logAudit } from "@/lib/observability/logAudit";

export type AIRequestLog = {
  userId: string;
  type: string;
  durationMs?: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
};

export async function logAIRequest(log: AIRequestLog): Promise<void> {
  await logEvent({
    userId: log.userId,
    type: "ai",
    event: `ai.${log.type}.${log.success ? "success" : "failed"}`,
    metadata: {
      durationMs: log.durationMs,
      error: log.error,
      ...log.metadata,
    },
  });

  await logAudit({
    userId: log.userId,
    action: `ai.${log.type}.${log.success ? "success" : "failed"}`,
    resource: `ai:${log.type}`,
    metadata: {
      durationMs: log.durationMs,
      error: log.error,
      ...log.metadata,
    },
  });
}