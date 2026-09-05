import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { advanceTarget } from "@/lib/mastery/advanceTarget";

async function isAuthorizedForClient(userId: string, companyId: string, clientId: string) {
  const { data: membership } = await supabaseAdmin
    .from("company_users")
    .select("role, status")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) return false;
  if (membership.role === "admin" || membership.role === "supervisor") return true;
  if (membership.role === "clinician") {
    const { data: assignment } = await supabaseAdmin
      .from("client_assignments")
      .select("id")
      .eq("client_id", clientId)
      .eq("user_id", userId)
      .maybeSingle();
    return !!assignment;
  }
  return false;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: targetId } = await params;

    const { data: target } = await supabaseAdmin
      .from("skill_targets")
      .select("company_id, client_id, pending_advancement, advancement_mode")
      .eq("id", targetId)
      .single();

    if (!target) return NextResponse.json({ error: "Target not found" }, { status: 404 });

    const authorized = await isAuthorizedForClient(user.id, target.company_id, target.client_id);
    if (!authorized) {
      return NextResponse.json(
        { error: "Only an admin, supervisor, or the assigned clinician for this client can approve advancement." },
        { status: 403 }
      );
    }

    if (!target.pending_advancement || target.advancement_mode !== "flag_for_review") {
      return NextResponse.json({ error: "This target has no pending advancement to approve." }, { status: 400 });
    }

    const result = await advanceTarget(supabaseAdmin, targetId, user.id, "auto_advanced");
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error("approve-advancement error:", err);
    return NextResponse.json({ error: "Failed to approve advancement" }, { status: 500 });
  }
}
