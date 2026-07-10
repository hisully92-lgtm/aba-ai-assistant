import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const YOUR_COMPANY_ID = "fcb8cbb2-4136-4d02-ba09-5355cc888189";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: cu } = await supabaseAdmin
    .from("company_users")
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", YOUR_COMPANY_ID)
    .maybeSingle();

  if (!cu || !["admin", "director", "clinical_director"].includes(cu.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const { error: otpError } = await supabaseAnon.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: process.env.NEXT_PUBLIC_SITE_URL + "/onboarding",
      shouldCreateUser: true,
    },
  });

  if (otpError) {
    console.error("Send invite error:", otpError);
    return NextResponse.json({ error: otpError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
