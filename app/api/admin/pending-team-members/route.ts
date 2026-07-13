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

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("clinic_code")
      .eq("id", companyUser.company_id)
      .single();

    if (!company?.clinic_code) {
      return NextResponse.json({ pending: [] });
    }

    const { data: pendingRows } = await supabaseAdmin
      .from("pending_onboarding")
      .select("id, user_id, name, role, created_at")
      .eq("join_existing", true)
      .ilike("clinic_code", company.clinic_code)
      .order("created_at", { ascending: false });

    if (!pendingRows || pendingRows.length === 0) {
      return NextResponse.json({ pending: [] });
    }

    // Exclude anyone already linked to this company
    const userIds = Array.from(new Set(pendingRows.map((r) => r.user_id)));
    const { data: existingLinks } = await supabaseAdmin
      .from("company_users")
      .select("user_id")
      .eq("company_id", companyUser.company_id)
      .in("user_id", userIds);

    const alreadyLinked = new Set((existingLinks ?? []).map((r) => r.user_id));
    const unlinkedRows = pendingRows.filter((r) => !alreadyLinked.has(r.user_id));

    // De-duplicate by user_id, keeping the most recent attempt
    const seen = new Set<string>();
    const deduped = unlinkedRows.filter((r) => {
      if (seen.has(r.user_id)) return false;
      seen.add(r.user_id);
      return true;
    });

    const pending = await Promise.all(
      deduped.map(async (row) => {
        let email = "Unknown";
        try {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
          email = authUser?.user?.email ?? "Unknown";
        } catch {
          // leave as Unknown if lookup fails
        }
        return {
          userId: row.user_id,
          name: row.name || "Unknown",
          email,
          requestedRole: row.role || "clinician",
          attemptedAt: row.created_at,
        };
      })
    );

    return NextResponse.json({ pending });
  } catch (error: any) {
    console.error("Pending team members error:", error);
    return NextResponse.json({ error: "Failed to load pending team members" }, { status: 500 });
  }
}
