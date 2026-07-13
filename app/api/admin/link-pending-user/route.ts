import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing authorization" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const { data: companyUser } = await supabaseAdmin
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!companyUser || companyUser.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, role } = body;

    if (!userId || !role) {
      return NextResponse.json({ error: "userId and role are required" }, { status: 400 });
    }

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("clinic_code")
      .eq("id", companyUser.company_id)
      .single();

    // Verify this person actually attempted to join THIS clinic — prevents an admin
    // from linking an arbitrary unrelated user by guessing/tampering with the ID.
    const { data: pendingMatch } = await supabaseAdmin
      .from("pending_onboarding")
      .select("id, name")
      .eq("user_id", userId)
      .eq("join_existing", true)
      .ilike("clinic_code", company?.clinic_code ?? "")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!pendingMatch) {
      return NextResponse.json({ error: "No matching signup attempt found for this clinic" }, { status: 403 });
    }

    const { error: linkError } = await supabaseAdmin.from("company_users").upsert(
      {
        company_id: companyUser.company_id,
        user_id: userId,
        role,
        status: "active",
      },
      { onConflict: "company_id,user_id" }
    );

    if (linkError) {
      console.error("Failed to link pending user:", linkError);
      return NextResponse.json({ error: "Failed to link user" }, { status: 500 });
    }

    if (pendingMatch.name) {
      await supabaseAdmin.from("profiles").upsert({
        id: userId,
        full_name: pendingMatch.name,
        role,
        updated_at: new Date().toISOString(),
      });
    }

    await supabaseAdmin
      .from("pending_onboarding")
      .update({ status: "complete" })
      .eq("id", pendingMatch.id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Link pending user error:", error);
    return NextResponse.json({ error: "Failed to link user" }, { status: 500 });
  }
}
