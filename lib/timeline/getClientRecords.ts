import { supabase } from "@/lib/supabase/client";

export type TimelineItem = {
  id: string;
  type: "session" | "behavior" | "program";
  title: string;
  created_at: string;
};

export async function getClientRecords(clientId: string): Promise<TimelineItem[]> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) return [];

  const [sessionsRes, behaviorsRes, programsRes] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, client_name, created_at")
      .eq("created_by", user.id)
      .eq("client_id", clientId),

    supabase
      .from("behaviors")
      .select("id, behavior_name, created_at")
      .eq("created_by", user.id)
      .eq("client_id", clientId),

    supabase
      .from("programs")
      .select("id, program_name, created_at")
      .eq("created_by", user.id)
      .eq("client_id", clientId),
  ]);

  const sessions =
    sessionsRes.data?.map((s) => ({
      id: s.id,
      type: "session" as const,
      title: s.client_name || "Session",
      created_at: s.created_at,
    })) || [];

  const behaviors =
    behaviorsRes.data?.map((b) => ({
      id: b.id,
      type: "behavior" as const,
      title: b.behavior_name || "Behavior",
      created_at: b.created_at,
    })) || [];

  const programs =
    programsRes.data?.map((p) => ({
      id: p.id,
      type: "program" as const,
      title: p.program_name || "Program",
      created_at: p.created_at,
    })) || [];

  return [...sessions, ...behaviors, ...programs].sort(
    (a, b) =>
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime()
  );
}