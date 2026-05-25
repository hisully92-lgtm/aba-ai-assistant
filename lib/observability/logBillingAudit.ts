import { supabaseAdmin } from "@/lib/supabase/server";

type BillingAuditInput = {
  userId: string;
  action: string;
  event?: string;
  resource?: string;
  provider?: "square" | "stripe";
  ip?: string;
  metadata?: Record<string, any>;
};

export async function logBillingAudit({
  userId,
  action,
  event,
  resource,
  provider = "square",
  ip,
  metadata,
}: BillingAuditInput) {
  try {
    await supabaseAdmin.from("billing_audit_logs").insert({
      user_id: userId,
      action,
      event: event || action,
      resource: resource || null,
      provider,
      ip: ip || null,
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Never block production flows because billing audit logging failed
    console.error("[billing_audit_log_failed]", {
      action,
      userId,
      resource,
      error: err,
    });
  }
}