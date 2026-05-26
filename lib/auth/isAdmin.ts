import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAILS = ["hisully92@gmail.com"];

export async function isAdmin() {
  const supabase = await createClient();

  // Get authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return false;
  }

  // Quick developer/admin email bypass
  if (ADMIN_EMAILS.includes(user.email ?? "")) {
    return true;
  }

  // Database role check
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return false;
  }

  return profile.role === "admin";
}