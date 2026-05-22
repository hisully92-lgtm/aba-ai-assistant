import { supabase } from "@/lib/supabase/client";

export async function checkExportLimit(userId: string) {
  // Example: fetch subscription plan
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, exports_used, exports_limit")
    .eq("id", userId)
    .single();

  if (!profile) return { allowed: false };

  const allowed = profile.exports_used < profile.exports_limit;

  return {
    allowed,
    plan: profile.plan,
    remaining: profile.exports_limit - profile.exports_used,
  };
}