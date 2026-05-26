import { supabaseAdmin } from "@/lib/supabase/admin";

const ADMIN_EMAILS = ["hisully92@gmail.com"];

export async function isAdmin(userId: string) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(
    userId
  );

  if (error || !data?.user?.email) {
    return false;
  }

  return ADMIN_EMAILS.includes(data.user.email);
}