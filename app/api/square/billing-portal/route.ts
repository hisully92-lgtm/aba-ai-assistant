import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logAudit } from "@/lib/observability/logAudit";

export async function POST() {
  const { data: auth } = await supabaseAdmin.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 📊 AUDIT: user opened billing management
  await logAudit({
    userId: user.id,
    action: "billing_portal_opened",
    resource: "billing",
    metadata: {
      provider: "square",
    },
  });

  // 👉 Square does not provide a Stripe-style billing portal
  // So this acts as a redirect hub for billing management

  return NextResponse.json({
    url: "https://squareup.com/dashboard",
  });
}