import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  console.log("FULL URL:", req.url);
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  console.log("AUTH CONFIRM HIT:", { code, token_hash, type });

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
    const { error } = await supabase.auth.verifyOtp({ 
      token_hash, 
      type: type as any 
    });
    console.log("OTP VERIFY RESULT:", { error });
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${error.message}`, req.url));
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    console.log("CODE EXCHANGE RESULT:", { error });
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${error.message}`, req.url));
    }
  } else {
    console.log("NO CODE OR TOKEN HASH - checking existing session");
  }

  const { data: { user } } = await supabase.auth.getUser();
  console.log("USER AFTER AUTH:", { userId: user?.id });

  if (!user) {
    // Session not readable in same request — redirect to dashboard and let middleware handle it
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const { data: companyUser } = await supabase
    .from("company_users")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  console.log("COMPANY USER:", { companyUser });

  if (companyUser?.company_id) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.redirect(new URL("/onboarding", req.url));
}