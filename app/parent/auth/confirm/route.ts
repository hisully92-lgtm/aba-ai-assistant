import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as any });
    if (error) return NextResponse.redirect(new URL(`/parent?error=${error.message}`, req.url));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL(`/parent?error=${error.message}`, req.url));
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/parent", req.url));

  // Check if user has parent role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "parent") {
    // Not a parent — redirect to main dashboard
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Link parent to client if linked_client_id was passed during signup
  const meta = user.user_metadata;
  if (meta?.linked_client_id) {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await admin.from("clients").update({ parent_user_id: user.id })
      .eq("id", meta.linked_client_id);

    // Also update profile role to parent
    await admin.from("profiles").update({ role: "parent" }).eq("id", user.id);
  }

  return NextResponse.redirect(new URL("/parent/dashboard", req.url));
}

