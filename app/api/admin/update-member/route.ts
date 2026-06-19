import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const { memberId, companyId, role, status } = await req.json();

    if (!memberId || !companyId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (role) {
      await supabaseAdmin.from("profiles").update({ role }).eq("id", memberId);
      await supabaseAdmin.from("company_users").update({ role })
        .eq("user_id", memberId)
        .eq("company_id", companyId);
    }

    if (status) {
      await supabaseAdmin.from("profiles").update({ status }).eq("id", memberId);
      await supabaseAdmin.from("company_users").update({ status })
        .eq("user_id", memberId)
        .eq("company_id", companyId);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
