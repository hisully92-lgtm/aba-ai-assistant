import { supabase } from "@/lib/supabase/client";

export async function rejectExport(
  exportId: string
) {
  const { error } = await supabase
    .from("client_exports")
    .update({
      status: "rejected",
    })
    .eq("id", exportId);

  if (error) {
    throw error;
  }
}