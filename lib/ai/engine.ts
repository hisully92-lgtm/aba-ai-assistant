import { AIRequestSchema } from "@/lib/ai/schemas";
import { normalizeHandlerResponse } from "@/lib/ai/normalize";
import { handleSummary } from "@/lib/ai/handlers/clientSummary";
import { handleTimeline } from "@/lib/ai/handlers/clientTimeline";
import { handleReport } from "@/lib/ai/handlers/exportReport";
import { handleNote } from "@/lib/ai/handlers/sessionNote";
import { handleWeeklySummary } from "@/lib/ai/handlers/weeklySummary";
import { createTrace, startSpan, endSpan, finishTrace } from "@/lib/observability/tracing";
import { trackAIUsage } from "@/lib/observability/aiUsagePipeline";
import { AppError } from "@/lib/errors";
import type { z } from "zod";

export type AIEngineInput = z.infer<typeof AIRequestSchema>;

export async function runAIEngine(
  body: AIEngineInput,
  userId: string,
  ip: string
) {
  const trace = createTrace(userId, "/api/ai");

  const handlerSpan = startSpan(trace, `handler:${body.type}`, {
    type: body.type,
    userId,
  });

  let raw: Record<string, unknown>;

  try {
    switch (body.type) {
      case "summary":
        raw = await handleSummary(body, userId);
        break;
      case "timeline":
        raw = await handleTimeline(body, userId);
        break;
      case "report":
        raw = await handleReport(body, userId);
        break;
      case "note":
        raw = await handleNote(body, userId);
        break;
      case "weekly_summary":
        raw = await handleWeeklySummary(body, userId);
        break;
      default:
        throw new AppError("VALIDATION_ERROR", "Invalid AI request type", { status: 400 });
    }
  } finally {
    endSpan(handlerSpan);
  }

  const normalized = normalizeHandlerResponse(raw);
  const finished = finishTrace(trace);

  // Track usage via unified pipeline
  await trackAIUsage({
    userId,
    type: body.type,
    durationMs: finished.totalMs,
    success: normalized.success,
    error: normalized.error,
    jobId: normalized.jobId,
    clientId: "client_id" in body ? body.client_id : undefined,
    cached: normalized.cached,
    metadata: { ip, traceId: finished.traceId },
  });

  return { normalized, trace: finished };
}