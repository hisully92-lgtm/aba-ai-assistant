import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator
} from "react-native";
import * as Location from "expo-location";
import { supabase } from "../../lib/supabase";

type Client = { id: string; full_name: string };
type TimeEntry = { id: string; clock_in: string; clock_out: string | null; session_type: string; client_id: string | null };

export default function HomeScreen() {
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [clockedIn, setClockedIn] = useState<TimeEntry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [selectedClient, setSelectedClient] = useState("");
  const [loading, setLoading] = useState(true);
  const [clockingIn, setClockingIn] = useState(false);
  const [todaySessions, setTodaySessions] = useState<any[]>([]);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!clockedIn) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(clockedIn.clock_in).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [clockedIn]);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: profile }, { data: companyUser }] = await Promise.all([
      supabase.from("profiles").select("full_name, role").eq("id", user.id).single(),
      supabase.from("company_users").select("company_id, role").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle(),
    ]);

    setUserName(profile?.full_name ?? "");
    setRole(companyUser?.role ?? profile?.role ?? "");

    const today = new Date().toISOString().split("T")[0];
    const [{ data: clientData }, { data: entryData }, { data: sessionData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("company_id", companyUser?.company_id),
      supabase.from("time_entries").select("*").eq("created_by", user.id).is("clock_out", null).limit(1).maybeSingle(),
      supabase.from("sessions").select("*, clients(full_name)").eq("created_by", user.id).eq("date", today),
    ]);

    setClients(clientData ?? []);
    setClockedIn(entryData ?? null);
    if (entryData) setElapsed(Math.floor((Date.now() - new Date(entryData.clock_in).getTime()) / 1000));
    setTodaySessions(sessionData ?? []);
    setLoading(false);
  }

  async function handleClockIn() {
    if (!selectedClient) { Alert.alert("Select a client first"); return; }
    setClockingIn(true);

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Location required", "Please allow location access to clock in.");
      setClockingIn(false);
      return;
    }

    const location = await Location.getCurrentPositionAsync({});
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("time_entries").insert({
      client_id: selectedClient,
      clock_in: new Date().toISOString(),
      session_type: "Direct Therapy",
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      created_by: user.id,
    }).select().single();

    if (data) { setClockedIn(data); setElapsed(0); }
    setClockingIn(false);
  }

  async function handleClockOut() {
    if (!clockedIn) return;
    const duration = Math.floor(elapsed / 60);
    await supabase.from("time_entries").update({
      clock_out: new Date().toISOString(),
      duration_minutes: duration,
    }).eq("id", clockedIn.id);
    setClockedIn(null);
    setElapsed(0);
    Alert.alert("Clocked out", `Session duration: ${Math.floor(duration / 60)}h ${duration % 60}m`);
    init();
  }

  function formatElapsed(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  const clientMap = new Map(clients.map(c => [c.id, c.full_name]));
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting},</Text>
        <Text style={styles.name}>{userName || "Clinician"}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{role.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Session Timer</Text>
        {clockedIn ? (
          <View style={{ alignItems: "center" }}>
            <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>
            <Text style={styles.timerSub}>Client: {clientMap.get(clockedIn.client_id ?? "") ?? "Unknown"}</Text>
            <Text style={styles.timerSub}>Started: {new Date(clockedIn.clock_in).toLocaleTimeString()}</Text>
            <TouchableOpacity style={styles.clockOutBtn} onPress={handleClockOut}>
              <Text style={styles.clockOutText}>⏹ Clock Out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text style={styles.label}>Select Client</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {clients.map(c => (
                <TouchableOpacity key={c.id}
                  style={[styles.clientChip, selectedClient === c.id && styles.clientChipActive]}
                  onPress={() => setSelectedClient(c.id)}>
                  <Text style={[styles.clientChipText, selectedClient === c.id && styles.clientChipTextActive]}>
                    {c.full_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.clockInBtn, !selectedClient && styles.clockInBtnDisabled]}
              onPress={handleClockIn}
              disabled={!selectedClient || clockingIn}>
              {clockingIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.clockInText}>📍 Clock In with Geofence</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today&apos;s Sessions ({todaySessions.length})</Text>
        {todaySessions.length === 0 ? (
          <Text style={styles.empty}>No sessions recorded today.</Text>
        ) : (
          todaySessions.map(s => (
            <View key={s.id} style={styles.sessionRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sessionClient}>{(s.clients as any)?.full_name ?? "Unknown"}</Text>
                <Text style={styles.sessionMeta}>{s.date}</Text>
              </View>
              <View style={[styles.statusBadge, s.status === "completed" ? styles.statusGreen : styles.statusYellow]}>
                <Text style={styles.statusText}>{s.status}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          {[
            { emoji: "📋", label: "New Session" },
            { emoji: "📊", label: "Log Behavior" },
            { emoji: "🎯", label: "Log Trial" },
            { emoji: "💬", label: "Team Chat" },
          ].map(item => (
            <TouchableOpacity key={item.label} style={styles.quickItem}>
              <Text style={styles.quickEmoji}>{item.emoji}</Text>
              <Text style={styles.quickLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { backgroundColor: "#1a2234", paddingTop: 60, paddingBottom: 30, paddingHorizontal: 24 },
  greeting: { fontSize: 14, color: "#94a3b8" },
  name: { fontSize: 26, fontWeight: "800", color: "#fff", marginTop: 2 },
  roleBadge: { marginTop: 8, backgroundColor: "#2563eb", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  roleText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  card: { margin: 16, marginBottom: 0, backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 14 },
  timer: { fontSize: 52, fontWeight: "900", color: "#2563eb", fontVariant: ["tabular-nums"] },
  timerSub: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  clockOutBtn: { marginTop: 16, backgroundColor: "#dc2626", paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  clockOutText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  label: { fontSize: 12, fontWeight: "600", color: "#6b7280", marginBottom: 8 },
  clientChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#d1d5db", marginRight: 8, backgroundColor: "#fff" },
  clientChipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  clientChipText: { fontSize: 13, color: "#374151" },
  clientChipTextActive: { color: "#fff", fontWeight: "600" },
  clockInBtn: { backgroundColor: "#2563eb", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  clockInBtnDisabled: { backgroundColor: "#93c5fd" },
  clockInText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  sessionRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  sessionClient: { fontSize: 14, fontWeight: "600", color: "#111827" },
  sessionMeta: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusGreen: { backgroundColor: "#dcfce7" },
  statusYellow: { backgroundColor: "#fef9c3" },
  statusText: { fontSize: 11, fontWeight: "600", color: "#374151" },
  empty: { fontSize: 13, color: "#9ca3af", textAlign: "center", paddingVertical: 16 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickItem: { width: "47%", backgroundColor: "#f9fafb", borderRadius: 12, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#f3f4f6" },
  quickEmoji: { fontSize: 28, marginBottom: 6 },
  quickLabel: { fontSize: 12, fontWeight: "600", color: "#374151", textAlign: "center" },
});