import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  const { data, error } = await supabase
    .from("clinical_reports")
    .insert([{
      client_id: clientId,
      report_date: reportDate,
      report_text: reportText,
      summary_text: summaryText || null,
    }])
    .select()
    .single();

  if (error) {
    console.error("Save report error:", error.message);
    return null;
  }

  return data;
}