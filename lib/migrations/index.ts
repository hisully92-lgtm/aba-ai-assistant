import { supabaseAdmin } from "@/lib/supabase/server";
import { logEvent } from "@/lib/observability/logEvent";

export type Migration = {
  id: string;
  name: string;
  up: () => Promise<void>;
};

// =========================
// MIGRATION REGISTRY
// =========================
// Add new migrations here in order. Never remove or reorder existing ones.

export const migrations: Migration[] = [
  {
    id: "001",
    name: "add_client_risk_table",
    up: async () => {
      await supabaseAdmin.rpc("exec_sql", {
        sql: `
          CREATE TABLE IF NOT EXISTS client_risk (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
            risk_score integer,
            forecast_score integer,
            risk_level text CHECK (risk_level IN ('high', 'medium', 'low', 'unknown')),
            computed_by uuid REFERENCES auth.users(id),
            computed_at timestamp with time zone DEFAULT now(),
            updated_at timestamp with time zone DEFAULT now()
          );
          CREATE UNIQUE INDEX IF NOT EXISTS client_risk_client_id_unique ON client_risk(client_id);
          CREATE INDEX IF NOT EXISTS idx_client_risk_client_id ON client_risk(client_id);
        `,
      });
    },
  },
  {
    id: "002",
    name: "add_retry_after_to_jobs",
    up: async () => {
      await supabaseAdmin.rpc("exec_sql", {
        sql: `
          ALTER TABLE jobs ADD COLUMN IF NOT EXISTS retry_after timestamp with time zone;
        `,
      });
    },
  },
  {
    id: "003",
    name: "add_report_text_to_clinical_reports",
    up: async () => {
      await supabaseAdmin.rpc("exec_sql", {
        sql: `
          ALTER TABLE clinical_reports ADD COLUMN IF NOT EXISTS report_text text;
        `,
      });
    },
  },
];

// =========================
// MIGRATION RUNNER
// =========================

export async function runMigrations(): Promise<{
  ran: string[];
  skipped: string[];
  failed: string[];
}> {
  // Ensure tracking table exists
  await supabaseAdmin.rpc("exec_sql", {
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id text PRIMARY KEY,
        name text NOT NULL,
        ran_at timestamp with time zone DEFAULT now()
      );
    `,
  });

  const { data: completed } = await supabaseAdmin
    .from("schema_migrations")
    .select("id");

  const completedIds = new Set((completed ?? []).map((m: { id: string }) => m.id));

  const ran: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const migration of migrations) {
    if (completedIds.has(migration.id)) {
      skipped.push(migration.id);
      continue;
    }

    try {
      await migration.up();

      await supabaseAdmin.from("schema_migrations").insert({
        id: migration.id,
        name: migration.name,
        ran_at: new Date().toISOString(),
      });

      await logEvent({
        userId: "system",
        type: "queue",
        event: "migration_ran",
        metadata: { id: migration.id, name: migration.name },
      });

      ran.push(migration.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "unknown";

      await logEvent({
        userId: "system",
        type: "error",
        event: "migration_failed",
        metadata: { id: migration.id, name: migration.name, error: message },
      });

      failed.push(migration.id);
    }
  }

  return { ran, skipped, failed };
}