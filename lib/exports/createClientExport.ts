import { supabase } from "@/lib/supabase/client";
import { buildClientExport } from "@/lib/exports/buildClientExport";
import { logExportAction } from "@/lib/audit/logExportAction";

export async function createClientExport(clientId: string, userId: string) {
  // 1. Build export data
  const data = await buildClientExport(clientId);

  // 2. Save export record (this is what you were missing)
  const { data: exportRow, error } = await supabase
    .from("client_exports")
    .insert([
      {
        client_id: clientId,
        created_by: userId,
        status: "pending",
        created_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) throw error;

  // 3. Audit log (THIS is the snippet you asked about)
  await logExportAction({
    exportId: exportRow.id,
    action: "created",
    userId,
  });

  return {
    exportId: exportRow.id,
    data,
  };
}