import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logAudit } from "@/lib/observability/logAudit";
import { logBillingAudit } from "@/lib/observability/logBillingAudit";
import { rateLimit } from "@/lib/rate-limit";

async function safe(fn: any, ...args: any[]) {
  try { await fn(...args); } catch {}
}

function verifySquareSignature(
  body: string,
  signature: string,
  secret: string,
  url: string
): boolean {
  const hash = crypto
    .createHmac("sha256", secret)
    .update(url + body)
    .digest("base64");
  const hashBuf = Buffer.from(hash);
  const sigBuf = Buffer.from(signature || "");
  if (hashBuf.length !== sigBuf.length) return false;
  return crypto.timingSafeEqual(hashBuf, sigBuf);
}

export async function POST(req: Request) {
  let bodyText = "";
  let userId = "unknown";

  try {
    bodyText = await req.text();

    let body: any;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const eventId = body?.id;
    const eventType = body?.type;
    const payment = body?.data?.object?.payment;

    userId =
      payment?.metadata?.userId ||
      body?.data?.object?.customer?.reference_id ||
      "unknown";

    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";

    // RATE LIMIT
    const rateKey = `webhook:${eventId || "no-event"}:${ip}`;
    const allowed = await rateLimit(rateKey, 1, 60_000);
    if (!allowed) return NextResponse.json({ received: true });

    // SIGNATURE VERIFICATION
    const signature = req.headers.get("x-square-hmacsha256-signature") || "";
    const webhookUrl = "https://aba-ai-assistant.com/api/square/webhook";

    const isValid = verifySquareSignature(
      bodyText,
      signature,
      process.env.SQUARE_WEBHOOK_SIGNATURE_KEY!,
      webhookUrl
    );

    if (!isValid) {
      await safe(logAudit, {
        userId,
        action: "webhook_invalid_signature",
        resource: "square",
        metadata: { eventId, eventType, ip },
      });
      await safe(logBillingAudit, {
        userId,
        action: "webhook_invalid_signature",
        resource: "square",
        metadata: { eventId, eventType },
        ip,
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // IDEMPOTENCY CHECK
    const { data: existing } = await supabaseAdmin
      .from("billing_events")
      .select("event_id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ received: true });
    }

    // LOG EVENT
    await supabaseAdmin.from("billing_events").insert({
      event_id: eventId,
      event_type: eventType,
      user_id: userId !== "unknown" ? userId : null,
      created_at: new Date().toISOString(),
    });

    // PAYMENT SUCCESS
    if (
      eventType === "payment.created" ||
      eventType === "payment.updated" ||
      eventType === "payment.completed" ||
      eventType === "invoice.payment_made" ||
      eventType === "order.fulfillment.updated" ||
      eventType === "order.updated"
    ) {
      if (!userId || userId === "unknown") {
        return NextResponse.json({ received: true });
      }

      await supabaseAdmin
        .from("profiles")
        .update({ plan: "pro", subscription_status: "active" })
        .eq("id", userId);

      const { data: latestContract } = await supabaseAdmin
        .from("subscription_contracts")
        .select("id, contract_length_months")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestContract) {
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + (latestContract.contract_length_months ?? 1));
        await supabaseAdmin
          .from("subscription_contracts")
          .update({
            status: "active",
            end_date: endDate.toISOString().split("T")[0],
          })
          .eq("id", latestContract.id);
      } else {
        await supabaseAdmin.from("subscription_contracts").insert({
          user_id: userId,
          plan_name: "Professional",
          plan_type: "professional",
          contract_length_months: 1,
          price_per_month: 11900,
          total_price: 11900,
          status: "active",
          start_date: new Date().toISOString().split("T")[0],
          end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          payment_method: "Credit Card",
          auto_renew: true,
          renewal_reminder_days: 30,
          discount_percent: 0,
        });
      }

      await safe(logAudit, {
        userId,
        action: "subscription_upgraded",
        resource: "square",
        metadata: { eventType, eventId, payment_id: payment?.id },
      });
      await safe(logBillingAudit, {
        userId,
        action: "subscription_upgraded",
        resource: "square",
        metadata: { eventType, eventId, payment_id: payment?.id },
        ip,
      });

      return NextResponse.json({ received: true });
    }

// LOCATION ADD-ON PAYMENT
    if (payment?.metadata?.paymentType === "location_addon") {
      const locationPaymentId = payment.metadata.locationPaymentId;

      if (locationPaymentId) {
        const { data: pending } = await supabaseAdmin
          .from("pending_location_payments")
          .select("*")
          .eq("id", locationPaymentId)
          .maybeSingle();

        if (pending && pending.status === "pending") {
          const { data: newLocation } = await supabaseAdmin
            .from("locations")
            .insert({
              company_id: pending.company_id,
              name: pending.location_name,
              address: pending.address,
              city: pending.city,
              state: pending.state,
              zip: pending.zip,
              phone: pending.phone,
              lat: pending.lat,
              lng: pending.lng,
              radius: pending.radius ?? 300,
              is_active: true,
              payment_status: "active",
              subscription_id: payment?.id ?? null,
              created_by: pending.user_id,
            })
            .select()
            .single();

          await supabaseAdmin
            .from("pending_location_payments")
            .update({ status: "completed" })
            .eq("id", locationPaymentId);

          await safe(logBillingAudit, {
            userId: pending.user_id,
            action: "location_addon_activated",
            resource: "square",
            metadata: { eventId, eventType, payment_id: payment?.id, locationId: newLocation?.id },
            ip,
          });

          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://aba-ai-assistant.com";
          await safe(fetch, `${siteUrl}/api/email/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: pending.admin_email,
              subject: "New Location Activated",
              body: `
                <h2>New Location Activated</h2>
                <p><strong>Location:</strong> ${pending.location_name}</p>
                <p><strong>Company:</strong> ${pending.company_name}</p>
                <p><strong>Billing:</strong> ${pending.billing_type === "addon" ? "Added to existing subscription" : "Separate Square payment"} â€” $49/mo</p>
                <p>This location is now active and ready to use.</p>
              `,
            }),
          });
        }
      }

      return NextResponse.json({ received: true });
    }

    // PAYMENT FAILED
    if (eventType === "payment.failed") {
      if (userId && userId !== "unknown") {
        await supabaseAdmin
          .from("profiles")
          .update({ subscription_status: "past_due" })
          .eq("id", userId);
        await safe(logAudit, {
          userId,
          action: "payment_failed",
          resource: "square",
          metadata: { eventId, payment_id: payment?.id },
        });
        await safe(logBillingAudit, {
          userId,
          action: "payment_failed",
          resource: "square",
          metadata: { eventId, payment_id: payment?.id },
          ip,
        });
      }
      return NextResponse.json({ received: true });
    }

    // CANCELLATION / GRACE
    if (
      eventType === "subscription.canceled" ||
      eventType === "payment.declined"
    ) {
      if (userId && userId !== "unknown") {
        await supabaseAdmin
          .from("profiles")
          .update({ subscription_status: "grace_period" })
          .eq("id", userId);
        await safe(logAudit, {
          userId,
          action: "subscription_grace_period",
          resource: "square",
          metadata: { eventId, eventType },
        });
        await safe(logBillingAudit, {
          userId,
          action: "subscription_grace_period",
          resource: "square",
          metadata: { eventId, eventType },
          ip,
        });
      }
      return NextResponse.json({ received: true });
    }

    // UNRECOGNIZED EVENT
    await safe(logAudit, {
      userId,
      action: "webhook_unrecognized_event",
      resource: "square",
      metadata: { eventId, eventType },
    });

    return NextResponse.json({ received: true });

  } catch (err) {
    await safe(logAudit, {
      userId,
      action: "webhook_error",
      resource: "square",
      metadata: { message: err instanceof Error ? err.message : "Unknown error" },
    });
    await safe(logBillingAudit, {
      userId,
      action: "webhook_error",
      resource: "square",
      metadata: { message: err instanceof Error ? err.message : "Unknown error" },
    });
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
