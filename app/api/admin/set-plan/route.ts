import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { logBillingEvent } from "@/lib/billing/logBillingEvent";

export async function POST(req: Request) {
  try {
    const { data: auth } = await supabaseAdmin.auth.getUser();
    const admin = auth?.user;

    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireAdmin(admin.id);

    const { userId, plan } = await req.json();

    await (supabaseAdmin
      .from("profiles") as any)
      .update({ plan })
      .eq("id", userId);

    await logBillingEvent({
      userId,
      event: "admin_plan_override",
      metadata: {
        adminId: admin.id,
        plan,
      },
    });

    return NextResponse.json({ success: true });

  } catch (err) {
    return NextResponse.json({ error: "Admin override failed" }, { status: 500 });
  }
}