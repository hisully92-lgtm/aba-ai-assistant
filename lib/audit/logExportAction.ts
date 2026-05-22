import { supabase } from "@/lib/supabase/client";

export async function logExportAction(params: {
  exportId: string;
  action: "created" | "approved" | "rejected" | "downloaded";
  userId: string;
}) {
  const { error } = await supabase.from("export_audit_logs").insert([
    {
      export_id: params.exportId,
      action: params.action,
      user_id: params.userId,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    console.error("Audit log error:", error.message);
  }
}