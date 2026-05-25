import { supabaseAdmin } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

export type Session = {
  id: string;
  client_id: string;
  created_by: string;
  start_time: string;
  end_time: string | null;
  status: string;
  notes: string | null;
  behaviors_observed: string | null;
  interventions_used: string | null;
  client_response: string | null;
  programs_targeted: string | null;
  staff_member: string | null;
  date: string | null;
  created_at: string;
};

export async function getSessionsByClient(
  clientId: string,
  limit = 20
): Promise<Session[]> {
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new AppError("DB_ERROR", error.message);
  return data ?? [];
}

export async function getSessionsByStaff(
  staffMember: string
): Promise<Pick<Session, "id" | "client_id" | "status" | "date" | "created_at">[]> {
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select("id, client_id, status, date, created_at")
    .eq("staff_member", staffMember)
    .order("created_at", { ascending: false });

  if (error) throw new AppError("DB_ERROR", error.message);
  return data ?? [];
}