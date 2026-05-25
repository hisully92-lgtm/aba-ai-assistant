import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// =========================
// RATE LIMIT
// =========================
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  try {
    const windowSeconds = Math.ceil(windowMs / 1000);
    const redisKey = `rate-limit:${key}`;

    const count = await redis.incr(redisKey);

    if (count === 1) {
      await redis.expire(redisKey, windowSeconds);
    }

    return count <= limit;
  } catch {
    // fail open — allow request if Redis is down
    return true;
  }
}