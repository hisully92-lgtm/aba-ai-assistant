import { useState, useCallback } from "react";
import { telemetry } from "@/lib/telemetry";
import type { AIRequest, AIResponse } from "@/types/ai";

export type AIHookState = {
  loading: boolean;
  error: string | null;
  jobId: string | null;
  result: string | null;
};

export type UseAIReturn = AIHookState & {
  run: (input: AIRequest, userId: string) => Promise<void>;
  reset: () => void;
};

export function useAI(): UseAIReturn {
  const [state, setState] = useState<AIHookState>({
    loading: false,
    error: null,
    jobId: null,
    result: null,
  });

  const run = useCallback(async (input: AIRequest, userId: string) => {
    setState({ loading: true, error: null, jobId: null, result: null });

    try {
      let res: AIResponse;

      switch (input.type) {
        case "summary":
          res = await telemetry.ai.summary(input, userId);
          break;
        case "timeline":
          res = await telemetry.ai.timeline(input, userId);
          break;
        case "report":
          res = await telemetry.ai.report(input, userId);
          break;
        case "note":
          res = await telemetry.ai.note(input, userId);
          break;
        case "weekly_summary":
          res = await telemetry.ai.weeklySummary(input, userId);
          break;
        default:
          throw new Error("Unknown AI request type");
      }

      if (res.error) {
        setState({ loading: false, error: res.error, jobId: null, result: null });
        return;
      }

      setState({
        loading: false,
        error: null,
        jobId: (res as any).jobId ?? null,
        result: res.result ?? null,
      });
    } catch (err: unknown) {
      setState({
        loading: false,
        error: err instanceof Error ? err.message : "AI request failed",
        jobId: null,
        result: null,
      });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ loading: false, error: null, jobId: null, result: null });
  }, []);

  return { ...state, run, reset };
}