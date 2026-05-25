import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// =========================
// GET CACHE
// =========================
export async function getCache<T = any>(key: string): Promise<T | null> {
  try {
    const value = await redis.get<T>(key);
    return value ?? null;
  } catch {
    return null;
  }
}

// =========================
// SET CACHE
// =========================
export async function setCache<T = any>(
  key: string,
  value: T,
  ttlSeconds = 300
): Promise<void> {
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch {}
}

// =========================
// DELETE CACHE
// =========================
export async function deleteCache(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch {}
}

// =========================
// CLEAR CACHE (dev only)
// =========================
export async function clearCache(): Promise<void> {
  try {
    await redis.flushall();
  } catch {}
}