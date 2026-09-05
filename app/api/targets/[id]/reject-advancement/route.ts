import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: targetId } = await params;
    const { notes } = await req.json().catch(() => ({ notes: null }));

    const { data: target } = await supabaseAdmin
      .from("skill_targets")
      .select("company_id, client_id, pending_advancement, current_prompt_level, status")
      .eq("id", targetId)
      .single();

    if (!target) return NextResponse.json({ error: "Target not found" }, { status: 404 });

    const { data: membership } = await supabaseAdmin
      .from("company_users")
      .select("role, status")
      .eq("user_id", user.id)
      .eq("company_id", target.company_id)
      .eq("status", "active")
      .maybeSingle();

    if (!membership || !["admin", "bcba"].includes(membership.role)) {
      return NextResponse.json({ error: "Only an admin or BCBA can reject advancement." }, { status: 403 });
    }

    if (!target.pending_advancement) {
      return NextResponse.json({ error: "This target has no pending advancement to reject." }, { status: 400 });
    }

    await supabaseAdmin
      .from("skill_targets")
      .update({ pending_advancement: false })
      .eq("id", targetId);

    await supabaseAdmin.from("mastery_advancement_log").insert({
      target_id: targetId,
      company_id: target.company_id,
      client_id: target.client_id,
      criteria_met: true,
      action_taken: "rejected",
      previous_status: target.current_prompt_level ?? target.status,
      new_status: target.current_prompt_level ?? target.status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      notes: notes ?? null,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("reject-advancement error:", err);
    return NextResponse.json({ error: "Failed to reject advancement" }, { status: 500 });
  }
}