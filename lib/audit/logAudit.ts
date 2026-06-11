import { supabaseAdmin } from "@/lib/supabase/server";

export async function logAudit(event: {
  userId: string;
  action: string;
  resource?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      user_id: event.userId,
      action: event.action,
      resource: event.resource || null,
      metadata: event.metadata || {},
      created_at: new Date().toISOString(),
    } as any);
  } catch (error) {
    console.error("Audit log failed:", error);
  }
}