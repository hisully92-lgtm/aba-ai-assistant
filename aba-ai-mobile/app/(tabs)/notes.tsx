import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator, Alert
} from "react-native";
import { supabase } from "../../lib/supabase";

type Client = { id: string; full_name: string };
type Session = { id: string; client_id: string; date: string; notes: string | null; status: string; created_at: string };

export default function NotesScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [clientId, setClientId] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("completed");

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const { data: companyUser } = await supabase.from("company_users").select("company_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
    setCompanyId(companyUser?.company_id ?? "");
    const [{ data: clientData }, { data: sessionData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("company_id", companyUser?.company_id),
      supabase.from("sessions").select("id, client_id, date, notes, status, created_at").eq("created_by", user.id).order("created_at", { ascending: false }).limit(30),
    ]);
    setClients(clientData ?? []);
    setSessions(sessionData ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!clientId || !notes.trim()) { Alert.alert("Please select a client and add notes."); return; }
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const { data } = await supabase.from("sessions").insert({
      client_id: clientId,
      date: new Date().toISOString().split("T")[0],
      notes: notes.trim(),
      status,
      created_by: user.id,
      company_id: companyId,
    }).select().single();
    if (data) setSessions(prev => [data, ...prev]);
    setNotes(""); setClientId(""); setShowForm(false);
    setSaving(false);
  }

  const clientMap = new Map(clients.map(c => [c.id, c.full_name]));

  if (loading) return <View style={styles.center}><ActivityIndicator color="#2563eb" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Session Notes</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(s => !s)}>
          <Text style={styles.addBtnText}>{showForm ? "✕" : "+"}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {showForm && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>New Session Note</Text>
            <Text style={styles.label}>Client</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {clients.map(c => (
                <TouchableOpacity key={c.id} style={[styles.chip, clientId === c.id && styles.chipActive]} onPress={() => setClientId(c.id)}>
                  <Text style={[styles.chipText, clientId === c.id && styles.chipTextActive]}>{c.full_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.label}>Status</Text>
            <View style={styles.statusRow}>
              {["completed", "pending", "cancelled"].map(s => (
                <TouchableOpacity key={s} style={[styles.statusBtn, status === s && styles.statusBtnActive]} onPress={() => setStatus(s)}>
                  <Text style={[styles.statusBtnText, status === s && styles.statusBtnTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Notes</Text>
            <TextInput style={styles.notesInput} value={notes} onChangeText={setNotes} placeholder="Write session notes here..." multiline numberOfLines={6} textAlignVertical="top" />
            <TouchableOpacity style={[styles.saveBtn, (!clientId || !notes.trim()) && styles.saveBtnDisabled]} onPress={handleSave} disabled={!clientId || !notes.trim() || saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Note</Text>}
            </TouchableOpacity>
          </View>
        )}
        <View style={{ padding: 16 }}>
          <Text style={styles.sectionTitle}>Recent Notes</Text>
          {sessions.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📝</Text>
              <Text style={styles.emptyText}>No notes yet. Tap + to add one.</Text>
            </View>
          )}
          {sessions.map(s => (
            <View key={s.id} style={styles.noteCard}>
              <View style={styles.noteHeader}>
                <Text style={styles.noteClient}>{clientMap.get(s.client_id) ?? "Unknown"}</Text>
                <View style={[styles.noteBadge, s.status === "completed" ? styles.badgeGreen : styles.badgeYellow]}>
                  <Text style={styles.noteBadgeText}>{s.status}</Text>
                </View>
              </View>
              <Text style={styles.noteDate}>{s.date ?? new Date(s.created_at).toLocaleDateString()}</Text>
              {s.notes && <Text style={styles.noteText} numberOfLines={3}>{s.notes}</Text>}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { backgroundColor: "#1a2234", paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  addBtn: { width: 36, height: 36, backgroundColor: "#2563eb", borderRadius: 18, alignItems: "center", justifyContent: "center" },
  addBtnText: { color: "#fff", fontSize: 22, fontWeight: "300", lineHeight: 36 },
  form: { margin: 16, backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  formTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#f9fafb", marginRight: 8 },
  chipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { fontSize: 13, color: "#374151" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  statusRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  statusBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "#d1d5db", alignItems: "center" },
  statusBtnActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  statusBtnText: { fontSize: 12, color: "#6b7280", textTransform: "capitalize" },
  statusBtnTextActive: { color: "#fff", fontWeight: "600" },
  notesInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, padding: 12, fontSize: 14, color: "#111827", minHeight: 120, marginBottom: 14, backgroundColor: "#f9fafb" },
  saveBtn: { backgroundColor: "#2563eb", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  saveBtnDisabled: { backgroundColor: "#93c5fd" },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 12 },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 14, color: "#9ca3af" },
  noteCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  noteHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  noteClient: { fontSize: 14, fontWeight: "700", color: "#111827" },
  noteBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeGreen: { backgroundColor: "#dcfce7" },
  badgeYellow: { backgroundColor: "#fef9c3" },
  noteBadgeText: { fontSize: 11, fontWeight: "600", color: "#374151" },
  noteDate: { fontSize: 12, color: "#9ca3af", marginBottom: 6 },
  noteText: { fontSize: 13, color: "#6b7280", lineHeight: 20 },
});