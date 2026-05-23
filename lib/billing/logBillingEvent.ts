import { supabaseAdmin } from "@/lib/supabase/server";

export async function logBillingEvent({
  userId,
  event,
  metadata,
}: {
  userId: string;
  event: string;
  metadata?: any;
}) {
  return supabaseAdmin.from("billing_audit_logs").insert({
    user_id: userId,
    event,
    metadata,
    created_at: new Date().toISOString(),
  });
}