import { supabase } from "@/lib/supabase/client";

/**
 * =========================
 * CORE TYPES
 * =========================
 */

export type TimelineType = "session" | "behavior" | "program";

export type TimelineItem = {
  id: string;
  type: TimelineType;
  title: string;
  created_at: string;
};

export type GroupedTimeline = {
  date: string;
  items: TimelineItem[];
};

/**
 * =========================
 * FLAT TIMELINE FETCHER
 * (single source of truth)
 * =========================
 */

export async function getClientTimelineFlat(
  clientId: string
): Promise<TimelineItem[]> {
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

  const sessions: TimelineItem[] =
    sessionsRes.data?.map((s) => ({
      id: s.id,
      type: "session",
      title: s.client_name ?? "Session",
      created_at: s.created_at,
    })) ?? [];

  const behaviors: TimelineItem[] =
    behaviorsRes.data?.map((b) => ({
      id: b.id,
      type: "behavior",
      title: b.behavior_name ?? "Behavior",
      created_at: b.created_at,
    })) ?? [];

  const programs: TimelineItem[] =
    programsRes.data?.map((p) => ({
      id: p.id,
      type: "program",
      title: p.program_name ?? "Program",
      created_at: p.created_at,
    })) ?? [];

  return [...sessions, ...behaviors, ...programs].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * =========================
 * GROUPING FUNCTION
 * (for UI + reports)
 * =========================
 */

export function groupTimelineByDate(
  items: TimelineItem[]
): GroupedTimeline[] {
  const grouped: Record<string, TimelineItem[]> = {};

  for (const item of items) {
    const dateKey = new Date(item.created_at).toDateString();

    if (!grouped[dateKey]) grouped[dateKey] = [];

    grouped[dateKey].push(item);
  }

  return Object.entries(grouped).map(([date, items]) => ({
    date,
    items,
  }));
}

/**
 * =========================
 * MAIN EXPORT (UI READY)
 * =========================
 */

export async function getClientTimeline(
  clientId: string
): Promise<GroupedTimeline[]> {
  const flat = await getClientTimelineFlat(clientId);
  return groupTimelineByDate(flat);
}