"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import AppShell from "@/components/app/AppShell";

type SessionRow = {
  id: string;
  client_name: string;
  status: string;
  scheduled_start: string | null;
  my_joined_at: string | null;
  actual_end: string | null;
  participants: { name: string; role: string }[];
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", bcba: "BCBA", rbt: "RBT", guardian: "Guardian",
  clinician: "Clinician", supervisor: "Supervisor", staff: "Staff", system: "System",
};

export default function TelehealthHistoryAppPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: joinedRows } = await supabase
      .from("telehealth_session_audit_log")
      .select("video_session_id")
      .eq("actor_id", user.id)
      .eq("event", "joined");

    const joinedIds = Array.from(new Set((joinedRows ?? []).map((r: { video_session_id: string }) => r.video_session_id)));

    const { data: createdSessions } = await supabase
      .from("telehealth_video_sessions")
      .select("id")
      .eq("staff_id", user.id);

    const allIds = Array.from(new Set([...joinedIds, ...((createdSessions ?? []).map((s: { id: string }) => s.id))]));

    if (allIds.length === 0) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const { data: sessionData } = await supabase
      .from("telehealth_video_sessions")
      .select("id, status, scheduled_start, actual_end, clients(full_name)")
      .in("id", allIds)
      .order("scheduled_start", { ascending: false });

    const { data: auditData } = await supabase
      .from("telehealth_session_audit_log")
      .select("video_session_id, actor_name, actor_type, actor_id, event, created_at")
      .in("video_session_id", allIds)
      .eq("event", "joined")
      .order("created_at", { ascending: true });

    const participantsBySession = new Map<string, { name: string; role: string }[]>();
    const myJoinedAtBySession = new Map<string, string>();
    (auditData ?? []).forEach((row: any) => {
      const list = participantsBySession.get(row.video_session_id) ?? [];
      list.push({ name: row.actor_name ?? "Unknown", role: row.actor_type ?? "" });
      participantsBySession.set(row.video_session_id, list);
      if (row.actor_id === user.id && !myJoinedAtBySession.has(row.video_session_id)) {
        myJoinedAtBySession.set(row.video_session_id, row.created_at);
      }
    });

    const rows: SessionRow[] = (sessionData ?? []).map((s: any) => ({
      id: s.id,
      client_name: s.clients?.full_name ?? "Unknown client",
      status: s.status,
      scheduled_start: s.scheduled_start,
      my_joined_at: myJoinedAtBySession.get(s.id) ?? null,
      actual_end: s.actual_end,
      participants: participantsBySession.get(s.id) ?? [],
    }));

    setSessions(rows);
    setLoading(false);
  }

  function formatDuration(start: string | null, end: string | null): string {
    if (!start || !end) return "—";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms <= 0) return "—";
    const mins = Math.round(ms / 60000);
    const h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  function formatTime(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  return (
    <AppShell title="Session History">
      <div className="px-5 py-5 space-y-4">
        <p className="text-sm" style={{ color: "#94a3b8" }}>A log of the telehealth sessions you've been part of.</p>

        {loading && <p className="text-sm" style={{ color: "#64748b" }}>Loading...</p>}
        {!loading && sessions.length === 0 && (
          <div className="text-center py-12 text-sm" style={{ color: "#64748b" }}>No telehealth sessions yet.</div>
        )}

        <div className="space-y-3">
          {sessions.map((s) => (
            <div key={s.id} className="rounded-xl p-4" style={{ backgroundColor: "#1a2234", border: "1px solid #2a3a54" }}>
              <div className="flex justify-between items-start gap-2 mb-1">
                <p className="font-semibold text-white text-sm">{s.client_name}</p>
                <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: "#2a3a54", color: "#cbd5e1" }}>
                  {s.status.replace("_", " ")}
                </span>
              </div>
              <p className="text-xs" style={{ color: "#64748b" }}>
                {s.scheduled_start ? new Date(s.scheduled_start).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "Date unknown"}
                {" · You: "}
                {formatTime(s.my_joined_at)} – {formatTime(s.actual_end)}
                {" · "}
                {formatDuration(s.my_joined_at, s.actual_end)}
              </p>
              {s.participants.filter((p) => p.name).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 pt-2" style={{ borderTop: "1px solid #2a3a54" }}>
                  {s.participants.filter((p) => p.name).map((p, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: "#2a3a54", color: "#cbd5e1" }}>
                      {p.name}{p.role ? ` · ${ROLE_LABELS[p.role] ?? p.role}` : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}


