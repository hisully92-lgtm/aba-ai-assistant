import { supabaseAdmin } from "@/lib/supabase/server";

type LogEventInput = {
  type: string;
  event: string;
  metadata?: Record<string, any>;
  userId?: string;
};

export async function logEvent({
  type,
  event,
  metadata,
  userId,
}: LogEventInput) {
  try {
    await supabaseAdmin.from("system_logs").insert({
      type,
      event,
      metadata: metadata || {},
      user_id: userId || null,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // IMPORTANT: never throw from logging layer
    console.error("logEvent failed:", err);
  }
}