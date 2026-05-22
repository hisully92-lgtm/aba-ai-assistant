import { buildClientExport } from "@/lib/exports/buildClientExport";
import { generateClientPDF } from "@/lib/exports/generateClientPDF";
import { supabase } from "@/lib/supabase/client";
import { canUserExport } from "@/lib/billing/canUserExport";

export async function runExport(clientId: string) {
  const billing = await canUserExport();

  if (!billing.canExport) {
    throw new Error("EXPORT_BLOCKED: Upgrade required or limit reached");
  }

  const data = await buildClientExport(clientId);

  // PDF generation
  generateClientPDF(data);

  // 🔥 increment usage
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (user) {
    await supabase
      .from("profiles")
      .update({
        exports_used: billing.exportsUsed + 1,
      })
      .eq("id", user.id);
  }

  return data;
}