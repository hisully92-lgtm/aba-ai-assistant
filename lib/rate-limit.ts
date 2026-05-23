const memory = new Map<string, { count: number; ts: number }>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
) {
  const now = Date.now();
  const entry = memory.get(key);

  if (!entry) {
    memory.set(key, { count: 1, ts: now });
    return true;
  }

  const isExpired = now - entry.ts > windowMs;

  if (isExpired) {
    memory.set(key, { count: 1, ts: now });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count += 1;
  memory.set(key, entry);

  return true;
}
