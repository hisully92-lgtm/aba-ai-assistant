import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROUTES = [
  "/login", "/signup", "/onboarding", "/auth/callback", "/auth/confirm", "/auth/loading",
  "/api/sms", "/api/square", "/api/checkout",
  "/privacy", "/hipaa", "/notice-of-privacy-practices", "/data-retention", "/security-policy",
];

const SESSION_TIMEOUT_MINUTES = 30;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) return NextResponse.next();

  if (
    pathname.startsWith("/_next") || pathname.startsWith("/favicon") ||
    pathname.startsWith("/login-banner") || pathname.includes(".")
  ) return NextResponse.next();

  const response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (user) {
    const lastActivity = request.cookies.get("last_activity")?.value;
    const now = Date.now();

    if (lastActivity) {
      const diff = (now - parseInt(lastActivity)) / 1000 / 60;
      if (diff > SESSION_TIMEOUT_MINUTES && pathname.startsWith("/dashboard")) {
        const redirectResponse = NextResponse.redirect(new URL("/login?reason=timeout", request.url));
        redirectResponse.cookies.delete("last_activity");
        await supabase.auth.signOut();
        return redirectResponse;
      }
    }

    response.cookies.set("last_activity", now.toString(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (companyUser) {
      response.headers.set("x-company-id", companyUser.company_id);
      response.headers.set("x-user-role", companyUser.role ?? "");
    }

    if (!companyUser && pathname.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};