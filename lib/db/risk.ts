import { supabaseAdmin } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

export type ClientRisk = {
  id: string;
  client_id: string;
  risk_score: number | null;
  forecast_score: number | null;
  risk_level: "high" | "medium" | "low" | "unknown";
  computed_by: string;
  computed_at: string;
  updated_at: string;
};

export async function getRiskByClient(clientId: string): Promise<ClientRisk | null> {
  const { data, error } = await supabaseAdmin
    .from("client_risk")
    .select("*")
    .eq("client_id", clientId)
    .single();

  if (error) return null;
  return data;
}

export async function getAllRiskScores(): Promise<ClientRisk[]> {
  const { data, error } = await supabaseAdmin
    .from("client_risk")
    .select("*");

  if (error) throw new AppError("DB_ERROR", error.message);
  return data ?? [];
}

export async function upsertRisk(
  clientId: string,
  userId: string,
  scores: {
    risk_score: number;
    forecast_score: number;
    risk_level: "high" | "medium" | "low" | "unknown";
  }
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("client_risk")
    .upsert(
      {
        client_id: clientId,
        computed_by: userId,
        computed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...scores,
      },
      { onConflict: "client_id" }
    );

  if (error) throw new AppError("DB_ERROR", error.message);
}