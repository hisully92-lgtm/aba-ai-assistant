import { supabaseAdmin } from "@/lib/supabase/server";

type AuditInput = {
  userId: string;
  action: string;
  resource?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
};

export async function logAudit({
  userId,
  action,
  resource,
  metadata,
  ip,
  userAgent,
}: AuditInput) {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      user_id: userId,
      action,
      resource: resource || null,
      metadata: metadata || {},

      // optional observability fields (safe to add even if DB already exists)
      ip: ip || null,
      user_agent: userAgent || null,

      // keep for backward compatibility if your table still uses it
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // 🔒 Never block production flows because audit logging failed
    console.error("[audit_log_failed]", {
      action,
      userId,
      resource,
      error: err,
    });
  }
}