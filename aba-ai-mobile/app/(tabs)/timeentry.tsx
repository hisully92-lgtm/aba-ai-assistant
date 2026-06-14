import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, Switch, TextInput, Modal
} from "react-native";
import { supabase } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";

type Client = { id: string; full_name: string };
type EVVRecord = {
  id: string;
  client_id: string;
  date: string;
  actual_start: string;
  actual_end: string;
  session_duration_minutes: number;
  location_name: string | null;
  start_geofence_verified: boolean;
  rbt_signature: string | null;
  guardian_signature: string | null;
  guardian_unavailable: boolean;
  guardian_unavailable_reason: string | null;
  behaviors_recorded: number;
  trials_recorded: number;
  evv_status: string;
  time_entry_id: string | null;
  clients?: { full_name: string };
};
type TimeEntryLog = {
  id: string;
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
  evv_record_id: string | null;
  location_name: string | null;
  geofence_verified: boolean;
};

const CPT_CODES = [
  { code: "97153", label: "97153 — Adaptive Behavior Treatment (RBT)" },
  { code: "97155", label: "97155 — Protocol Modification (BCBA)" },
  { code: "97156", label: "97156 — Family Guidance" },
  { code: "97151", label: "97151 — Behavior Identification" },
  { code: "97152", label: "97152 — Supporting Assessment" },
  { code: "T1016", label: "T1016 — Drive Time" },
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

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function TimeEntryScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [evvRecords, setEvvRecords] = useState<EVVRecord[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [driveTimeEnabled, setDriveTimeEnabled] = useState(false);
  const [driveTimeMax, setDriveTimeMax] = useState(120);
  const [activeTab, setActiveTab] = useState<"evv" | "entries">("evv");
  const [expandedEVV, setExpandedEVV] = useState<string | null>(null);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  // Convert EVV → Time Entry
  const [convertingEVV, setConvertingEVV] = useState<EVVRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [convertForm, setConvertForm] = useState({
    session_type: "Direct Therapy",
    cpt_code: "97153",
    drive_time_minutes: 0,
    drive_time_billable: false,
    notes: "",
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

    try {
      const [{ data: clientData }, { data: evvData }, { data: entryData }, { data: company }] = await Promise.all([
        supabase.from("clients").select("id, full_name").eq("company_id", companyUser?.company_id),
        supabase.from("evv_records")
          .select("*, clients(full_name)")
          .eq("company_id", companyUser?.company_id)
          .eq("rbt_id", user.id)
          .eq("evv_status", "complete")
          .order("actual_start", { ascending: false })
          .limit(50),
        supabase.from("time_entry_logs").select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("companies").select("drive_time_enabled, drive_time_max_minutes")
          .eq("id", companyUser?.company_id).single(),
      ]);
      setClients(clientData ?? []);
      setEvvRecords(evvData ?? []);
      setTimeEntries(entryData ?? []);
      setDriveTimeEnabled(company?.drive_time_enabled ?? false);
      setDriveTimeMax(company?.drive_time_max_minutes ?? 120);
    } catch (e) {
      console.log("Init error:", e);
    }
    setLoading(false);
  }

  function openConvertForm(evv: EVVRecord) {
    setConvertingEVV(evv);
    setConvertForm({
      session_type: "Direct Therapy",
      cpt_code: "97153",
      drive_time_minutes: 0,
      drive_time_billable: false,
      notes: "",
    });
  }

  async function createEntryFromEVV(submitNow: boolean) {
    if (!convertingEVV) return;
    setSaving(true);

    const { data, error } = await supabase.from("time_entry_logs").insert({
      company_id: companyId,
      user_id: userId,
      client_id: convertingEVV.client_id,
      date: convertingEVV.date,
      start_time: convertingEVV.actual_start,
      end_time: convertingEVV.actual_end,
      duration_minutes: convertingEVV.session_duration_minutes,
      session_type: convertForm.session_type,
      cpt_code: convertForm.cpt_code,
      drive_time_minutes: convertForm.drive_time_minutes,
      drive_time_billable: convertForm.drive_time_billable,
      notes: convertForm.notes || null,
      status: submitNow ? "pending" : "draft",
      submitted_at: submitNow ? new Date().toISOString() : null,
      location_name: convertingEVV.location_name,
      geofence_verified: convertingEVV.start_geofence_verified,
      evv_record_id: convertingEVV.id,
    }).select().single();

    if (error) {
      Alert.alert("Error", error.message);
      setSaving(false);
      return;
    }

    // Link EVV record to time entry
    await supabase.from("evv_records").update({
      time_entry_id: data.id,
    }).eq("id", convertingEVV.id);

    setConvertingEVV(null);
    setSaving(false);
    setActiveTab("entries");
    await init();

    Alert.alert(
      submitNow ? "✅ Submitted!" : "💾 Saved!",
      submitNow
        ? "Time entry submitted for BCBA review."
        : "Time entry saved as draft. Submit when ready."
    );
  }

  const clientMap = new Map(clients.map(c => [c.id, c.full_name]));
  const unbilledEVV = evvRecords.filter(e => !e.time_entry_id);
  const pendingCount = timeEntries.filter(e => e.status === "pending").length;

  if (loading) return <View style={styles.center}><ActivityIndicator color="#2563eb" size="large" /></View>;

  return (
    <View style={styles.container}>
      <AppHeader title="Time Entry & EVV" />

      {/* STATS ROW */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: "#f5f3ff" }]}>
          <Text style={[styles.statNum, { color: "#7c3aed" }]}>{evvRecords.length}</Text>
          <Text style={[styles.statLabel, { color: "#7c3aed" }]}>EVV Complete</Text>
          {unbilledEVV.length > 0 && (
            <Text style={styles.statSub}>{unbilledEVV.length} need entry</Text>
          )}
        </View>
        <View style={[styles.statCard, { backgroundColor: "#fefce8" }]}>
          <Text style={[styles.statNum, { color: "#d97706" }]}>{pendingCount}</Text>
          <Text style={[styles.statLabel, { color: "#d97706" }]}>Pending Review</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#f0fdf4" }]}>
          <Text style={[styles.statNum, { color: "#16a34a" }]}>{timeEntries.filter(e => e.status === "approved").length}</Text>
          <Text style={[styles.statLabel, { color: "#16a34a" }]}>Approved</Text>
        </View>
      </View>

      {/* TABS */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "evv" && styles.tabActive]}
          onPress={() => setActiveTab("evv")}>
          <Text style={[styles.tabText, activeTab === "evv" && styles.tabTextActive]}>
            📋 EVV Records
          </Text>
          {unbilledEVV.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{unbilledEVV.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "entries" && styles.tabActive]}
          onPress={() => setActiveTab("entries")}>
          <Text style={[styles.tabText, activeTab === "entries" && styles.tabTextActive]}>
            ⏱️ My Entries
          </Text>
          {pendingCount > 0 && (
            <View style={[styles.tabBadge, { backgroundColor: "#d97706" }]}>
              <Text style={styles.tabBadgeText}>{pendingCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>

        {/* EVV RECORDS TAB */}
        {activeTab === "evv" && (
          <View>
            <Text style={styles.sectionLabel}>
              Completed EVV visits — tap to create a billing time entry
            </Text>
            {evvRecords.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>📋</Text>
                <Text style={styles.emptyText}>No completed EVV records yet</Text>
                <Text style={styles.emptySubText}>Complete a visit in the app to see it here</Text>
              </View>
            )}
            {evvRecords.map(evv => {
              const hasEntry = !!evv.time_entry_id;
              const isExpanded = expandedEVV === evv.id;
              return (
                <View key={evv.id} style={[styles.card, !hasEntry && styles.cardHighlight]}>
                  <TouchableOpacity
                    style={styles.cardHeader}
                    onPress={() => setExpandedEVV(isExpanded ? null : evv.id)}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.cardClient}>
                          {evv.clients?.full_name ?? clientMap.get(evv.client_id) ?? "Unknown"}
                        </Text>
                        {!hasEntry ? (
                          <View style={styles.needsEntryBadge}>
                            <Text style={styles.needsEntryText}>Needs Entry</Text>
                          </View>
                        ) : (
                          <View style={styles.doneBadge}>
                            <Text style={styles.doneText}>✓ Done</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.cardMeta}>
                        📅 {formatDate(evv.actual_start)} · 🕐 {formatTime(evv.actual_start)} – {formatTime(evv.actual_end)} · ⏱️ {formatDuration(evv.session_duration_minutes)}
                      </Text>
                      {evv.location_name && (
                        <Text style={styles.cardMeta}>📍 {evv.location_name}{evv.start_geofence_verified ? " ✓" : ""}</Text>
                      )}
                    </View>
                    <Text style={styles.chevron}>{isExpanded ? "▼" : "›"}</Text>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.cardExpanded}>
                      <View style={styles.evvDetailGrid}>
                        <View style={styles.evvDetailItem}>
                          <Text style={styles.evvDetailLabel}>RBT Signature</Text>
                          <Text style={[styles.evvDetailValue, { color: evv.rbt_signature ? "#16a34a" : "#dc2626" }]}>
                            {evv.rbt_signature ? "✓ Signed" : "Missing"}
                          </Text>
                        </View>
                        <View style={styles.evvDetailItem}>
                          <Text style={styles.evvDetailLabel}>Guardian</Text>
                          <Text style={[styles.evvDetailValue, { color: evv.guardian_signature ? "#16a34a" : evv.guardian_unavailable ? "#d97706" : "#dc2626" }]}>
                            {evv.guardian_signature ? "✓ Signed" : evv.guardian_unavailable ? "Unavailable" : "Missing"}
                          </Text>
                        </View>
                        <View style={styles.evvDetailItem}>
                          <Text style={styles.evvDetailLabel}>Behaviors</Text>
                          <Text style={styles.evvDetailValue}>{evv.behaviors_recorded}</Text>
                        </View>
                        <View style={styles.evvDetailItem}>
                          <Text style={styles.evvDetailLabel}>Trials</Text>
                          <Text style={styles.evvDetailValue}>{evv.trials_recorded}</Text>
                        </View>
                      </View>

                      {evv.guardian_unavailable && evv.guardian_unavailable_reason && (
                        <Text style={styles.guardianReason}>ℹ️ {evv.guardian_unavailable_reason}</Text>
                      )}

                      {!hasEntry ? (
                        <TouchableOpacity
                          style={styles.createEntryBtn}
                          onPress={() => openConvertForm(evv)}>
                          <Text style={styles.createEntryBtnText}>+ Create Time Entry from this Visit</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.linkedText}>✓ Time entry created and linked</Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* TIME ENTRIES TAB */}
        {activeTab === "entries" && (
          <View>
            <Text style={styles.sectionLabel}>Your submitted time entries</Text>
            {timeEntries.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>⏱️</Text>
                <Text style={styles.emptyText}>No time entries yet</Text>
                <Text style={styles.emptySubText}>Create one from an EVV record in the EVV tab</Text>
              </View>
            )}
            {timeEntries.map(entry => {
              const isExpanded = expandedEntry === entry.id;
              return (
                <View key={entry.id} style={styles.card}>
                  <TouchableOpacity
                    style={styles.cardHeader}
                    onPress={() => setExpandedEntry(isExpanded ? null : entry.id)}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.cardClient}>{clientMap.get(entry.client_id) ?? "Unknown"}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[entry.status]}20` }]}>
                          <Text style={[styles.statusText, { color: STATUS_COLORS[entry.status] }]}>
                            {STATUS_LABELS[entry.status] ?? entry.status}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.cardMeta}>
                        📅 {entry.date} · ⏱️ {formatDuration(entry.duration_minutes)} · {entry.cpt_code}
                      </Text>
                      <Text style={styles.cardMeta}>{entry.session_type}</Text>
                      {entry.evv_record_id && (
                        <Text style={[styles.cardMeta, { color: "#7c3aed" }]}>🔗 Linked to EVV record</Text>
                      )}
                    </View>
                    <Text style={styles.chevron}>{isExpanded ? "▼" : "›"}</Text>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.cardExpanded}>
                      <View style={styles.evvDetailGrid}>
                        <View style={styles.evvDetailItem}>
                          <Text style={styles.evvDetailLabel}>Start</Text>
                          <Text style={styles.evvDetailValue}>{formatTime(entry.start_time)}</Text>
                        </View>
                        <View style={styles.evvDetailItem}>
                          <Text style={styles.evvDetailLabel}>End</Text>
                          <Text style={styles.evvDetailValue}>{formatTime(entry.end_time)}</Text>
                        </View>
                        {entry.drive_time_minutes > 0 && (
                          <View style={styles.evvDetailItem}>
                            <Text style={styles.evvDetailLabel}>Drive Time</Text>
                            <Text style={styles.evvDetailValue}>{entry.drive_time_minutes}min{entry.drive_time_billable ? " (billable)" : ""}</Text>
                          </View>
                        )}
                        {entry.location_name && (
                          <View style={styles.evvDetailItem}>
                            <Text style={styles.evvDetailLabel}>Location</Text>
                            <Text style={styles.evvDetailValue}>{entry.location_name}</Text>
                          </View>
                        )}
                      </View>

                      {entry.notes && (
                        <View style={styles.notesBox}>
                          <Text style={styles.evvDetailLabel}>Notes</Text>
                          <Text style={styles.notesText}>{entry.notes}</Text>
                        </View>
                      )}

                      {entry.status === "needs_correction" && entry.reviewer_notes && (
                        <View style={styles.correctionBox}>
                          <Text style={styles.correctionTitle}>⚠️ Correction Required</Text>
                          <Text style={styles.correctionText}>{entry.reviewer_notes}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* CONVERT EVV → TIME ENTRY MODAL */}
      <Modal
        visible={!!convertingEVV}
        animationType="slide"
        onRequestClose={() => setConvertingEVV(null)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setConvertingEVV(null)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create Time Entry</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            {convertingEVV && (
              <>
                {/* EVV SUMMARY */}
                <View style={styles.evvSummaryBox}>
                  <Text style={styles.evvSummaryTitle}>EVV Visit Data</Text>
                  <Text style={styles.evvSummaryClient}>
                    {convertingEVV.clients?.full_name ?? clientMap.get(convertingEVV.client_id) ?? "Unknown"}
                  </Text>
                  <View style={styles.evvSummaryGrid}>
                    <View style={styles.evvSummaryItem}>
                      <Text style={styles.evvSummaryLabel}>Date</Text>
                      <Text style={styles.evvSummaryValue}>{formatDate(convertingEVV.actual_start)}</Text>
                    </View>
                    <View style={styles.evvSummaryItem}>
                      <Text style={styles.evvSummaryLabel}>Duration</Text>
                      <Text style={styles.evvSummaryValue}>{formatDuration(convertingEVV.session_duration_minutes)}</Text>
                    </View>
                    <View style={styles.evvSummaryItem}>
                      <Text style={styles.evvSummaryLabel}>Start</Text>
                      <Text style={styles.evvSummaryValue}>{formatTime(convertingEVV.actual_start)}</Text>
                    </View>
                    <View style={styles.evvSummaryItem}>
                      <Text style={styles.evvSummaryLabel}>End</Text>
                      <Text style={styles.evvSummaryValue}>{formatTime(convertingEVV.actual_end)}</Text>
                    </View>
                    <View style={styles.evvSummaryItem}>
                      <Text style={styles.evvSummaryLabel}>Geofence</Text>
                      <Text style={[styles.evvSummaryValue, { color: convertingEVV.start_geofence_verified ? "#16a34a" : "#d97706" }]}>
                        {convertingEVV.start_geofence_verified ? "✓ Verified" : "⚠️ Not verified"}
                      </Text>
                    </View>
                    <View style={styles.evvSummaryItem}>
                      <Text style={styles.evvSummaryLabel}>Behaviors</Text>
                      <Text style={styles.evvSummaryValue}>{convertingEVV.behaviors_recorded}</Text>
                    </View>
                  </View>
                  {convertingEVV.location_name && (
                    <Text style={styles.evvSummaryLocation}>📍 {convertingEVV.location_name}</Text>
                  )}
                </View>

                {/* SESSION TYPE */}
                <Text style={styles.fieldLabel}>Session Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {SESSION_TYPES.map(t => (
                    <TouchableOpacity key={t}
                      style={[styles.chip, convertForm.session_type === t && styles.chipActive]}
                      onPress={() => setConvertForm(p => ({ ...p, session_type: t }))}>
                      <Text style={[styles.chipText, convertForm.session_type === t && styles.chipTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* CPT CODE */}
                <Text style={styles.fieldLabel}>CPT / Billing Code *</Text>
                {CPT_CODES.map(c => (
                  <TouchableOpacity key={c.code}
                    style={[styles.cptOption, convertForm.cpt_code === c.code && styles.cptOptionActive]}
                    onPress={() => setConvertForm(p => ({ ...p, cpt_code: c.code }))}>
                    <Text style={[styles.cptText, convertForm.cpt_code === c.code && styles.cptTextActive]}>{c.label}</Text>
                    {convertForm.cpt_code === c.code && <Text style={styles.cptCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}

                {/* DRIVE TIME */}
                {driveTimeEnabled && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.fieldLabel}>Drive Time (max {driveTimeMax} min)</Text>
                    <TextInput style={styles.textInput}
                      value={String(convertForm.drive_time_minutes)}
                      onChangeText={t => setConvertForm(p => ({ ...p, drive_time_minutes: Math.min(parseInt(t) || 0, driveTimeMax) }))}
                      keyboardType="numeric" placeholder="0 minutes" />
                    {convertForm.drive_time_minutes > 0 && (
                      <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>Billable drive time</Text>
                        <Switch value={convertForm.drive_time_billable}
                          onValueChange={v => setConvertForm(p => ({ ...p, drive_time_billable: v }))}
                          trackColor={{ true: "#2563eb" }} />
                      </View>
                    )}
                  </View>
                )}

                {/* NOTES */}
                <Text style={styles.fieldLabel}>Billing Notes (optional)</Text>
                <TextInput style={styles.notesInput}
                  value={convertForm.notes}
                  onChangeText={t => setConvertForm(p => ({ ...p, notes: t }))}
                  placeholder="Any notes for billing review..."
                  multiline numberOfLines={3} textAlignVertical="top" />

                {/* ACTIONS */}
                <TouchableOpacity
                  style={[styles.submitBtn, saving && { opacity: 0.6 }]}
                  onPress={() => createEntryFromEVV(true)}
                  disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit for Review</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.draftBtn, saving && { opacity: 0.6 }]}
                  onPress={() => createEntryFromEVV(false)}
                  disabled={saving}>
                  <Text style={styles.draftBtnText}>Save as Draft</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  statsRow: { flexDirection: "row", padding: 12, gap: 8 },
  statCard: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center" },
  statNum: { fontSize: 24, fontWeight: "900" },
  statLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", textAlign: "center", marginTop: 2 },
  statSub: { fontSize: 10, color: "#9ca3af", textAlign: "center", marginTop: 2 },
  tabs: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent", flexDirection: "row", justifyContent: "center", gap: 6 },
  tabActive: { borderBottomColor: "#2563eb" },
  tabText: { fontSize: 13, color: "#9ca3af", fontWeight: "500" },
  tabTextActive: { color: "#2563eb", fontWeight: "700" },
  tabBadge: { backgroundColor: "#7c3aed", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", marginBottom: 12, letterSpacing: 0.5 },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 14, color: "#9ca3af", textAlign: "center" },
  emptySubText: { fontSize: 12, color: "#d1d5db", textAlign: "center", marginTop: 4 },
  card: { backgroundColor: "#fff", borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden" },
  cardHighlight: { borderColor: "#c4b5fd", borderWidth: 1.5 },
  cardHeader: { padding: 14, flexDirection: "row", alignItems: "center" },
  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  cardClient: { fontSize: 15, fontWeight: "700", color: "#111827", flex: 1 },
  cardMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  cardExpanded: { borderTopWidth: 1, borderTopColor: "#f3f4f6", padding: 14 },
  chevron: { fontSize: 20, color: "#d1d5db", marginLeft: 8 },
  needsEntryBadge: { backgroundColor: "#ede9fe", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  needsEntryText: { fontSize: 10, fontWeight: "700", color: "#7c3aed" },
  doneBadge: { backgroundColor: "#dcfce7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  doneText: { fontSize: 10, fontWeight: "700", color: "#16a34a" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 10, fontWeight: "700" },
  evvDetailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  evvDetailItem: { backgroundColor: "#f9fafb", borderRadius: 8, padding: 10, minWidth: "45%", flex: 1 },
  evvDetailLabel: { fontSize: 10, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", marginBottom: 3 },
  evvDetailValue: { fontSize: 13, fontWeight: "600", color: "#111827" },
  guardianReason: { fontSize: 11, color: "#6b7280", marginBottom: 10, fontStyle: "italic" },
  createEntryBtn: { backgroundColor: "#2563eb", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  createEntryBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  linkedText: { fontSize: 13, color: "#16a34a", fontWeight: "600", textAlign: "center", paddingVertical: 8 },
  notesBox: { backgroundColor: "#f9fafb", borderRadius: 8, padding: 10, marginTop: 8 },
  notesText: { fontSize: 12, color: "#374151", marginTop: 4 },
  correctionBox: { backgroundColor: "#fef2f2", borderRadius: 8, padding: 10, marginTop: 8 },
  correctionTitle: { fontSize: 12, fontWeight: "700", color: "#dc2626", marginBottom: 4 },
  correctionText: { fontSize: 12, color: "#dc2626" },
  modalContainer: { flex: 1, backgroundColor: "#f9fafb" },
  modalHeader: { backgroundColor: "#1a2234", paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  modalClose: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  modalCloseText: { color: "#fff", fontSize: 18 },
  evvSummaryBox: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#e5e7eb" },
  evvSummaryTitle: { fontSize: 11, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", marginBottom: 6 },
  evvSummaryClient: { fontSize: 17, fontWeight: "800", color: "#111827", marginBottom: 12 },
  evvSummaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  evvSummaryItem: { minWidth: "45%", flex: 1 },
  evvSummaryLabel: { fontSize: 10, color: "#9ca3af", fontWeight: "600", textTransform: "uppercase" },
  evvSummaryValue: { fontSize: 14, fontWeight: "700", color: "#111827", marginTop: 2 },
  evvSummaryLocation: { fontSize: 12, color: "#6b7280", marginTop: 10 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#fff", marginRight: 8 },
  chipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { fontSize: 12, color: "#374151" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  cptOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 6, backgroundColor: "#fff" },
  cptOptionActive: { backgroundColor: "#eff6ff", borderColor: "#2563eb" },
  cptText: { fontSize: 13, color: "#374151", flex: 1 },
  cptTextActive: { color: "#2563eb", fontWeight: "600" },
  cptCheck: { color: "#2563eb", fontWeight: "700", fontSize: 16 },
  textInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: "#111827", marginBottom: 14, backgroundColor: "#fff" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  toggleLabel: { fontSize: 14, color: "#374151" },
  notesInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#111827", minHeight: 80, marginBottom: 20, backgroundColor: "#fff" },
  submitBtn: { backgroundColor: "#2563eb", paddingVertical: 16, borderRadius: 14, alignItems: "center", marginBottom: 10 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  draftBtn: { backgroundColor: "#f3f4f6", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  draftBtnText: { color: "#374151", fontSize: 15, fontWeight: "600" },
});