import { supabaseAdmin } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

export type Client = {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  guardian_name: string | null;
  created_at: string;
  created_by: string;
};

export async function getClientById(clientId: string): Promise<Client> {
  const { data, error } = await supabaseAdmin
    .from("clients")
    .select("id, full_name, date_of_birth, guardian_name, created_at, created_by")
    .eq("id", clientId)
    .single();

  if (error || !data) {
    throw new AppError("NOT_FOUND", `Client not found: ${clientId}`, { status: 404 });
  }

  return data;
}

export async function getClientsByUser(userId: string): Promise<Client[]> {
  const { data, error } = await supabaseAdmin
    .from("clients")
    .select("id, full_name, date_of_birth, guardian_name, created_at, created_by")
    .eq("created_by", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AppError("DB_ERROR", error.message);
  }

  return data ?? [];
}

export async function getClientCount(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("created_by", userId);

  if (error) throw new AppError("DB_ERROR", error.message);
  return count ?? 0;
}