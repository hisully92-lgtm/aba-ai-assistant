import { supabaseAdmin } from "@/lib/supabase/server";

export async function logEvent(event: {
  userId?: string;
  type: "ai" | "billing" | "webhook" | "error";
  event: string;
  metadata?: any;
}) {
  try {
    await supabaseAdmin.from("system_logs").insert({
      user_id: event.userId || null,
      type: event.type,
      event: event.event,
      metadata: event.metadata || {},
    });
  } catch (err) {
    console.error("Logging failed:", err);
  }
}