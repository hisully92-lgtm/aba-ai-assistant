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

    // LOCATION ADD-ON PAYMENT (first charge — matches by metadata OR order_id)
    // Must run BEFORE the generic PAYMENT SUCCESS block below, since both
    // listen for overlapping event types (payment.updated, invoice.payment_made, etc.)
    // and location payments must never fall through into the plan-renewal logic.
    let locationPaymentId: string | null =
      payment?.metadata?.paymentType === "location_addon"
        ? payment.metadata.locationPaymentId
        : null;

    if (!locationPaymentId && payment?.order_id) {
      const { data: byOrder } = await supabaseAdmin
        .from("pending_location_payments")
        .select("id")
        .eq("order_id", payment.order_id)
        .eq("status", "pending")
        .maybeSingle();
      if (byOrder) locationPaymentId = byOrder.id;
    }

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
            subscription_id: payment?.subscription_id ?? payment?.id ?? null,
            created_by: pending.user_id,
          })
          .select()
          .single();

        await supabaseAdmin
          .from("pending_location_payments")
          .update({
            status: "completed",
            square_subscription_id: payment?.subscription_id ?? null,
          })
          .eq("id", locationPaymentId);

        await safe(logBillingAudit, {
          userId: pending.user_id,
          action: "location_addon_activated",
          resource: "square",
          metadata: { eventId, eventType, payment_id: payment?.id, subscriptionId: payment?.subscription_id ?? null, locationId: newLocation?.id },
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
              <p><strong>Billing:</strong> ${pending.billing_type === "addon" ? "Added to existing subscription" : "Separate Square payment"} — $49/mo, billed monthly</p>
              <p>This location is now active and ready to use.</p>
            `,
          }),
        });
      }

      return NextResponse.json({ received: true });
    }

    // RECURRING SUBSCRIPTION CHARGE (month 2+ for location add-ons)
    // Also must run before PAYMENT SUCCESS, since it shares the invoice.payment_made event type.
    if (eventType === "invoice.payment_made") {
      const invoice = body?.data?.object?.invoice;
      const subId = invoice?.subscription_id;
      if (subId) {
        const { data: loc } = await supabaseAdmin
          .from("locations")
          .select("id, name, company_id")
          .eq("subscription_id", subId)
          .maybeSingle();

        if (loc) {
          await safe(logBillingAudit, {
            userId: "system",
            action: "location_recurring_charge",
            resource: "square",
            metadata: { eventId, eventType, subscriptionId: subId, locationId: loc.id, matched: true },
            ip,
          });
          return NextResponse.json({ received: true });
        }

        // Subscription ID didn't match any location — log for debugging, then
        // fall through to the generic handler below in case this was actually
        // a main-plan invoice rather than a location add-on.
        await safe(logBillingAudit, {
          userId: "system",
          action: "location_recurring_charge_unmatched",
          resource: "square",
          metadata: { eventId, eventType, subscriptionId: subId },
          ip,
        });
      }
    }

    // PAYMENT SUCCESS (main plan subscriptions)
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