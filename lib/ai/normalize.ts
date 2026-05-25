export type NormalizedAIResponse = {
  success: boolean;
  jobId?: string;
  result?: string;
  cached?: boolean;
  error?: string;
  status: number;
};

export function normalizeHandlerResponse(raw: Record<string, unknown>): NormalizedAIResponse {
  // Error responses
  if (raw.error) {
    return {
      success: false,
      error: String(raw.error),
      status: typeof raw.status === "number" ? raw.status : 500,
    };
  }

  // Cached responses
  if (raw.cached === true) {
    return {
      success: true,
      cached: true,
      result: typeof raw.result === "string" ? raw.result : undefined,
      status: 200,
    };
  }

  // Queued job responses
  if (raw.jobId) {
    return {
      success: true,
      jobId: String(raw.jobId),
      status: typeof raw.status === "number" ? raw.status : 200,
    };
  }

  // Direct result responses
  if (raw.result) {
    return {
      success: true,
      result: String(raw.result),
      status: typeof raw.status === "number" ? raw.status : 200,
    };
  }

  // Fallback
  return {
    success: typeof raw.success === "boolean" ? raw.success : true,
    status: typeof raw.status === "number" ? raw.status : 200,
  };
}