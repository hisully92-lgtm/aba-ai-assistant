import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";

export async function GET() {
  try {
    const { data: auth } = await supabaseAdmin.auth.getUser();
    const user = auth?.user;

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await requireAdmin(user.id);

    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id, email, plan, role, created_at");

    return NextResponse.json({ users: data });

  } catch (err) {
    return NextResponse.json(
      { error: "Admin access denied" },
      { status: 403 }
    );
  }
}