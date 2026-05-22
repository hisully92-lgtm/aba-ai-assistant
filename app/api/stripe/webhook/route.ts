import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const body = await req.text();

  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe signature" },
      { status: 400 }
    );
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 }
    );
  }

  // 💳 Stripe checkout success
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;

    const userId = session?.metadata?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId in metadata" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        plan: "pro",
        export_limit: 999,
      })
      .eq("id", userId);

    if (error) {
      console.error("Supabase update failed:", error);

      return NextResponse.json(
        { error: "DB update failed" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ received: true });
}