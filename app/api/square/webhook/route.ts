import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logAudit } from "@/lib/observability/logAudit";
import { rateLimit } from "@/lib/rate-limit";
import crypto from "crypto";

// =========================
// 🔐 SIGNATURE VERIFICATION
// =========================
function verifySquareSignature(
  body: string,
  signature: string,
  secret: string
) {
  const hash = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64");

  // ⚠️ timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(signature || "")
  );
}

export async function POST(req: Request) {
  let bodyText = "";

  try {
    // =========================
    // RAW BODY
    // =========================
    bodyText = await req.text();

    let body: any;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // =========================
    // EXTRACT DATA
    // =========================
    const eventId = body?.id;
    const eventType = body?.type;
    const payment = body?.data?.object?.payment;

    const userId =
      payment?.metadata?.userId ||
      body?.data?.object?.customer?.reference_id;

    const ip =
      (req.headers.get("x-forwarded-for") ?? "")
        .split(",")[0]
        .trim() || "unknown";

    // =========================
    // RATE LIMIT
    // =========================
    const rateKey = `webhook:${eventId || "no-event"}:${ip}`;

    if (!rateLimit(rateKey, 1, 60_000)) {
      return NextResponse.json({ received: true });
    }

    // =========================
    // SIGNATURE CHECK
    // =========================
    const signature =
      req.headers.get("x-square-hmacsha256-signature") || "";

    const isValid = verifySquareSignature(
      bodyText,
      signature,
      process.env.SQUARE_WEBHOOK_SIGNATURE_KEY!
    );

    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // =========================
    // IDEMPOTENCY CHECK
    // =========================
    const { data: existing } = await supabaseAdmin
      .from("billing_events")
      .select("event_id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existing) {
      await logAudit({
        userId: userId || "unknown",
        action: "webhook_duplicate",
        resource: "square",
        metadata: { eventId, eventType },
      });

      return NextResponse.json({ received: true });
    }

    // =========================
    // MARK EVENT PROCESSED
    // =========================
    await supabaseAdmin.from("billing_events").insert({
      event_id: eventId,
    });

    // =========================
    // 🔵 PAYMENT SUCCESS → UPGRADE
    // =========================
    if (
      eventType === "payment.created" ||
      eventType === "payment.updated"
    ) {
      if (!userId) {
        return NextResponse.json(
          { error: "Missing userId" },
          { status: 400 }
        );
      }

      await supabaseAdmin
        .from("profiles")
        .update({
          plan: "pro",
          subscription_status: "active",
        })
        .eq("id", userId);

      // 📊 UNIFIED AUDIT LOG
      await logAudit({
        userId,
        action: "subscription_upgraded",
        resource: "square",
        metadata: {
          eventType,
          payment_id: payment?.id,
        },
      });

      return NextResponse.json({ received: true });
    }

    // =========================
    // 🔴 PAYMENT FAILED
    // =========================
    if (eventType === "payment.failed") {
      if (userId) {
        await supabaseAdmin
          .from("profiles")
          .update({
            subscription_status: "past_due",
          })
          .eq("id", userId);

        await logAudit({
          userId,
          action: "payment_failed",
          resource: "square",
          metadata: {
            payment_id: payment?.id,
          },
        });
      }

      return NextResponse.json({ received: true });
    }

    // =========================
    // ⚠️ GRACE / CANCELLATION EVENTS
    // =========================
    if (
      eventType === "subscription.canceled" ||
      eventType === "payment.declined"
    ) {
      if (userId) {
        await supabaseAdmin
          .from("profiles")
          .update({
            subscription_status: "grace_period",
          })
          .eq("id", userId);

        await logAudit({
          userId,
          action: "subscription_grace_period",
          resource: "square",
          metadata: {
            eventType,
          },
        });
      }

      return NextResponse.json({ received: true });
    }

    // =========================
    // DEFAULT ACK
    // =========================
    return NextResponse.json({ received: true });
  } catch (err) {
    await logAudit({
      userId: "unknown",
      action: "webhook_error",
      resource: "square",
      metadata: {
        message: err instanceof Error ? err.message : "Unknown error",
      },
    });

    console.error("Webhook error:", err);

    return NextResponse.json(
      { error: "Webhook failed" },
      { status: 500 }
    );
  }
}