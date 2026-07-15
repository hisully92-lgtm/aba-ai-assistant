import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: pending } = await supabaseAdmin
      .from("pending_onboarding")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending_payment")
      .maybeSingle();

    if (!pending) {
      return NextResponse.json({ error: "No pending onboarding found" }, { status: 404 });
    }

    // Self-serve creation of a brand-new paid clinic is no longer supported here
    // (Apple App Store Guidelines 3.1.1 / 3.1.3(c) — enterprise services sold to
    // organizations must go through a real sales/review process, not automated
    // checkout). Joining an existing, already-provisioned clinic via clinic code
    // is not a purchase and remains unaffected below.
    if (!pending.join_existing) {
      return NextResponse.json(
        { error: "New clinic sign-up now goes through Request Access. Please visit /request-access to get started." },
        { status: 403 }
      );
    }

    await supabaseAdmin.from("profiles").upsert({
      id: user.id,
      full_name: pending.name,
      role: pending.role,
      updated_at: new Date().toISOString(),
    });

    let companyId = "";

    const { data: existingCompany } = await supabaseAdmin
      .from("companies")
      .select("id")
      .ilike("clinic_code", pending.clinic_code)
      .maybeSingle();

    if (!existingCompany) return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    companyId = existingCompany.id;

    await supabaseAdmin.from("company_users").upsert({
      company_id: companyId,
      user_id: user.id,
      role: pending.role,
      status: "active",
    });

    await supabaseAdmin.from("pending_onboarding")
      .update({ status: "complete" })
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      companyId,
    });

  } catch (err: any) {
    console.error("Onboarding complete error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
