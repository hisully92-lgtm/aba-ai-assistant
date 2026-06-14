import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, Switch, TextInput
} from "react-native";
import { supabase } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";

type Session = {
  id: string;
  client_id: string;
  date: string;
  status: string;
  start_time: string | null;
  end_time: string | null;
  behaviors_observed: string | null;
  programs_targeted: string | null;
  staff_member: string | null;
};
type Client = { id: string; full_name: string };
type TimeEntryLog = {
  id: string;
  session_id: string | null;
  client_id: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  session_type: string;
  cpt_code: string | null;
  drive_time_minutes: number;
  drive_time_billable: boolean;
  notes: string | null;
  status: string;
  reviewer_notes: string | null;
};

const CPT_CODES = [
  { code: "97153", label: "97153 — Adaptive Behavior Treatment" },
  { code: "97155", label: "97155 — Protocol Modification" },
  { code: "97156", label: "97156 — Family Guidance" },
  { code: "97151", label: "97151 — Behavior Identification" },
  { code: "97154", label: "97154 — Group ABA Treatment" },
];

const SESSION_TYPES = [
  "Direct Therapy", "Supervision", "Parent Training", "Assessment", "Telehealth",
];

const STATUS_COLORS: Record<string, string> = {
  draft: "#6b7280",
  pending: "#d97706",
  needs_correction: "#dc2626",
  approved: "#16a34a",
  billed: "#2563eb",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "Pending Review",
  needs_correction: "Needs Correction",
  approved: "Approved",
  billed: "Billed",
};

