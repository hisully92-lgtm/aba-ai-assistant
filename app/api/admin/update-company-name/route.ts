import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { companyId, name } = await req.json();
    if (!companyId || !name?.trim()) {
      return NextResponse.json({ error: "companyId and name are required" }, { status: 400 });
    }

    // Confirm the caller is an active admin of this specific company.
    const { data: membership } = await supabaseAdmin
      .from("company_users")
      .select("role, status")
      .eq("user_id", user.id)
      .eq("company_id", companyId)
      .eq("status", "active")
      .maybeSingle();

    if (!membership || membership.role !== "admin") {
      return NextResponse.json({ error: "Only an admin of this organization can rename it." }, { status: 403 });
    }

    const { data: company, error } = await supabaseAdmin
      .from("companies")
      .update({ name: name.trim() })
      .eq("id", companyId)
      .select()
      .single();

    if (error || !company) {
      return NextResponse.json({ error: error?.message ?? "Failed to update organization name" }, { status: 500 });
    }

    return NextResponse.json({ success: true, company });
  } catch (err: any) {
    console.error("update-company-name error:", err);
    return NextResponse.json({ error: "Failed to update organization name" }, { status: 500 });
  }
}
