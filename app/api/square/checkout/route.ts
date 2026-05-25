import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/server";
import { logAudit } from "@/lib/observability/logAudit";
import { logEvent } from "@/lib/observability/logEvent";
import { logBillingAudit } from "@/lib/observability/logBillingAudit";
import { rateLimit } from "@/lib/rate-limit";

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
// SAFE LOGGING
// =========================
async function safe(fn: any, ...args: any[]) {
  try {
    await fn(...args);
  } catch {}
}

export async function POST(req: Request) {
  let user: any = null;

  try {
    const ip = extractIp(req);

    // IP RATE LIMIT — 10 checkout attempts per hour per IP
    const ipAllowed = await rateLimit(`checkout:ip:${ip}`, 10, 60 * 60_000);

    if (!ipAllowed) {
      await safe(logAudit, {
        userId: "unknown",
        action: "checkout.spam.ip_blocked",
        resource: "billing",
        metadata: { ip },
      });

      await safe(logBillingAudit, {
        userId: "unknown",
        action: "checkout.spam.ip_blocked",
        resource: "billing",
        metadata: { ip },
        ip,
      });

      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    // AUTH
    const { data: auth } = await supabaseAdmin.auth.getUser();
    user = auth?.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // USER RATE LIMIT — 5 checkout attempts per hour per user
    const userAllowed = await rateLimit(
      `checkout:user:${user.id}`,
      5,
      60 * 60_000
    );

    if (!userAllowed) {
      await safe(logAudit, {
        userId: user.id,
        action: "checkout.spam.user_blocked",
        resource: "billing",
        metadata: { ip },
      });

      await safe(logBillingAudit, {
        userId: user.id,
        action: "checkout.spam.user_blocked",
        resource: "billing",
        metadata: { ip },
        ip,
      });

      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    // CHECK IF ALREADY PRO
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan, subscription_status")
      .eq("id", user.id)
      .single();

    if (
      profile?.plan === "pro" &&
      profile?.subscription_status === "active"
    ) {
      await safe(logBillingAudit, {
        userId: user.id,
        action: "checkout.already_pro",
        resource: "billing",
        metadata: { ip },
        ip,
      });

      return NextResponse.json(
        { error: "Already subscribed to Pro" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { plan } = body;

    if (!plan) {
      return NextResponse.json(
        { error: "Missing plan" },
        { status: 400 }
      );
    }

    // AUDIT CHECKOUT ATTEMPT
    await safe(logAudit, {
      userId: user.id,
      action: "checkout.attempt",
      resource: "billing",
      metadata: { provider: "square", plan, ip },
    });

    await safe(logBillingAudit, {
      userId: user.id,
      action: "checkout.attempt",
      resource: "billing",
      metadata: { plan },
      ip,
    });

    await safe(logEvent, {
      userId: user.id,
      type: "billing",
      event: "checkout_started",
      metadata: { plan, ip },
    });

    // CHECKOUT URL
    const checkoutUrl = "https://squareup.com/checkout-demo";

    return NextResponse.json({ url: checkoutUrl });

  } catch (err: any) {
    await safe(logEvent, {
      userId: user?.id || "unknown",
      type: "error",
      event: "checkout.failed",
      metadata: { error: err?.message },
    });

    await safe(logAudit, {
      userId: user?.id || "unknown",
      action: "checkout.failed",
      resource: "billing",
      metadata: { error: err?.message },
    });

    await safe(logBillingAudit, {
      userId: user?.id || "unknown",
      action: "checkout.failed",
      resource: "billing",
      metadata: { error: err?.message },
    });

    return NextResponse.json(
      { error: "Checkout creation failed" },
      { status: 500 }
    );
  }
}