export default function TimeEntryScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [driveTimeEnabled, setDriveTimeEnabled] = useState(false);
  const [driveTimeMax, setDriveTimeMax] = useState(120);
  const [activeView, setActiveView] = useState<"sessions" | "entries">("sessions");

  // Entry form
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    session_type: "Direct Therapy",
    cpt_code: "97153",
    drive_time_minutes: 0,
    drive_time_billable: false,
    notes: "",
    start_time: "",
    end_time: "",
  });

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

    const last30 = new Date();
    last30.setDate(last30.getDate() - 30);

    try {
      const [{ data: clientData }, { data: sessionData }, { data: entryData }, { data: company }] = await Promise.all([
        supabase.from("clients").select("id, full_name").eq("company_id", companyUser?.company_id),
        supabase.from("sessions").select("id, client_id, date, status, start_time, end_time, behaviors_observed, programs_targeted, staff_member")
          .eq("company_id", companyUser?.company_id)
          .gte("date", last30.toISOString().split("T")[0])
          .order("date", { ascending: false }),
        supabase.from("time_entry_logs").select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("companies").select("drive_time_enabled, drive_time_max_minutes")
          .eq("id", companyUser?.company_id).single(),
      ]);
      setClients(clientData ?? []);
      setSessions(sessionData ?? []);
      setTimeEntries(entryData ?? []);
      setDriveTimeEnabled(company?.drive_time_enabled ?? false);
      setDriveTimeMax(company?.drive_time_max_minutes ?? 120);
    } catch (e) {
      console.log("Init error:", e);
    }
    setLoading(false);
  }

  function openEntryForm(session: Session) {
    setSelectedSession(session);
    const startTime = session.start_time
      ? new Date(session.start_time).toTimeString().slice(0, 5)
      : "";
    const endTime = session.end_time
      ? new Date(session.end_time).toTimeString().slice(0, 5)
      : "";
    setForm({
      session_type: "Direct Therapy",
      cpt_code: "97153",
      drive_time_minutes: 0,
      drive_time_billable: false,
      notes: "",
      start_time: startTime,
      end_time: endTime,
    });
    setShowForm(true);
  }

  async function saveEntry(submitNow: boolean) {
    if (!selectedSession) return;
    if (!form.start_time || !form.end_time) {
      Alert.alert("Missing Time", "Please enter start and end time.");
      return;
    }
    setSaving(true);

    const startDt = new Date(`${selectedSession.date}T${form.start_time}`);
    const endDt = new Date(`${selectedSession.date}T${form.end_time}`);
    const duration = Math.floor((endDt.getTime() - startDt.getTime()) / 60000);

    const { data, error } = await supabase.from("time_entry_logs").insert({
      company_id: companyId,
      user_id: userId,
      client_id: selectedSession.client_id,
      session_id: selectedSession.id,
      date: selectedSession.date,
      start_time: startDt.toISOString(),
      end_time: endDt.toISOString(),
      duration_minutes: duration,
      session_type: form.session_type,
      cpt_code: form.cpt_code,
      drive_time_minutes: form.drive_time_minutes,
      drive_time_billable: form.drive_time_billable,
      notes: form.notes || null,
      status: submitNow ? "pending" : "draft",
      submitted_at: submitNow ? new Date().toISOString() : null,
    }).select().single();

    if (error) {
      Alert.alert("Error", error.message);
      setSaving(false);
      return;
    }

    if (data) setTimeEntries(prev => [data, ...prev]);
    setShowForm(false);
    setSelectedSession(null);
    setSaving(false);
    Alert.alert(
      submitNow ? "Submitted!" : "Saved!",
      submitNow
        ? "Time entry submitted for BCBA review."
        : "Time entry saved as draft. Submit when ready."
    );
    await init();
  }

  const clientMap = new Map(clients.map(c => [c.id, c.full_name]));

  // Check which sessions already have a time entry
  const sessionIdsWithEntry = new Set(timeEntries.map(e => e.session_id).filter(Boolean));

  function formatDuration(minutes: number) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#2563eb" size="large" /></View>;

  return (
    <View style={styles.container}>
      <AppHeader title="Time Entry" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* INFO BANNER */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerTitle}>📋 How Time Entry Works</Text>
          <Text style={styles.infoBannerText}>
            1. Select a session below{"\n"}
            2. Confirm times + add CPT code{"\n"}
            3. Submit for BCBA review{"\n"}
            4. BCBA approves → goes to billing
          </Text>
        </View>

        {/* TABS */}
        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, activeView === "sessions" && styles.tabActive]}
            onPress={() => setActiveView("sessions")}>
            <Text style={[styles.tabText, activeView === "sessions" && styles.tabTextActive]}>
              📋 Sessions ({sessions.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeView === "entries" && styles.tabActive]}
            onPress={() => setActiveView("entries")}>
            <Text style={[styles.tabText, activeView === "entries" && styles.tabTextActive]}>
              ⏱️ My Entries ({timeEntries.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* SESSIONS LIST */}
        {activeView === "sessions" && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Tap a session to create a time entry</Text>
            {sessions.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>📋</Text>
                <Text style={styles.emptyText}>No sessions in the last 30 days.</Text>
              </View>
            )}
            {sessions.map(s => {
              const hasEntry = sessionIdsWithEntry.has(s.id);
              return (
                <TouchableOpacity key={s.id}
                  style={[styles.sessionCard, hasEntry && styles.sessionCardDone]}
                  onPress={() => openEntryForm(s)}
                  disabled={hasEntry}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.sessionCardHeader}>
                      <Text style={styles.sessionClientName}>{clientMap.get(s.client_id) ?? "Unknown"}</Text>
                      {hasEntry && <Text style={styles.doneTag}>✓ Entry submitted</Text>}
                    </View>
                    <Text style={styles.sessionDate}>{s.date}</Text>
                    {s.start_time && (
                      <Text style={styles.sessionTime}>
                        {new Date(s.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {s.end_time ? ` → ${new Date(s.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                      </Text>
                    )}
                    {s.behaviors_observed && (
                      <Text style={styles.sessionMeta} numberOfLines={1}>Behaviors: {s.behaviors_observed}</Text>
                    )}
                    {s.programs_targeted && (
                      <Text style={styles.sessionMeta} numberOfLines={1}>Programs: {s.programs_targeted}</Text>
                    )}
                  </View>
                  {!hasEntry && <Text style={styles.chevron}>›</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* TIME ENTRIES LIST */}
        {activeView === "entries" && (
          <View style={styles.section}>
            {timeEntries.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>⏱️</Text>
                <Text style={styles.emptyText}>No time entries yet.</Text>
                <Text style={styles.emptySubText}>Submit entries from the Sessions tab.</Text>
              </View>
            )}
            {timeEntries.map(entry => (
              <View key={entry.id} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.entryClient}>{clientMap.get(entry.client_id) ?? "Unknown"}</Text>
                    <Text style={styles.entryDate}>{entry.date} · {formatDuration(entry.duration_minutes)}</Text>
                    <Text style={styles.entryCpt}>{entry.cpt_code} — {entry.session_type}</Text>
                    {entry.drive_time_minutes > 0 && (
                      <Text style={styles.entryDrive}>🚗 {entry.drive_time_minutes}min drive{entry.drive_time_billable ? " (billable)" : ""}</Text>
                    )}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[entry.status]}20` }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[entry.status] }]}>
                      {STATUS_LABELS[entry.status] ?? entry.status}
                    </Text>
                  </View>
                </View>
                {entry.reviewer_notes && entry.status === "needs_correction" && (
                  <View style={styles.correctionBox}>
                    <Text style={styles.correctionTitle}>⚠️ Correction Required</Text>
                    <Text style={styles.correctionText}>{entry.reviewer_notes}</Text>
                  </View>
                )}
                {entry.notes && (
                  <Text style={styles.entryNotes} numberOfLines={2}>{entry.notes}</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ENTRY FORM MODAL */}
      {showForm && selectedSession && (
        <View style={styles.formOverlay}>
          <View style={styles.formPanel}>
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={styles.formHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formTitle}>Time Entry</Text>
                  <Text style={styles.formSubtitle}>{clientMap.get(selectedSession.client_id) ?? "Unknown"} — {selectedSession.date}</Text>
                </View>
                <TouchableOpacity onPress={() => setShowForm(false)}>
                  <Text style={styles.formClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* SESSION DATA SUMMARY */}
              <View style={styles.sessionSummary}>
                <Text style={styles.summaryLabel}>Session Data</Text>
                {selectedSession.behaviors_observed && (
                  <Text style={styles.summaryText}>🧠 {selectedSession.behaviors_observed}</Text>
                )}
                {selectedSession.programs_targeted && (
                  <Text style={styles.summaryText}>🎯 {selectedSession.programs_targeted}</Text>
                )}
              </View>

              {/* TIME */}
              <Text style={styles.fieldLabel}>Start Time</Text>
              <TextInput style={styles.timeInput} value={form.start_time}
                onChangeText={t => setForm(p => ({ ...p, start_time: t }))}
                placeholder="HH:MM" keyboardType="numbers-and-punctuation" />

              <Text style={styles.fieldLabel}>End Time</Text>
              <TextInput style={styles.timeInput} value={form.end_time}
                onChangeText={t => setForm(p => ({ ...p, end_time: t }))}
                placeholder="HH:MM" keyboardType="numbers-and-punctuation" />

              {form.start_time && form.end_time && (
                <View style={styles.durationBox}>
                  <Text style={styles.durationText}>
                    {(() => {
                      try {
                        const start = new Date(`${selectedSession.date}T${form.start_time}`);
                        const end = new Date(`${selectedSession.date}T${form.end_time}`);
                        const mins = Math.floor((end.getTime() - start.getTime()) / 60000);
                        return `Duration: ${Math.floor(mins / 60)}h ${mins % 60}m`;
                      } catch { return ""; }
                    })()}
                  </Text>
                </View>
              )}

              {/* SESSION TYPE */}
              <Text style={styles.fieldLabel}>Session Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {SESSION_TYPES.map(t => (
                  <TouchableOpacity key={t}
                    style={[styles.chip, form.session_type === t && styles.chipActive]}
                    onPress={() => setForm(p => ({ ...p, session_type: t }))}>
                    <Text style={[styles.chipText, form.session_type === t && styles.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* CPT CODE */}
              <Text style={styles.fieldLabel}>CPT Code *</Text>
              {CPT_CODES.map(c => (
                <TouchableOpacity key={c.code}
                  style={[styles.cptOption, form.cpt_code === c.code && styles.cptOptionActive]}
                  onPress={() => setForm(p => ({ ...p, cpt_code: c.code }))}>
                  <Text style={[styles.cptText, form.cpt_code === c.code && styles.cptTextActive]}>{c.label}</Text>
                  {form.cpt_code === c.code && <Text style={styles.cptCheck}>✓</Text>}
                </TouchableOpacity>
              ))}

              {/* DRIVE TIME */}
              {driveTimeEnabled && (
                <View style={styles.driveSection}>
                  <Text style={styles.fieldLabel}>Drive Time (max {driveTimeMax} min)</Text>
                  <TextInput style={styles.timeInput}
                    value={String(form.drive_time_minutes)}
                    onChangeText={t => setForm(p => ({ ...p, drive_time_minutes: Math.min(parseInt(t) || 0, driveTimeMax) }))}
                    keyboardType="numeric" placeholder="0 minutes" />
                  {form.drive_time_minutes > 0 && (
                    <View style={styles.driveToggleRow}>
                      <Text style={styles.driveToggleText}>Billable drive time</Text>
                      <Switch value={form.drive_time_billable}
                        onValueChange={v => setForm(p => ({ ...p, drive_time_billable: v }))}
                        trackColor={{ true: "#2563eb" }} />
                    </View>
                  )}
                </View>
              )}

              {/* NOTES */}
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput style={styles.notesInput} value={form.notes}
                onChangeText={t => setForm(p => ({ ...p, notes: t }))}
                placeholder="Additional notes for billing review..."
                multiline numberOfLines={4} textAlignVertical="top" />

              {/* ACTIONS */}
              <TouchableOpacity style={[styles.submitBtn, saving && { opacity: 0.6 }]}
                onPress={() => saveEntry(true)} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit for Review</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.draftBtn, saving && { opacity: 0.6 }]}
                onPress={() => saveEntry(false)} disabled={saving}>
                <Text style={styles.draftBtnText}>Save as Draft</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  infoBanner: { margin: 16, backgroundColor: "#eff6ff", borderRadius: 12, padding: 14, borderLeftWidth: 4, borderLeftColor: "#2563eb" },
  infoBannerTitle: { fontSize: 13, fontWeight: "700", color: "#1d4ed8", marginBottom: 6 },
  infoBannerText: { fontSize: 12, color: "#3b82f6", lineHeight: 20 },
  tabs: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#2563eb" },
  tabText: { fontSize: 13, color: "#9ca3af", fontWeight: "500" },
  tabTextActive: { color: "#2563eb", fontWeight: "700" },
  section: { padding: 16 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", marginBottom: 12, letterSpacing: 0.5 },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 14, color: "#9ca3af", textAlign: "center" },
  emptySubText: { fontSize: 12, color: "#d1d5db", textAlign: "center", marginTop: 4 },
  sessionCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, elevation: 1, borderWidth: 1, borderColor: "#e5e7eb" },
  sessionCardDone: { backgroundColor: "#f9fafb", borderColor: "#d1d5db", opacity: 0.7 },
  sessionCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  sessionClientName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  doneTag: { fontSize: 11, color: "#16a34a", fontWeight: "600" },
  sessionDate: { fontSize: 12, color: "#9ca3af", marginBottom: 2 },
  sessionTime: { fontSize: 12, color: "#6b7280", marginBottom: 2 },
  sessionMeta: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  chevron: { fontSize: 24, color: "#d1d5db", marginLeft: 8 },
  entryCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#e5e7eb" },
  entryHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  entryClient: { fontSize: 14, fontWeight: "700", color: "#111827" },
  entryDate: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  entryCpt: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  entryDrive: { fontSize: 11, color: "#7c3aed", marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: "700" },
  correctionBox: { backgroundColor: "#fef2f2", borderRadius: 8, padding: 10, marginTop: 8 },
  correctionTitle: { fontSize: 12, fontWeight: "700", color: "#dc2626", marginBottom: 4 },
  correctionText: { fontSize: 12, color: "#dc2626" },
  entryNotes: { fontSize: 12, color: "#6b7280", marginTop: 8, fontStyle: "italic" },
  formOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  formPanel: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%", padding: 20 },
  formHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  formTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
  formSubtitle: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  formClose: { fontSize: 20, color: "#9ca3af", padding: 4 },
  sessionSummary: { backgroundColor: "#f9fafb", borderRadius: 10, padding: 12, marginBottom: 16 },
  summaryLabel: { fontSize: 11, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", marginBottom: 6 },
  summaryText: { fontSize: 12, color: "#374151", marginBottom: 3, lineHeight: 18 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5 },
  timeInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: "#111827", marginBottom: 14, backgroundColor: "#fff" },
  durationBox: { backgroundColor: "#eff6ff", borderRadius: 8, padding: 10, marginBottom: 14, alignItems: "center" },
  durationText: { fontSize: 14, fontWeight: "700", color: "#2563eb" },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#fff", marginRight: 8 },
  chipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { fontSize: 12, color: "#374151" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  cptOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 6, backgroundColor: "#fff" },
  cptOptionActive: { backgroundColor: "#eff6ff", borderColor: "#2563eb" },
  cptText: { fontSize: 13, color: "#374151" },
  cptTextActive: { color: "#2563eb", fontWeight: "600" },
  cptCheck: { color: "#2563eb", fontWeight: "700", fontSize: 16 },
  driveSection: { marginBottom: 16 },
  driveToggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  driveToggleText: { fontSize: 14, color: "#374151" },
  notesInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#111827", minHeight: 100, marginBottom: 16, backgroundColor: "#fff" },
  submitBtn: { backgroundColor: "#2563eb", paddingVertical: 16, borderRadius: 14, alignItems: "center", marginBottom: 10 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  draftBtn: { backgroundColor: "#f3f4f6", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  draftBtnText: { color: "#374151", fontSize: 15, fontWeight: "600" },
});