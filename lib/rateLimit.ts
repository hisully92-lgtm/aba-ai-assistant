const requests = new Map<string, { count: number; ts: number }>();

export function rateLimit(key: string, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const record = requests.get(key);

  if (!record) {
    requests.set(key, { count: 1, ts: now });
    return true;
  }

  const isExpired = now - record.ts > windowMs;

  if (isExpired) {
    requests.set(key, { count: 1, ts: now });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count += 1;
  requests.set(key, record);

  return true;
}