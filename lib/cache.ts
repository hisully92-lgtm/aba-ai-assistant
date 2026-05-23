const cache = new Map<string, { data: any; ts: number }>();

export function getCache(key: string) {
  const entry = cache.get(key);
  if (!entry) return null;

  const expired = Date.now() - entry.ts > 5 * 60_000;
  if (expired) return null;

  return entry.data;
}

export function setCache(key: string, data: any) {
  cache.set(key, {
    data,
    ts: Date.now(),
  });
}