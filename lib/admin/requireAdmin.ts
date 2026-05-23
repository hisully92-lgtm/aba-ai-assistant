import { supabaseAdmin } from "@/lib/supabase/server";

export async function requireAdmin(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role !== "admin") {
    throw new Error("Unauthorized");
  }
}