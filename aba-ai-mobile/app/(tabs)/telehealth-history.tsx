import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { supabase } from "../../lib/supabase";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", bcba: "BCBA", rbt: "RBT", guardian: "Guardian",
  clinician: "Clinician", supervisor: "Supervisor", staff: "Staff", system: "System",
};

type SessionRow = {
  id: string;
  client_name: string;
  status: string;
  scheduled_start: string | null;
  my_joined_at: string | null;
  actual_end: string | null;
  participants: { name: string; role: string }[];
};

export default function TelehealthHistoryScreen() {
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

    const joinedIds = Array.from(new Set((joinedRows ?? []).map((r) => r.video_session_id)));

    const { data: createdSessions } = await supabase
      .from("telehealth_video_sessions")
      .select("id")
      .eq("staff_id", user.id);

    const allIds = Array.from(new Set([...joinedIds, ...((createdSessions ?? []).map((s) => s.id))]));

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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Session History</Text>
      <Text style={styles.subtitle}>A log of the telehealth sessions you've been part of.</Text>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={<Text style={styles.empty}>No telehealth sessions yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.clientName}>{item.client_name}</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{item.status.replace("_", " ")}</Text>
              </View>
            </View>
            <Text style={styles.meta}>
              {item.scheduled_start
                ? new Date(item.scheduled_start).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
                : "Date unknown"}
              {" · You: "}
              {formatTime(item.my_joined_at)} – {formatTime(item.actual_end)}
              {" · "}
              {formatDuration(item.my_joined_at, item.actual_end)}
            </Text>
            {item.participants.filter((p) => p.name).length > 0 && (
              <View style={styles.participantsRow}>
                {item.participants.filter((p) => p.name).map((p, i) => (
                  <View key={i} style={styles.chip}>
                    <Text style={styles.chipText}>
                      {p.name}{p.role ? ` · ${ROLE_LABELS[p.role] ?? p.role}` : ""}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 13, color: "#6b7280", marginTop: 2, marginBottom: 16 },
  empty: { textAlign: "center", color: "#9ca3af", fontSize: 13, marginTop: 40 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#e5e7eb" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  clientName: { fontSize: 15, fontWeight: "600", color: "#1f2937" },
  statusBadge: { backgroundColor: "#f3f4f6", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  statusText: { fontSize: 10, color: "#6b7280", fontWeight: "600" },
  meta: { fontSize: 11, color: "#9ca3af", marginTop: 4 },
  participantsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: { backgroundColor: "#f3f4f6", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  chipText: { fontSize: 11, color: "#374151" },
});
