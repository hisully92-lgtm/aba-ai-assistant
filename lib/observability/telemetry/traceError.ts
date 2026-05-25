// =========================
// 🔍 TRACE ERROR
// =========================

export type AIErrorTrace = {
  message: string;
  stack?: string;
  timestamp: string;
  context?: Record<string, any>;
};

export function traceError(err: any, context?: Record<string, any>): AIErrorTrace {
  return {
    message: err?.message || "Unknown error",
    stack: err?.stack || undefined,
    timestamp: new Date().toISOString(),
    context: context || {},
  };
}