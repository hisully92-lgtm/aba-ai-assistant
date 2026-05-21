import { supabase } from "@/lib/supabase/client";

export type ClientAnalytics = {
  sessionsPerDay: Record<string, number>;
  behaviorsPerDay: Record<string, number>;
  programsPerDay: Record<string, number>;
};

export async function getClientAnalytics(clientId: string) {
  const { data: sessions } = await supabase
    .from("sessions")
    .select("created_at")
    .eq("client_id", clientId);

  const { data: behaviors } = await supabase
    .from("behaviors")
    .select("created_at")
    .eq("client_id", clientId);

  const { data: programs } = await supabase
    .from("programs")
    .select("created_at")
    .eq("client_id", clientId);

  const groupByDay = (items: any[] = []) => {
    return items.reduce((acc: Record<string, number>, item) => {
      const day = new Date(item.created_at).toISOString().split("T")[0];
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {});
  };

  return {
    sessionsPerDay: groupByDay(sessions || []),
    behaviorsPerDay: groupByDay(behaviors || []),
    programsPerDay: groupByDay(programs || []),
  };
}