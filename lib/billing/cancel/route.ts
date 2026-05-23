import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logBillingEvent } from "@/lib/billing/logBillingEvent";

export async function POST(req: Request) {
  try {
    const { data: auth } = await supabaseAdmin.auth.getUser();
    const user = auth?.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await supabaseAdmin
      .from("profiles")
      .update({
        subscription_status: "canceled",
      })
      .eq("id", user.id);

    await logBillingEvent({
      userId: user.id,
      event: "subscription_canceled",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Cancel failed" },
      { status: 500 }
    );
  }
}