import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createSquarePaymentLink } from "@/lib/square";
import { logBillingEvent } from "@/lib/billing/logBillingEvent";
import { logEvent } from "@/lib/monitoring/logEvent";
import { rateLimit } from "@/lib/rate-limit";

export async function POST() {
  try {
    // =========================
    // 🔐 AUTH CHECK
    // =========================
    const { data: auth } = await supabaseAdmin.auth.getUser();
    const user = auth?.user;

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // =========================
    // 🚫 CHECKOUT SPAM PROTECTION
    // =========================
    if (!rateLimit(`checkout:${user.id}`, 5, 60_000)) {
      return NextResponse.json(
        { error: "Too many checkout attempts" },
        { status: 429 }
      );
    }

    // =========================
    // 🧠 FETCH USER PLAN
    // =========================
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .maybeSingle();

    // =========================
    // 📊 BILLING TRACKING
    // =========================

    // Always log checkout attempt
    await logBillingEvent({
      userId: user.id,
      event: "checkout_attempt",
    });

    // Flag suspicious repeat checkout from pro users
    if (profile?.plan === "pro") {
      await logBillingEvent({
        userId: user.id,
        event: "suspicious_checkout_attempt",
      });
    }

    // =========================
    // 🚫 BLOCK IF ALREADY PRO
    // =========================
    if (profile?.plan === "pro") {
      await logBillingEvent({
        userId: user.id,
        event: "checkout_blocked",
        metadata: {
          reason: "already_pro",
        },
      });

      return NextResponse.json(
        { error: "Already subscribed" },
        { status: 403 }
      );
    }

    // =========================
    // 💳 CREATE PAYMENT LINK
    // =========================
    const result = await createSquarePaymentLink(user.id);
    const url = result?.paymentLink?.url;

    if (!url) {
      await logEvent({
        type: "error",
        event: "checkout_link_failed",
        metadata: {
          userId: user.id,
        },
      });

      return NextResponse.json(
        { error: "Failed to create payment link" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url });

  } catch (err) {
    // =========================
    // 🚨 CRASH LOGGING
    // =========================
    await logEvent({
      type: "error",
      event: "server_crash",
      metadata: {
        message: err instanceof Error ? err.message : "Unknown error",
      },
    });

    console.error("Checkout failed:", err);

    return NextResponse.json(
      { error: "Checkout failed" },
      { status: 500 }
    );
  }
}