import { supabaseAdmin } from "@/lib/supabase/server";

export async function requirePro(userId: string) {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("plan, subscription_status")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    throw new Error("Profile not found");
  }

  const isInactive =
    profile?.plan !== "pro" ||
    profile?.subscription_status === "canceled" ||
    profile?.subscription_status === "past_due";

  if (isInactive) {
    throw new Error("Subscription inactive");
  }

  return profile;
}