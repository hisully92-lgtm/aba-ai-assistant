import { supabase } from "@/lib/supabase/client";

export async function isAdmin() {
  const { data } = await supabase.auth.getUser();

  const email = data.user?.email;
  if (!email) return false;

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("email", email)
    .single();

  return profile?.role === "admin";
}