export type RetryPolicy = {
  maxAttempts: number;
  backoffMs: (attempt: number) => number;
};

export const defaultRetryPolicy: RetryPolicy = {
  maxAttempts: 3,
  backoffMs: (attempt: number) => Math.min(1000 * 2 ** attempt, 30_000),
};

export function shouldRetry(attempts: number, policy = defaultRetryPolicy): boolean {
  return attempts < policy.maxAttempts;
}

export function getBackoffMs(attempt: number, policy = defaultRetryPolicy): number {
  return policy.backoffMs(attempt);
}