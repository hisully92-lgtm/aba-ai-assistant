import { supabaseAdmin } from "@/lib/supabase/server";

export type DateRange = {
  from: string;
  to: string;
};

export type ComplianceExportType = "access" | "ai_usage" | "billing" | "system";

export async function fetchLogsForExport(
  type: ComplianceExportType,
  range: DateRange
) {
  const { from, to } = range;

  if (type === "access") {
    const { data, error } = await supabaseAdmin
      .from("access_logs")
      .select("id, user_id, resource, action, record_id, ip, created_at")
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  if (type === "ai_usage") {
    const { data, error } = await supabaseAdmin
      .from("ai_usage_logs")
      .select("id, user_id, feature, duration_ms, success, error, created_at")
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  if (type === "billing") {
    const { data, error } = await supabaseAdmin
      .from("billing_audit_logs")
      .select("id, user_id, event, action, resource, ip, provider, created_at")
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  if (type === "system") {
    const { data, error } = await supabaseAdmin
      .from("system_logs")
      .select("id, user_id, type, event, created_at")
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  return [];
}

export function convertToCSV(data: Record<string, any>[]): string {
  if (data.length === 0) return "";

  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers
      .map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return "";
        if (typeof val === "object") return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        const str = String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      })
      .join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}