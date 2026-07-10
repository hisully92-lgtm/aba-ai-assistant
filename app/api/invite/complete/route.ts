import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();

  const { data: invite } = await supabaseAdmin
    .from("invite_tokens")
    .select("*")
    .eq("token", token)
    .eq("used", false)
    .single();

  if (!invite || new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "Invalid or expired invite" }, { status: 400 });
  }

  const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
    email: invite.contact_email,
    password,
    email_confirm: true,
  });

  if (error || !user) {
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }

  await supabaseAdmin.from("company_users").insert({
    user_id: user.user.id,
    company_id: invite.company_id,
    status: "active",
    role: "admin", // first user for a new clinic — adjust if you have a different default role
  });

  await supabaseAdmin
    .from("companies")
    .update({ status: "active" })
    .eq("id", invite.company_id);

  await supabaseAdmin
    .from("invite_tokens")
    .update({ used: true })
    .eq("token", token);

  return NextResponse.json({ success: true });
}