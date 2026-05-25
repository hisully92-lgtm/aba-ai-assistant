import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getCompanyContext() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, companyId: null, role: null };

  const { data: companyUser } = await supabase
    .from("company_users")
    .select("company_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  return {
    supabase,
    user,
    companyId: companyUser?.company_id ?? null,
    role: companyUser?.role ?? null,
  };
}