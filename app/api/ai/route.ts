import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requirePro } from "@/lib/billing/requirePro";
import { logEvent } from "@/lib/observability/logEvent";
import { logAudit } from "@/lib/observability/logAudit";
import { logAccess } from "@/lib/observability/logAccess";
import { AIRequestSchema } from "@/lib/ai/schemas";
import { startTimer } from "@/lib/observability/telemetry/trackTiming";
import { logAIRequest } from "@/lib/observability/telemetry/logAIRequest";
import { toErrorResponse } from "@/lib/errors";
import { sanitizeObject } from "@/lib/sanitize";
import { runAIEngine } from "@/lib/ai/engine";

// =========================
// SAFE LOGGING
// =========================
async function safe(fn: any, ...args: any[]) {
  try {
    await fn(...args);
  } catch {}
}

// =========================
// EXTRACT IP
// =========================
function extractIp(req: Request): string {
  return (
    (req.headers.get("x-forwarded-for") ?? "")
      .split(",")[0]
      .trim() || "unknown"
  );
}

// =========================
// MAIN ROUTE
// =========================
export async function POST(req: Request) {
  let user: any = null;

  try {
    const ip = extractIp(req);

    // IP RATE LIMIT
    const ipAllowed = await rateLimit(`ip:${ip}`, 100, 60_000);
    if (!ipAllowed) {
      await safe(logAccess, {
        userId: "anonymous",
        resource: "api/ai",
        action: "read",
        ip,
        metadata: { reason: "ip_rate_limited" },
      });
      return NextResponse.json(
        { error: "Too many requests", code: "RATE_LIMITED" },
        { status: 429 }
      );
    }

    // AUTH — extract the caller's Bearer token and resolve the real user.
    // supabaseAdmin is a service-role client with no request-bound session,
    // so auth.getUser() with no token never identifies anyone; it must be
    // passed the token explicitly, same pattern used in the push routes.
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      await safe(logAccess, {
        userId: "anonymous",
        resource: "api/ai",
        action: "read",
        ip,
        metadata: { reason: "missing_token" },
      });
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { data: auth } = await supabaseAdmin.auth.getUser(token);
    user = auth?.user;

    if (!user) {
      await safe(logAccess, {
        userId: "anonymous",
        resource: "api/ai",
        action: "read",
        ip,
        metadata: { reason: "unauthorized" },
      });
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // BILLING
    await requirePro(user.id);

    // USER RATE LIMIT
    const userAllowed = await rateLimit(`ai:${user.id}`, 60, 60_000);
    if (!userAllowed) {
      await safe(logAudit, {
        userId: user.id,
        action: "rate_limit_exceeded",
        resource: "ai",
        metadata: { route: "/api/ai", ip },
      });
      await safe(logAccess, {
        userId: user.id,
        resource: "api/ai",
        action: "read",
        ip,
        metadata: { reason: "user_rate_limited" },
      });
      return NextResponse.json(
        { error: "Too many requests", code: "RATE_LIMITED" },
        { status: 429 }
      );
    }

    // SANITIZE + VALIDATE
    const raw = await req.json();
    const sanitized = sanitizeObject(raw);
    const parsed = AIRequestSchema.safeParse(sanitized);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const body = parsed.data;
    const timer = startTimer();

    // RUN ENGINE
    const { normalized, trace } = await runAIEngine(body, user.id, ip);
    const durationMs = timer.stop();

    // LOG REQUEST
    await safe(logAIRequest, {
      userId: user.id,
      type: body.type,
      durationMs,
      success: normalized.success,
      metadata: { ip, traceId: trace.traceId },
    });

    if (!normalized.success) {
      return NextResponse.json(
        { error: normalized.error, code: "AI_ERROR" },
        { status: normalized.status }
      );
    }

    return NextResponse.json(
      { success: true, jobId: normalized.jobId, result: normalized.result, cached: normalized.cached },
      { status: normalized.status }
    );

  } catch (err: unknown) {
    await safe(logEvent, {
      userId: user?.id || "unknown",
      type: "error",
      event: "ai_engine_failed",
      metadata: {
        route: "/api/ai",
        error: err instanceof Error ? err.message : "unknown",
      },
    });

    const { error, code, status } = toErrorResponse(err);
    return NextResponse.json({ error, code }, { status });
  }
}
