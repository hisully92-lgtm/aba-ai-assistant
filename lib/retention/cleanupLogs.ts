import { supabaseAdmin } from "@/lib/supabase/server";
import { logEvent } from "@/lib/observability/logEvent";

export type RetentionPolicy = {
  table: string;
  retainDays: number;
};

export const RETENTION_POLICIES: RetentionPolicy[] = [
  { table: "system_logs", retainDays: 90 },
  { table: "access_logs", retainDays: 365 },
  { table: "ai_usage_logs", retainDays: 90 },
  { table: "billing_audit_logs", retainDays: 730 },
  { table: "usage_logs", retainDays: 90 },
];

export async function runRetentionCleanup(): Promise<{
  deleted: Record<string, number>;
  errors: Record<string, string>;
}> {
  const deleted: Record<string, number> = {};
  const errors: Record<string, string> = {};

  for (const policy of RETENTION_POLICIES) {
    const cutoff = new Date(
      Date.now() - policy.retainDays * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data, error } = await supabaseAdmin
      .from(policy.table)
      .delete()
      .lt("created_at", cutoff)
      .select("id");

    if (error) {
      errors[policy.table] = error.message;
    } else {
      deleted[policy.table] = data?.length ?? 0;
    }
  }

  await logEvent({
    userId: "system",
    type: "queue",
    event: "retention_cleanup_complete",
    metadata: { deleted, errors },
  });

  return { deleted, errors };
}