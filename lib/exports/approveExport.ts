import { supabase } from "@/lib/supabase/client";

export async function approveExport(
  exportId: string,
  approvedBy: string
) {
  const { error } = await supabase
    .from("client_exports")
    .update({
      status: "approved",
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    })
    .eq("id", exportId);

  if (error) {
    throw error;
  }
}