import { supabaseAdmin } from "@/lib/supabase/server";

export async function setPlanFromWebhookOnly(
  userId: string,
  plan: "free" | "pro",
  meta?: any
) {
  // 🚫 HARD GUARD: only webhook should call this
  if (process.env.NODE_ENV === "production" && meta?.source !== "square_webhook") {
  throw new Error("Blocked unsafe plan mutation");
}

  return supabaseAdmin
    .from("profiles")
    .update({
      plan,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}