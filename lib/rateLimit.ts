// lib/rate-limit.ts

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  req: { headers: { get: (key: string) => string | null } },
  { limit = 20, windowMs = 60_000 } = {}
): { success: boolean } {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return { success: true };
  }

  entry.count++;
  if (entry.count > limit) {
    return { success: false };
  }

  return { success: true };
}