export type TraceSpan = {
  name: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
};

export type RequestTrace = {
  traceId: string;
  userId: string;
  route: string;
  startTime: number;
  spans: TraceSpan[];
  error?: string;
};

export function createTrace(userId: string, route: string): RequestTrace {
  return {
    traceId: crypto.randomUUID(),
    userId,
    route,
    startTime: performance.now(),
    spans: [],
  };
}

export function startSpan(trace: RequestTrace, name: string, metadata?: Record<string, unknown>): TraceSpan {
  const span: TraceSpan = {
    name,
    startTime: performance.now(),
    metadata,
  };
  trace.spans.push(span);
  return span;
}

export function endSpan(span: TraceSpan): void {
  span.endTime = performance.now();
  span.durationMs = Math.round(span.endTime - span.startTime);
}

export function finishTrace(trace: RequestTrace): {
  traceId: string;
  totalMs: number;
  spans: TraceSpan[];
  error?: string;
} {
  const totalMs = Math.round(performance.now() - trace.startTime);
  return {
    traceId: trace.traceId,
    totalMs,
    spans: trace.spans,
    error: trace.error,
  };
}