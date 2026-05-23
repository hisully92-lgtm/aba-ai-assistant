import { supabaseAdmin } from "@/lib/supabase/server";

type AuditLogInput = {
  userId: string;
  action: string;
  resource?: string;
  metadata?: Record<string, any>;
};

export async function logAudit({
  userId,
  action,
  resource,
  metadata,
}: AuditLogInput) {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      user_id: userId,
      action,
      resource: resource || null,
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // IMPORTANT: never block main flow if audit fails
    console.error("logAudit failed:", err);
  }
}