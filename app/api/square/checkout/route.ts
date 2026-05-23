import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logAudit } from "@/lib/observability/logAudit";

export async function POST(req: Request) {
  let user: any = null;

  try {
    // 🔐 AUTH
    const { data: auth } = await supabaseAdmin.auth.getUser();
    user = auth?.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { plan } = body;

    // 📊 AUDIT: checkout attempt (CORE BILLING EVENT)
    await logAudit({
      userId: user.id,
      action: "checkout_attempt",
      resource: "billing",
      metadata: {
        provider: "square",
        plan: plan || "unknown",
      },
    });

    // 💳 TODO: Replace with real Square checkout creation
    // Example placeholders (depends on your Square setup):
    const checkoutUrl = "https://squareup.com/checkout-demo";

    return NextResponse.json({
      url: checkoutUrl,
    });
  } catch (err: any) {
    // optional: you can also audit failures later
    return NextResponse.json(
      {
        error: "Checkout creation failed",
        message: err?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}