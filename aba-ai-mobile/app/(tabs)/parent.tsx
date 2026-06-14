import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { supabase } from "../../lib/supabase";

type Session = { id: string; date: string | null; status: string; behaviors_observed: string | null; programs_targeted: string | null; notes: string | null; created_at: string };
type HomeProgram = { id: string; title: string; description: string; frequency: string | null; created_at: string };

export default function ParentScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [homePrograms, setHomePrograms] = useState<HomeProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"sessions" | "programs" | "progress">("sessions");

  const attendanceTotal = sessions.length;
  const attendanceCompleted = sessions.filter(s => s.status === "completed").length;
  const attendanceRate = attendanceTotal ? Math.round((attendanceCompleted / attendanceTotal) * 100) : 0;

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const [{ data: sessionData }, { data: programData }] = await Promise.all([
      supabase.from("sessions").select("id, date, status, behaviors_observed, programs_targeted, notes, created_at").order("created_at", { ascending: false }).limit(20),
      supabase.from("home_programs").select("*").eq("parent_user_id", user.id).order("created_at", { ascending: false }),
    ]);
    setSessions(sessionData ?? []);
    setHomePrograms(programData ?? []);
    setLoading(false);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#2563eb" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Parent Portal</Text>
        <Text style={styles.headerSub}>Your child&apos;s therapy progress</Text>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statNum}>{attendanceTotal}</Text><Text style={styles.statLabel}>Sessions</Text></View>
        <View style={styles.stat}><Text style={[styles.statNum, { color: "#16a34a" }]}>{attendanceRate}%</Text><Text style={styles.statLabel}>Attendance</Text></View>
        <View style={styles.stat}><Text style={[styles.statNum, { color: "#7c3aed" }]}>{homePrograms.length}</Text><Text style={styles.statLabel}>Home Programs</Text></View>
      </View>
      <View style={styles.tabs}>
        {(["sessions", "programs", "progress"] as const).map(tab => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === "sessions" ? "Sessions" : tab === "programs" ? "Home Programs" : "Progress"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {activeTab === "sessions" && (
          sessions.length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyEmoji}>📋</Text><Text style={styles.emptyText}>No sessions recorded yet.</Text></View>
          ) : (
            sessions.map(s => (
              <View key={s.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardDate}>{s.date ? new Date(s.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : new Date(s.created_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</Text>
                  <View style={[styles.badge, s.status === "completed" ? styles.badgeGreen : styles.badgeYellow]}><Text style={styles.badgeText}>{s.status}</Text></View>
                </View>
                {s.behaviors_observed && <Text style={styles.cardDetail}><Text style={styles.cardDetailLabel}>Behaviors: </Text>{s.behaviors_observed}</Text>}
                {s.programs_targeted && <Text style={styles.cardDetail}><Text style={styles.cardDetailLabel}>Programs: </Text>{s.programs_targeted}</Text>}
                {s.notes && <Text style={styles.cardNote}>{s.notes}</Text>}
              </View>
            ))
          )
        )}
        {activeTab === "programs" && (
          homePrograms.length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyEmoji}>🏠</Text><Text style={styles.emptyText}>No home programs yet.</Text><Text style={styles.emptySubText}>Your BCBA will add home practice programs here.</Text></View>
          ) : (
            homePrograms.map(p => (
              <View key={p.id} style={styles.card}>
                <Text style={styles.programTitle}>{p.title}</Text>
                {p.frequency && <Text style={styles.programFreq}>📅 {p.frequency}</Text>}
                <Text style={styles.programDesc}>{p.description}</Text>
              </View>
            ))
          )
        )}
        {activeTab === "progress" && (
          <View>
            <View style={styles.progressCard}>
              <Text style={styles.progressLabel}>Attendance Rate</Text>
              <Text style={styles.progressPct}>{attendanceRate}%</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${attendanceRate}%` as any }]} />
              </View>
              <Text style={styles.progressSub}>{attendanceCompleted} of {attendanceTotal} sessions completed</Text>
            </View>
            <View style={styles.progressCard}>
              <Text style={styles.progressLabel}>Recent Programs</Text>
              {[...new Set(sessions.flatMap(s => (s.programs_targeted ?? "").split(", ").filter(Boolean)))].slice(0, 6).map(p => (
                <View key={p} style={styles.programPill}><Text style={styles.programPillText}>{p}</Text></View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { backgroundColor: "#1a2234", paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: 13, color: "#94a3b8", marginTop: 4 },
  statsRow: { flexDirection: "row", backgroundColor: "#fff", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  stat: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 24, fontWeight: "900", color: "#2563eb" },
  statLabel: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  tabs: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#2563eb" },
  tabText: { fontSize: 13, color: "#9ca3af" },
  tabTextActive: { color: "#2563eb", fontWeight: "700" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  cardDate: { fontSize: 13, fontWeight: "600", color: "#111827", flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeGreen: { backgroundColor: "#dcfce7" },
  badgeYellow: { backgroundColor: "#fef9c3" },
  badgeText: { fontSize: 11, fontWeight: "600", color: "#374151" },
  cardDetail: { fontSize: 13, color: "#6b7280", marginBottom: 4 },
  cardDetailLabel: { fontWeight: "600", color: "#374151" },
  cardNote: { fontSize: 12, color: "#9ca3af", fontStyle: "italic", marginTop: 4 },
  programTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 4 },
  programFreq: { fontSize: 12, color: "#2563eb", marginBottom: 6 },
  programDesc: { fontSize: 13, color: "#6b7280", lineHeight: 20 },
  progressCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 10 },
  progressLabel: { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 8 },
  progressPct: { fontSize: 36, fontWeight: "900", color: "#16a34a", marginBottom: 8 },
  progressBar: { height: 10, backgroundColor: "#f3f4f6", borderRadius: 5, marginBottom: 6 },
  progressFill: { height: 10, backgroundColor: "#16a34a", borderRadius: 5 },
  progressSub: { fontSize: 12, color: "#9ca3af" },
  programPill: { backgroundColor: "#eff6ff", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 6, alignSelf: "flex-start" },
  programPillText: { fontSize: 12, color: "#2563eb", fontWeight: "500" },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 14, color: "#9ca3af", textAlign: "center" },
  emptySubText: { fontSize: 12, color: "#d1d5db", textAlign: "center", marginTop: 4 },
});