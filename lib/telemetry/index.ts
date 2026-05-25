import type { AIRequest, AIResponse } from "@/types/ai";
import { aiClient } from "@/lib/ai/aiClient";
import { startTimer } from "@/lib/observability/telemetry/trackTiming";
import { traceError } from "@/lib/observability/telemetry/traceError";
import { logAIRequest } from "@/lib/observability/telemetry/logAIRequest";
import { trackUsage } from "@/lib/observability/telemetry/trackUsage";

// =========================
// WRAPPED REQUEST
// =========================

async function trackedRequest(
  input: AIRequest,
  userId: string
): Promise<AIResponse> {
  const timer = startTimer();

  try {
    const result = await aiClient.note(input as any);
    const durationMs = timer.stop();

    await logAIRequest({
      userId,
      type: input.type,
      durationMs,
      success: true,
    });

    await trackUsage({
      userId,
      type: input.type,
      durationMs,
      success: true,
    });

    return result;
  } catch (err: any) {
    const durationMs = timer.stop();
    const trace = traceError(err, { type: input.type, userId });

    await logAIRequest({
      userId,
      type: input.type,
      durationMs,
      success: false,
      error: trace.message,
    });

    await trackUsage({
      userId,
      type: input.type,
      durationMs,
      success: false,
      error: trace.message,
    });

    return { error: trace.message };
  }
}

// =========================
// TELEMETRY SDK
// =========================

export const telemetry = {
  ai: {
    note(input: Extract<AIRequest, { type: "note" }>, userId: string) {
      return trackedRequest(input, userId);
    },

    summary(input: Extract<AIRequest, { type: "summary" }>, userId: string) {
      return trackedRequest(input, userId);
    },

    timeline(input: Extract<AIRequest, { type: "timeline" }>, userId: string) {
      return trackedRequest(input, userId);
    },

    report(input: Extract<AIRequest, { type: "report" }>, userId: string) {
      return trackedRequest(input, userId);
    },

    weeklySummary(
      input: Extract<AIRequest, { type: "weekly_summary" }>,
      userId: string
    ) {
      return trackedRequest(input, userId);
    },
  },
};