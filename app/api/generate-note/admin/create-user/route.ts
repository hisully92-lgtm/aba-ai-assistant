import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    // ⚠️ Server-safe Supabase client (DO NOT use browser supabase here)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    // 🔐 Get user session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 🔐 Check role
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 📦 Request body
    const { email, full_name, role } = await req.json();

    // 👤 Invite auth user
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (authError || !authUser?.user) {
      return NextResponse.json(
        { error: authError?.message || "Failed to invite user" },
        { status: 400 }
      );
    }

    // 🧾 Create profile
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: authUser.user.id,
      email,
      full_name,
      role,
    });

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}