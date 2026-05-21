import { supabase } from "@/lib/supabase/client";

export async function saveClinicalReport({
  clientId,
  reportDate,
  reportText,
  summaryText,
}: {
  clientId: string;
  reportDate: string;
  reportText: string;
  summaryText?: string;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) return;

  const { data, error } = await supabase
    .from("clinical_reports")
    .insert([
      {
        client_id: clientId,
        created_by: user.id,
        report_date: reportDate,
        report_text: reportText,
        summary_text: summaryText || null,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Save report error:", error.message);
    return null;
  }

  return data;
}