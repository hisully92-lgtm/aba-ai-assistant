import { supabaseAdmin } from "@/lib/supabase/server";

type AccessInput = {
  userId: string;
  resource: string;
  action: "read" | "write" | "delete" | "export";
  recordId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
};

export async function logAccess({
  userId,
  resource,
  action,
  recordId,
  ip,
  userAgent,
  metadata,
}: AccessInput) {
  try {
    await supabaseAdmin.from("access_logs").insert({
      user_id: userId,
      resource,
      action,
      record_id: recordId || null,
      ip: ip || null,
      user_agent: userAgent || null,
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Never block production flows because access logging failed
    console.error("[access_log_failed]", {
      userId,
      resource,
      action,
      error: err,
    });
  }
}