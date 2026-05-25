// =========================
// MODEL REGISTRY
// =========================

export type AIModel =
  | "claude-haiku-4-5-20251001"
  | "claude-sonnet-4-6"
  | "claude-opus-4-6";

export type AITaskType =
  | "note"
  | "summary"
  | "timeline"
  | "report"
  | "weekly_summary";

export type ModelConfig = {
  model: AIModel;
  maxTokens: number;
  reason: string;
};

export const MODEL_ROUTING: Record<AITaskType, ModelConfig> = {
  note: {
    model: "claude-haiku-4-5-20251001",
    maxTokens: 800,
    reason: "Simple structured output — fast and cost-effective",
  },
  summary: {
    model: "claude-sonnet-4-6",
    maxTokens: 1000,
    reason: "Clinical analysis requires balanced reasoning",
  },
  timeline: {
    model: "claude-sonnet-4-6",
    maxTokens: 1200,
    reason: "Longitudinal pattern recognition needs stronger model",
  },
  report: {
    model: "claude-sonnet-4-6",
    maxTokens: 1500,
    reason: "Formal export reports need detailed structured output",
  },
  weekly_summary: {
    model: "claude-sonnet-4-6",
    maxTokens: 600,
    reason: "Supervisor-grade clinical overview",
  },
};

export function getModelConfig(type: AITaskType): ModelConfig {
  return MODEL_ROUTING[type] ?? {
    model: "claude-sonnet-4-6",
    maxTokens: 1000,
    reason: "Default fallback",
  };
}

export function logModelSelection(type: AITaskType): void {
  const config = getModelConfig(type);
  console.info(
    `[model_router] type=${type} model=${config.model} maxTokens=${config.maxTokens}`
  );
}