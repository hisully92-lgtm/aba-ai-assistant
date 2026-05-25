import { supabase } from "@/lib/supabase/client";

export type TrendPoint = {
  week: string;
  score: number;
};

export type RiskTrendPoint = {
  date: string;
  score: number;
};

export type TherapistLoad = {
  therapist: string;
  clients: number;
  riskBreakdown: {
    low: number;
    medium: number;
    high: number;
  };
};

export async function fetchClientTrendData(): Promise<TrendPoint[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("created_at")
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  const weekMap = new Map<string, number>();

  data.forEach((s: { created_at: string }) => {
    const date = new Date(s.created_at);
    const weekNum = getISOWeek(date);
    const label = `Week ${weekNum}`;
    weekMap.set(label, (weekMap.get(label) ?? 0) + 1);
  });

  return Array.from(weekMap.entries())
    .slice(-5)
    .map(([week, score]) => ({ week, score }));
}

export async function fetchRiskTrendData(): Promise<RiskTrendPoint[]> {
  const { data, error } = await supabase
    .from("client_risk")
    .select("risk_score, updated_at")
    .order("updated_at", { ascending: true });

  if (error || !data) return [];

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayMap = new Map<string, number[]>();

  data.forEach((r: { risk_score: number | null; updated_at: string }) => {
    if (r.risk_score == null) return;
    const day = days[new Date(r.updated_at).getDay()];
    if (!dayMap.has(day)) dayMap.set(day, []);
    dayMap.get(day)!.push(r.risk_score);
  });

  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    .filter((d) => dayMap.has(d))
    .map((d) => {
      const scores = dayMap.get(d)!;
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      return { date: d, score: avg };
    });
}

export async function fetchWorkloadData(): Promise<TherapistLoad[]> {
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("staff_member, client_id")
    .not("staff_member", "is", null);

  if (error || !sessions) return [];

  const { data: riskData } = await supabase
    .from("client_risk")
    .select("client_id, risk_level");

  const riskMap = new Map<string, string>();
  (riskData ?? []).forEach((r: { client_id: string; risk_level: string }) => {
    riskMap.set(r.client_id, r.risk_level);
  });

  const therapistMap = new Map<string, {
    clientIds: Set<string>;
    low: number;
    medium: number;
    high: number;
  }>();

  sessions.forEach((s: { staff_member: string; client_id: string }) => {
    if (!s.staff_member) return;

    if (!therapistMap.has(s.staff_member)) {
      therapistMap.set(s.staff_member, {
        clientIds: new Set(),
        low: 0,
        medium: 0,
        high: 0,
      });
    }

    const entry = therapistMap.get(s.staff_member)!;

    if (!entry.clientIds.has(s.client_id)) {
      entry.clientIds.add(s.client_id);

      const risk = riskMap.get(s.client_id) ?? "low";
      if (risk === "high") entry.high++;
      else if (risk === "medium") entry.medium++;
      else entry.low++;
    }
  });

  return Array.from(therapistMap.entries()).map(([therapist, entry]) => ({
    therapist,
    clients: entry.clientIds.size,
    riskBreakdown: {
      low: entry.low,
      medium: entry.medium,
      high: entry.high,
    },
  }));
}

// ISO week number helper
function getISOWeek(date: Date): number {
  const tmp = new Date(date.getTime());
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((tmp.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  );
}