import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator, Alert
} from "react-native";
import { supabase } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";

type Client = { id: string; full_name: string };
type SessionNote = {
  id: string;
  client_id: string;
  session_date: string;
  note: string | null;
  created_at: string;
};

export default function NotesScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [sessionNotes, setSessionNotes] = useState<SessionNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [userId, setUserId] = useState("");
  const [clientId, setClientId] = useState("");
  const [noteText, setNoteText] = useState("");
  const [companyId, setCompanyId] = useState("");

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const { data: companyUser } = await supabase
      .from("company_users").select("company_id")
      .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
    setCompanyId(companyUser?.company_id ?? "");

    const [{ data: clientData }, { data: noteData }] = await Promise.all([
      supabase.from("clients").select("id, full_name")
        .eq("company_id", companyUser?.company_id),
      supabase.from("session_notes").select("id, client_id, session_date, note, created_at")
        .eq("rbt_id", user.id).order("created_at", { ascending: false }).limit(30),
    ]);

    setClients(clientData ?? []);
    setSessionNotes(noteData ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!clientId || !noteText.trim()) {
      Alert.alert("Please select a client and add notes.");
      return;
    }
    setSaving(true);
    const { data } = await supabase.from("session_notes").insert({
      client_id: clientId,
      session_date: new Date().toISOString().split("T")[0],
      note: noteText.trim(),
      rbt_id: userId,
    }).select().single();
    if (data) setSessionNotes(prev => [data, ...prev]);
    setNoteText("");
    setClientId("");
    setShowForm(false);
    setSaving(false);
  }

  const clientMap = new Map(clients.map(c => [c.id, c.full_name]));

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator color="#2563eb" size="large" />
    </View>
  );

  return (
    <View style={styles.container}>
      <AppHeader title="Session Notes" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>

        <TouchableOpacity style={styles.addNoteBtn} onPress={() => setShowForm(s => !s)}>
          <Text style={styles.addNoteBtnText}>{showForm ? "✕ Cancel" : "+ New Note"}</Text>
        </TouchableOpacity>

        {showForm && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>New Session Note</Text>

            <Text style={styles.label}>Client</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {clients.map(c => (
                <TouchableOpacity key={c.id}
                  style={[styles.chip, clientId === c.id && styles.chipActive]}
                  onPress={() => setClientId(c.id)}>
                  <Text style={[styles.chipText, clientId === c.id && styles.chipTextActive]}>
                    {c.full_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Write session notes here..."
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.saveBtn, (!clientId || !noteText.trim()) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!clientId || !noteText.trim() || saving}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>Save Note</Text>}
            </TouchableOpacity>
          </View>
        )}

        <View style={{ padding: 16 }}>
          <Text style={styles.sectionTitle}>Recent Notes</Text>

          {sessionNotes.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📝</Text>
              <Text style={styles.emptyText}>No notes yet. Tap + New Note to add one.</Text>
            </View>
          )}

          {sessionNotes.map(n => (
            <View key={n.id} style={styles.noteCard}>
              <View style={styles.noteHeader}>
                <Text style={styles.noteClient}>
                  {clientMap.get(n.client_id) ?? "Unknown"}
                </Text>
                <Text style={styles.noteDate}>
                  {n.session_date ?? new Date(n.created_at).toLocaleDateString()}
                </Text>
              </View>
              {n.note && (
                <Text style={styles.noteText} numberOfLines={4}>{n.note}</Text>
              )}
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
  addNoteBtn: { margin: 16, marginBottom: 8, backgroundColor: "#2563eb", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  addNoteBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  form: { margin: 16, backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  formTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#f9fafb", marginRight: 8 },
  chipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { fontSize: 13, color: "#374151" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  notesInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, padding: 12, fontSize: 14, color: "#111827", minHeight: 120, marginBottom: 14, backgroundColor: "#f9fafb" },
  saveBtn: { backgroundColor: "#2563eb", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  saveBtnDisabled: { backgroundColor: "#93c5fd" },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 12 },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 14, color: "#9ca3af" },
  noteCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  noteHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  noteClient: { fontSize: 14, fontWeight: "700", color: "#111827" },
  noteDate: { fontSize: 12, color: "#9ca3af" },
  noteText: { fontSize: 13, color: "#6b7280", lineHeight: 20 },
});