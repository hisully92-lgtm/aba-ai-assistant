import { supabaseAdmin } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

export type ClientExport = {
  id: string;
  client_id: string;
  created_by: string;
  type: string;
  status: string;
  file_url: string | null;
  summary: any;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
};

export async function getExportsByClient(clientId: string): Promise<ClientExport[]> {
  const { data, error } = await supabaseAdmin
    .from("client_exports")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) throw new AppError("DB_ERROR", error.message);
  return data ?? [];
}

export async function getAllExports(): Promise<ClientExport[]> {
  const { data, error } = await supabaseAdmin
    .from("client_exports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new AppError("DB_ERROR", error.message);
  return data ?? [];
}

export async function getExportStats(): Promise<{
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  approvalRate: number;
}> {
  const { data, error } = await supabaseAdmin
    .from("client_exports")
    .select("id, status");

  if (error) throw new AppError("DB_ERROR", error.message);

  const total = data?.length ?? 0;
  const approved = data?.filter((e) => e.status === "approved").length ?? 0;
  const rejected = data?.filter((e) => e.status === "rejected").length ?? 0;
  const pending = data?.filter((e) => e.status === "pending").length ?? 0;
  const approvalRate = total ? Math.round((approved / total) * 100) : 0;

  return { total, approved, rejected, pending, approvalRate };
}