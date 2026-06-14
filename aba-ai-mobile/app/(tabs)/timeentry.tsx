import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, Switch, TextInput, Modal
} from "react-native";
import { supabase } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";

type Client = { id: string; full_name: string };
type ClientLocation = { id: string; name: string; address: string; city: string; state: string; latitude: number; longitude: number };
type EVVRecord = {
  id: string; client_id: string; date: string;
  actual_start: string; actual_end: string;
  session_duration_minutes: number; location_name: string | null;
  start_geofence_verified: boolean; rbt_signature: string | null;
  guardian_signature: string | null; guardian_unavailable: boolean;
  guardian_unavailable_reason: string | null;
  behaviors_recorded: number; trials_recorded: number;
  evv_status: string; time_entry_id: string | null;
  clients?: { full_name: string };
};
type TimeEntryLog = {
  id: string; client_id: string; date: string;
  start_time: string; end_time: string; duration_minutes: number;
  session_type: string; cpt_code: string | null;
  drive_time_minutes: number; drive_time_billable: boolean;
  notes: string | null; status: string; reviewer_notes: string | null;
  evv_record_id: string | null; location_name: string | null;
  geofence_verified: boolean; who_was_present: string[] | null;
  client_readiness: string | null; client_disposition: string | null;
  behaviors_worked_on: string[] | null; maladaptive_behaviors: string[] | null;
  progress_ratings: Record<string, string> | null;
  reinforcements_used: string | null; reinforcements_worked: boolean | null;
  reinforcements_timing: string | null; antecedents: string | null;
  clinical_notes: string | null;
};
type Behavior = { id: string; name: string; category: string };
type SkillTarget = { id: string; program_name: string; target_name: string };

const CPT_CODES = [
  { code: "97153", label: "97153 — Adaptive Behavior Treatment (RBT)" },
  { code: "97155", label: "97155 — Protocol Modification (BCBA)" },
  { code: "97156", label: "97156 — Family Guidance" },
  { code: "97151", label: "97151 — Behavior Identification" },
  { code: "97152", label: "97152 — Supporting Assessment" },
  { code: "T1016", label: "T1016 — Drive Time" },
];

const SESSION_TYPES = ["Direct Therapy", "Supervision", "Parent Training", "Assessment", "Telehealth"];
const PRESENT_OPTIONS = ["RBT", "Client", "BCBA", "Parent", "Caregiver", "Sibling"];
const READINESS_OPTIONS = ["Ready and engaged", "Took time to warm up", "Not ready / refused initially", "Came in escalated"];
const DISPOSITION_OPTIONS = ["Calm and regulated", "Neutral", "Slightly elevated", "Escalated"];
const PROGRESS_OPTIONS = ["Progress", "Same", "Regression"];
const REINFORCEMENT_TIMING = ["In the moment", "After task completion", "On a schedule", "Introduced later in session"];

const STATUS_COLORS: Record<string, string> = {
  draft: "#6b7280", pending: "#d97706", needs_correction: "#dc2626", approved: "#16a34a", billed: "#2563eb",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", pending: "Pending Review", needs_correction: "Needs Correction", approved: "Approved", billed: "Billed",
};

function fmt(minutes: number) { const h = Math.floor(minutes / 60); const m = minutes % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }); }

export default function TimeEntryScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [evvRecords, setEvvRecords] = useState<EVVRecord[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntryLog[]>([]);
  const [clientLocations, setClientLocations] = useState<ClientLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [driveTimeEnabled, setDriveTimeEnabled] = useState(false);
  const [driveTimeMax, setDriveTimeMax] = useState(120);
  const [activeTab, setActiveTab] = useState<"evv" | "entries" | "drive">("evv");
  const [expandedEVV, setExpandedEVV] = useState<string | null>(null);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  // Clinical data for convert form
  const [clientBehaviors, setClientBehaviors] = useState<Behavior[]>([]);
  const [clientSkills, setClientSkills] = useState<SkillTarget[]>([]);

  // Convert EVV → Time Entry
  const [convertingEVV, setConvertingEVV] = useState<EVVRecord | null>(null);
  const [convertStep, setConvertStep] = useState<"billing" | "clinical">("billing");
  const [saving, setSaving] = useState(false);
  const [convertForm, setConvertForm] = useState({
    session_type: "Direct Therapy", cpt_code: "97153",
    drive_time_minutes: 0, drive_time_billable: false, notes: "",
    behaviors_worked_on: [] as string[], maladaptive_behaviors: [] as string[],
    progress_ratings: {} as Record<string, string>,
    reinforcements_used: "", reinforcements_worked: null as boolean | null,
    reinforcements_timing: "", antecedents: "", who_was_present: [] as string[],
    client_readiness: "", client_disposition: "", clinical_notes: "",
  });

  // Drive time
  const [driveClient1, setDriveClient1] = useState<Client | null>(null);
  const [driveClient2, setDriveClient2] = useState<Client | null>(null);
  const [driveLocation1, setDriveLocation1] = useState<ClientLocation | null>(null);
  const [driveLocation2, setDriveLocation2] = useState<ClientLocation | null>(null);
  const [driveLocations1, setDriveLocations1] = useState<ClientLocation[]>([]);
  const [driveLocations2, setDriveLocations2] = useState<ClientLocation[]>([]);
  const [driveEstimatedMinutes, setDriveEstimatedMinutes] = useState<number | null>(null);
  const [driveActualMinutes, setDriveActualMinutes] = useState("");
  const [driveAdjustReason, setDriveAdjustReason] = useState("");
  const [driveCalculating, setDriveCalculating] = useState(false);
  const [driveSaving, setDriveSaving] = useState(false);
  const [driveStep, setDriveStep] = useState<"select" | "map" | "confirm">("select");

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
        supabase.from("evv_records").select("*, clients(full_name)")
          .eq("company_id", companyUser?.company_id).eq("rbt_id", user.id)
          .eq("evv_status", "complete").order("actual_start", { ascending: false }).limit(50),
        supabase.from("time_entry_logs").select("*")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("companies").select("drive_time_enabled, drive_time_max_minutes")
          .eq("id", companyUser?.company_id).single(),
      ]);
      setClients(clientData ?? []);
      setEvvRecords(evvData ?? []);
      setTimeEntries(entryData ?? []);
      setDriveTimeEnabled(company?.drive_time_enabled ?? false);
      setDriveTimeMax(company?.drive_time_max_minutes ?? 120);
    } catch (e) { console.log("Init error:", e); }
    setLoading(false);
  }

  async function loadClientData(clientId: string) {
    const [{ data: behaviors }, { data: skills }] = await Promise.all([
      supabase.from("custom_behaviors").select("id, name, category").eq("client_id", clientId).eq("is_active", true).order("display_order"),
      supabase.from("skill_targets").select("id, program_name, target_name").eq("client_id", clientId).eq("is_active", true).order("display_order"),
    ]);
    setClientBehaviors(behaviors ?? []);
    setClientSkills(skills ?? []);
  }

  async function loadLocationsForClient(clientId: string, which: 1 | 2) {
    const { data } = await supabase.from("client_locations").select("*")
      .eq("client_id", clientId).order("is_primary", { ascending: false });
    if (which === 1) setDriveLocations1(data ?? []);
    else setDriveLocations2(data ?? []);
  }

  async function openConvertForm(evv: EVVRecord) {
    setConvertingEVV(evv);
    setConvertStep("billing");
    setConvertForm({
      session_type: "Direct Therapy", cpt_code: "97153",
      drive_time_minutes: 0, drive_time_billable: false, notes: "",
      behaviors_worked_on: [], maladaptive_behaviors: [], progress_ratings: {},
      reinforcements_used: "", reinforcements_worked: null, reinforcements_timing: "",
      antecedents: "", who_was_present: [], client_readiness: "",
      client_disposition: "", clinical_notes: "",
    });
    await loadClientData(evv.client_id);
  }

  function toggleArr(arr: string[], val: string): string[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  }

  async function createEntryFromEVV(submitNow: boolean) {
    if (!convertingEVV) return;
    setSaving(true);

    const { data, error } = await supabase.from("time_entry_logs").insert({
      company_id: companyId, user_id: userId,
      client_id: convertingEVV.client_id, date: convertingEVV.date,
      start_time: convertingEVV.actual_start, end_time: convertingEVV.actual_end,
      duration_minutes: convertingEVV.session_duration_minutes,
      session_type: convertForm.session_type, cpt_code: convertForm.cpt_code,
      drive_time_minutes: convertForm.drive_time_minutes,
      drive_time_billable: convertForm.drive_time_billable,
      notes: convertForm.notes || null,
      status: submitNow ? "pending" : "draft",
      submitted_at: submitNow ? new Date().toISOString() : null,
      location_name: convertingEVV.location_name,
      geofence_verified: convertingEVV.start_geofence_verified,
      evv_record_id: convertingEVV.id,
      behaviors_worked_on: convertForm.behaviors_worked_on.length ? convertForm.behaviors_worked_on : null,
      maladaptive_behaviors: convertForm.maladaptive_behaviors.length ? convertForm.maladaptive_behaviors : null,
      progress_ratings: Object.keys(convertForm.progress_ratings).length ? convertForm.progress_ratings : null,
      reinforcements_used: convertForm.reinforcements_used || null,
      reinforcements_worked: convertForm.reinforcements_worked,
      reinforcements_timing: convertForm.reinforcements_timing || null,
      antecedents: convertForm.antecedents || null,
      who_was_present: convertForm.who_was_present.length ? convertForm.who_was_present : null,
      client_readiness: convertForm.client_readiness || null,
      client_disposition: convertForm.client_disposition || null,
      clinical_notes: convertForm.clinical_notes || null,
    }).select().single();

    if (error) { Alert.alert("Error", error.message); setSaving(false); return; }

    await supabase.from("evv_records").update({ time_entry_id: data.id }).eq("id", convertingEVV.id);

    setConvertingEVV(null);
    setSaving(false);
    setActiveTab("entries");
    await init();
    Alert.alert(submitNow ? "✅ Submitted!" : "💾 Saved!", submitNow ? "Time entry submitted for BCBA review." : "Time entry saved as draft.");
  }

  async function calculateDriveTime() {
    if (!driveLocation1 || !driveLocation2) return;
    setDriveCalculating(true);
    try {
      const lat1 = driveLocation1.latitude; const lon1 = driveLocation1.longitude;
      const lat2 = driveLocation2.latitude; const lon2 = driveLocation2.longitude;
      // Haversine distance → estimate drive time (assuming 30mph avg)
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
      const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distMiles = distKm * 0.621371;
      const estimatedMins = Math.round((distMiles / 30) * 60);
      setDriveEstimatedMinutes(estimatedMins);
      setDriveActualMinutes(String(estimatedMins));
      setDriveStep("map");
    } catch (e) { Alert.alert("Error", "Could not calculate drive time."); }
    setDriveCalculating(false);
  }

  async function submitDriveTime() {
    if (!driveLocation1 || !driveLocation2 || !driveClient1 || !driveClient2) return;
    setDriveSaving(true);
    const mins = parseInt(driveActualMinutes) || 0;
    const today = new Date().toISOString().split("T")[0];
    const now = new Date().toISOString();
    await supabase.from("time_entry_logs").insert({
      company_id: companyId, user_id: userId,
      client_id: driveClient1.id, date: today,
      start_time: now, end_time: now,
      duration_minutes: mins, session_type: "Drive Time",
      cpt_code: "T1016", drive_time_minutes: mins,
      drive_time_billable: true,
      notes: `Drive from ${driveClient1.full_name} (${driveLocation1.name}) to ${driveClient2.full_name} (${driveLocation2.name}).${driveAdjustReason ? ` Adjusted from ${driveEstimatedMinutes}min: ${driveAdjustReason}` : ""}`,
      status: "draft",
    });
    setDriveSaving(false);
    setDriveStep("select");
    setDriveClient1(null); setDriveClient2(null);
    setDriveLocation1(null); setDriveLocation2(null);
    setDriveEstimatedMinutes(null); setDriveActualMinutes(""); setDriveAdjustReason("");
    await init();
    Alert.alert("✅ Drive Time Saved", `${mins} minutes saved as draft time entry.`);
  }

  const clientMap = new Map(clients.map(c => [c.id, c.full_name]));
  const unbilledEVV = evvRecords.filter(e => !e.time_entry_id);
  const pendingCount = timeEntries.filter(e => e.status === "pending").length;

  if (loading) return <View style={s.center}><ActivityIndicator color="#2563eb" size="large" /></View>;

  return (
    <View style={s.container}>
      <AppHeader title="Time Entry & EVV" />

      {/* STATS */}
      <View style={s.statsRow}>
        {[
          { num: evvRecords.length, label: "EVV Complete", sub: unbilledEVV.length > 0 ? `${unbilledEVV.length} need entry` : undefined, bg: "#f5f3ff", color: "#7c3aed" },
          { num: pendingCount, label: "Pending", bg: "#fefce8", color: "#d97706" },
          { num: timeEntries.filter(e => e.status === "approved").length, label: "Approved", bg: "#f0fdf4", color: "#16a34a" },
        ].map(stat => (
          <View key={stat.label} style={[s.statCard, { backgroundColor: stat.bg }]}>
            <Text style={[s.statNum, { color: stat.color }]}>{stat.num}</Text>
            <Text style={[s.statLabel, { color: stat.color }]}>{stat.label}</Text>
            {stat.sub && <Text style={s.statSub}>{stat.sub}</Text>}
          </View>
        ))}
      </View>

      {/* TABS */}
      <View style={s.tabs}>
        {[
          { key: "evv", label: "📋 EVV", badge: unbilledEVV.length > 0 ? unbilledEVV.length : null, badgeColor: "#7c3aed" },
          { key: "entries", label: "⏱️ Entries", badge: pendingCount > 0 ? pendingCount : null, badgeColor: "#d97706" },
          { key: "drive", label: "🚗 Drive Time", badge: null, badgeColor: "#2563eb" },
        ].map(tab => (
          <TouchableOpacity key={tab.key} style={[s.tab, activeTab === tab.key && s.tabActive]}
            onPress={() => setActiveTab(tab.key as any)}>
            <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>{tab.label}</Text>
            {tab.badge && (
              <View style={[s.tabBadge, { backgroundColor: tab.badgeColor }]}>
                <Text style={s.tabBadgeText}>{tab.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>

        {/* EVV TAB */}
        {activeTab === "evv" && (
          <View>
            <Text style={s.sectionLabel}>Completed EVV visits — tap to create a billing entry</Text>
            {evvRecords.length === 0 && (
              <View style={s.empty}><Text style={s.emptyEmoji}>📋</Text><Text style={s.emptyText}>No completed EVV records yet</Text></View>
            )}
            {evvRecords.map(evv => {
              const hasEntry = !!evv.time_entry_id;
              const isExp = expandedEVV === evv.id;
              return (
                <View key={evv.id} style={[s.card, !hasEntry && s.cardHighlight]}>
                  <TouchableOpacity style={s.cardHeader} onPress={() => setExpandedEVV(isExp ? null : evv.id)}>
                    <View style={{ flex: 1 }}>
                      <View style={s.cardTitleRow}>
                        <Text style={s.cardClient}>{evv.clients?.full_name ?? clientMap.get(evv.client_id) ?? "Unknown"}</Text>
                        <View style={hasEntry ? s.doneBadge : s.needsEntryBadge}>
                          <Text style={hasEntry ? s.doneText : s.needsEntryText}>{hasEntry ? "✓ Done" : "Needs Entry"}</Text>
                        </View>
                      </View>
                      <Text style={s.cardMeta}>📅 {fmtDate(evv.actual_start)} · {fmtTime(evv.actual_start)}–{fmtTime(evv.actual_end)} · {fmt(evv.session_duration_minutes)}</Text>
                      {evv.location_name && <Text style={s.cardMeta}>📍 {evv.location_name}{evv.start_geofence_verified ? " ✓" : ""}</Text>}
                    </View>
                    <Text style={s.chevron}>{isExp ? "▼" : "›"}</Text>
                  </TouchableOpacity>
                  {isExp && (
                    <View style={s.cardExpanded}>
                      <View style={s.evvGrid}>
                        {[
                          { label: "RBT Sig", val: evv.rbt_signature ? "✓ Signed" : "Missing", color: evv.rbt_signature ? "#16a34a" : "#dc2626" },
                          { label: "Guardian", val: evv.guardian_signature ? "✓ Signed" : evv.guardian_unavailable ? "Unavailable" : "Missing", color: evv.guardian_signature ? "#16a34a" : "#d97706" },
                          { label: "Behaviors", val: String(evv.behaviors_recorded), color: "#111827" },
                          { label: "Trials", val: String(evv.trials_recorded), color: "#111827" },
                        ].map(item => (
                          <View key={item.label} style={s.evvItem}>
                            <Text style={s.evvItemLabel}>{item.label}</Text>
                            <Text style={[s.evvItemValue, { color: item.color }]}>{item.val}</Text>
                          </View>
                        ))}
                      </View>
                      {!hasEntry ? (
                        <TouchableOpacity style={s.createBtn} onPress={() => openConvertForm(evv)}>
                          <Text style={s.createBtnText}>+ Create Time Entry from this Visit</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={s.linkedText}>✓ Time entry created and linked</Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ENTRIES TAB */}
        {activeTab === "entries" && (
          <View>
            <Text style={s.sectionLabel}>Your submitted time entries</Text>
            {timeEntries.length === 0 && (
              <View style={s.empty}><Text style={s.emptyEmoji}>⏱️</Text><Text style={s.emptyText}>No time entries yet</Text></View>
            )}
            {timeEntries.map(entry => {
              const isExp = expandedEntry === entry.id;
              return (
                <View key={entry.id} style={s.card}>
                  <TouchableOpacity style={s.cardHeader} onPress={() => setExpandedEntry(isExp ? null : entry.id)}>
                    <View style={{ flex: 1 }}>
                      <View style={s.cardTitleRow}>
                        <Text style={s.cardClient}>{clientMap.get(entry.client_id) ?? "Unknown"}</Text>
                        <View style={[s.statusBadge, { backgroundColor: `${STATUS_COLORS[entry.status]}20` }]}>
                          <Text style={[s.statusText, { color: STATUS_COLORS[entry.status] }]}>{STATUS_LABELS[entry.status] ?? entry.status}</Text>
                        </View>
                      </View>
                      <Text style={s.cardMeta}>📅 {entry.date} · {fmt(entry.duration_minutes)} · {entry.cpt_code}</Text>
                      <Text style={s.cardMeta}>{entry.session_type}</Text>
                      {entry.evv_record_id && <Text style={[s.cardMeta, { color: "#7c3aed" }]}>🔗 Linked to EVV</Text>}
                    </View>
                    <Text style={s.chevron}>{isExp ? "▼" : "›"}</Text>
                  </TouchableOpacity>
                  {isExp && (
                    <View style={s.cardExpanded}>
                      {entry.who_was_present && entry.who_was_present.length > 0 && (
                        <View style={s.detailBox}><Text style={s.detailLabel}>Who Was Present</Text><Text style={s.detailValue}>{entry.who_was_present.join(", ")}</Text></View>
                      )}
                      {entry.client_readiness && (
                        <View style={s.detailBox}><Text style={s.detailLabel}>Client Readiness</Text><Text style={s.detailValue}>{entry.client_readiness}</Text></View>
                      )}
                      {entry.behaviors_worked_on && entry.behaviors_worked_on.length > 0 && (
                        <View style={[s.detailBox, { backgroundColor: "#f0fdf4" }]}>
                          <Text style={[s.detailLabel, { color: "#16a34a" }]}>Skill Targets</Text>
                          {entry.behaviors_worked_on.map(b => (
                            <View key={b} style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                              <Text style={[s.detailValue, { flex: 1 }]}>{b}</Text>
                              {entry.progress_ratings?.[b] && (
                                <Text style={{ fontSize: 11, fontWeight: "700", color: entry.progress_ratings[b] === "Progress" ? "#16a34a" : entry.progress_ratings[b] === "Regression" ? "#dc2626" : "#d97706" }}>
                                  {entry.progress_ratings[b]}
                                </Text>
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                      {entry.maladaptive_behaviors && entry.maladaptive_behaviors.length > 0 && (
                        <View style={[s.detailBox, { backgroundColor: "#fef2f2" }]}>
                          <Text style={[s.detailLabel, { color: "#dc2626" }]}>Maladaptive Behaviors</Text>
                          <Text style={s.detailValue}>{entry.maladaptive_behaviors.join(", ")}</Text>
                        </View>
                      )}
                      {entry.antecedents && (
                        <View style={[s.detailBox, { backgroundColor: "#fff7ed" }]}>
                          <Text style={[s.detailLabel, { color: "#d97706" }]}>Antecedents</Text>
                          <Text style={s.detailValue}>{entry.antecedents}</Text>
                        </View>
                      )}
                      {entry.reinforcements_used && (
                        <View style={[s.detailBox, { backgroundColor: "#f5f3ff" }]}>
                          <Text style={[s.detailLabel, { color: "#7c3aed" }]}>Reinforcements</Text>
                          <Text style={s.detailValue}>{entry.reinforcements_used}</Text>
                          {entry.reinforcements_timing && <Text style={[s.detailValue, { fontSize: 11, color: "#9ca3af" }]}>{entry.reinforcements_timing}</Text>}
                        </View>
                      )}
                      {entry.client_disposition && (
                        <View style={s.detailBox}><Text style={s.detailLabel}>Disposition at End</Text><Text style={s.detailValue}>{entry.client_disposition}</Text></View>
                      )}
                      {entry.clinical_notes && (
                        <View style={s.detailBox}><Text style={s.detailLabel}>Clinical Notes</Text><Text style={s.detailValue}>{entry.clinical_notes}</Text></View>
                      )}
                      {entry.status === "needs_correction" && entry.reviewer_notes && (
                        <View style={s.correctionBox}><Text style={s.correctionTitle}>⚠️ Correction Required</Text><Text style={s.correctionText}>{entry.reviewer_notes}</Text></View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* DRIVE TIME TAB */}
        {activeTab === "drive" && (
          <View>
            <Text style={s.sectionLabel}>Drive Time Between Clients</Text>
            <View style={[s.card, { padding: 16 }]}>
              <Text style={{ fontSize: 13, color: "#6b7280", marginBottom: 16, lineHeight: 20 }}>
                Select your first client's end location and second client's start location. We'll calculate the drive time and create a T1016 billing entry.
              </Text>

              {driveStep === "select" && (
                <>
                  {/* Client 1 */}
                  <Text style={s.fieldLabel}>From: First Client</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    {clients.map(c => (
                      <TouchableOpacity key={c.id}
                        style={[s.chip, driveClient1?.id === c.id && s.chipActive]}
                        onPress={async () => { setDriveClient1(c); setDriveLocation1(null); await loadLocationsForClient(c.id, 1); }}>
                        <Text style={[s.chipText, driveClient1?.id === c.id && s.chipTextActive]}>{c.full_name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {driveClient1 && driveLocations1.length > 0 && (
                    <>
                      <Text style={[s.fieldLabel, { marginTop: 8 }]}>From Location</Text>
                      {driveLocations1.map(loc => (
                        <TouchableOpacity key={loc.id}
                          style={[s.locationRow, driveLocation1?.id === loc.id && s.locationRowActive]}
                          onPress={() => setDriveLocation1(loc)}>
                          <Text style={s.locationName}>{loc.name}</Text>
                          <Text style={s.locationAddr}>{loc.address}, {loc.city}</Text>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}

                  {/* Client 2 */}
                  <Text style={[s.fieldLabel, { marginTop: 16 }]}>To: Second Client</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    {clients.map(c => (
                      <TouchableOpacity key={c.id}
                        style={[s.chip, driveClient2?.id === c.id && s.chipActive]}
                        onPress={async () => { setDriveClient2(c); setDriveLocation2(null); await loadLocationsForClient(c.id, 2); }}>
                        <Text style={[s.chipText, driveClient2?.id === c.id && s.chipTextActive]}>{c.full_name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {driveClient2 && driveLocations2.length > 0 && (
                    <>
                      <Text style={[s.fieldLabel, { marginTop: 8 }]}>To Location</Text>
                      {driveLocations2.map(loc => (
                        <TouchableOpacity key={loc.id}
                          style={[s.locationRow, driveLocation2?.id === loc.id && s.locationRowActive]}
                          onPress={() => setDriveLocation2(loc)}>
                          <Text style={s.locationName}>{loc.name}</Text>
                          <Text style={s.locationAddr}>{loc.address}, {loc.city}</Text>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}

                  <TouchableOpacity
                    style={[s.submitBtn, { marginTop: 20 }, (!driveLocation1 || !driveLocation2) && { opacity: 0.4 }]}
                    onPress={calculateDriveTime}
                    disabled={!driveLocation1 || !driveLocation2 || driveCalculating}>
                    {driveCalculating ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>📍 Calculate Drive Time</Text>}
                  </TouchableOpacity>
                </>
              )}

              {driveStep === "map" && driveEstimatedMinutes !== null && (
                <>
                  <View style={{ backgroundColor: "#eff6ff", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, color: "#6b7280", fontWeight: "700", textTransform: "uppercase" }}>Route Summary</Text>
                    <Text style={{ fontSize: 14, color: "#111827", marginTop: 6 }}>📍 {driveLocation1?.name} ({driveClient1?.full_name})</Text>
                    <Text style={{ fontSize: 13, color: "#9ca3af", marginLeft: 20 }}>↓</Text>
                    <Text style={{ fontSize: 14, color: "#111827" }}>📍 {driveLocation2?.name} ({driveClient2?.full_name})</Text>
                    <Text style={{ fontSize: 20, fontWeight: "900", color: "#2563eb", marginTop: 12 }}>~{driveEstimatedMinutes} min estimated</Text>
                    <Text style={{ fontSize: 11, color: "#9ca3af" }}>Based on straight-line distance at 30mph avg</Text>
                  </View>

                  <Text style={s.fieldLabel}>Actual Drive Time (minutes)</Text>
                  <TextInput style={s.textInput} value={driveActualMinutes}
                    onChangeText={setDriveActualMinutes} keyboardType="numeric"
                    placeholder="Adjust if needed..." />

                  {driveActualMinutes !== String(driveEstimatedMinutes) && (
                    <>
                      <Text style={s.fieldLabel}>Reason for Adjustment</Text>
                      <TextInput style={[s.textInput, { minHeight: 60 }]} value={driveAdjustReason}
                        onChangeText={setDriveAdjustReason} multiline
                        placeholder="Traffic, detour, road closure, etc..." />
                    </>
                  )}

                  <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                    <TouchableOpacity style={[s.draftBtn, { flex: 1 }]} onPress={() => setDriveStep("select")}>
                      <Text style={s.draftBtnText}>‹ Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.submitBtn, { flex: 2 }]} onPress={submitDriveTime} disabled={driveSaving}>
                      {driveSaving ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>✓ Save Drive Time Entry</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* CONVERT MODAL */}
      <Modal visible={!!convertingEVV} animationType="slide" onRequestClose={() => setConvertingEVV(null)}>
        <View style={s.modalContainer}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setConvertingEVV(null)} style={s.modalClose}>
              <Text style={s.modalCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>Create Time Entry</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Step tabs */}
          <View style={{ flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" }}>
            {[{ key: "billing", label: "1 Billing" }, { key: "clinical", label: "2 Clinical" }].map(st => (
              <TouchableOpacity key={st.key} style={[s.tab, convertStep === st.key && s.tabActive]}
                onPress={() => setConvertStep(st.key as any)}>
                <Text style={[s.tabText, convertStep === st.key && s.tabTextActive]}>{st.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            {convertingEVV && (
              <>
                {/* EVV Summary */}
                <View style={s.evvSummaryBox}>
                  <Text style={s.evvSummaryClient}>{convertingEVV.clients?.full_name ?? clientMap.get(convertingEVV.client_id) ?? "Unknown"}</Text>
                  <Text style={{ fontSize: 13, color: "#6b7280" }}>
                    {fmtDate(convertingEVV.actual_start)} · {fmtTime(convertingEVV.actual_start)}–{fmtTime(convertingEVV.actual_end)} · {fmt(convertingEVV.session_duration_minutes)}
                  </Text>
                  {convertingEVV.location_name && <Text style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>📍 {convertingEVV.location_name}</Text>}
                </View>

                {/* BILLING STEP */}
                {convertStep === "billing" && (
                  <>
                    <Text style={s.fieldLabel}>Session Type</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                      {SESSION_TYPES.map(t => (
                        <TouchableOpacity key={t} style={[s.chip, convertForm.session_type === t && s.chipActive]}
                          onPress={() => setConvertForm(p => ({ ...p, session_type: t }))}>
                          <Text style={[s.chipText, convertForm.session_type === t && s.chipTextActive]}>{t}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <Text style={s.fieldLabel}>CPT / Billing Code *</Text>
                    {CPT_CODES.map(c => (
                      <TouchableOpacity key={c.code} style={[s.cptOption, convertForm.cpt_code === c.code && s.cptOptionActive]}
                        onPress={() => setConvertForm(p => ({ ...p, cpt_code: c.code }))}>
                        <Text style={[s.cptText, convertForm.cpt_code === c.code && s.cptTextActive]}>{c.label}</Text>
                        {convertForm.cpt_code === c.code && <Text style={{ color: "#2563eb", fontWeight: "700" }}>✓</Text>}
                      </TouchableOpacity>
                    ))}

                    <Text style={[s.fieldLabel, { marginTop: 16 }]}>Who Was Present</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                      {PRESENT_OPTIONS.map(p => (
                        <TouchableOpacity key={p} style={[s.chip, convertForm.who_was_present.includes(p) && s.chipActive]}
                          onPress={() => setConvertForm(f => ({ ...f, who_was_present: toggleArr(f.who_was_present, p) }))}>
                          <Text style={[s.chipText, convertForm.who_was_present.includes(p) && s.chipTextActive]}>{p}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {driveTimeEnabled && (
                      <View style={{ marginBottom: 16 }}>
                        <Text style={s.fieldLabel}>Drive Time (max {driveTimeMax} min)</Text>
                        <TextInput style={s.textInput} value={String(convertForm.drive_time_minutes)}
                          onChangeText={t => setConvertForm(p => ({ ...p, drive_time_minutes: Math.min(parseInt(t) || 0, driveTimeMax) }))}
                          keyboardType="numeric" />
                        {convertForm.drive_time_minutes > 0 && (
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                            <Text style={{ fontSize: 14, color: "#374151" }}>Billable</Text>
                            <Switch value={convertForm.drive_time_billable}
                              onValueChange={v => setConvertForm(p => ({ ...p, drive_time_billable: v }))}
                              trackColor={{ true: "#2563eb" }} />
                          </View>
                        )}
                      </View>
                    )}

                    <Text style={s.fieldLabel}>Billing Notes</Text>
                    <TextInput style={[s.textInput, { minHeight: 60 }]} value={convertForm.notes}
                      onChangeText={t => setConvertForm(p => ({ ...p, notes: t }))}
                      placeholder="Notes for billing review..." multiline />

                    <TouchableOpacity style={[s.submitBtn, { marginTop: 16 }]} onPress={() => setConvertStep("clinical")}>
                      <Text style={s.submitBtnText}>Next: Clinical Notes →</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* CLINICAL STEP */}
                {convertStep === "clinical" && (
                  <>
                    <Text style={s.fieldLabel}>Client Readiness at Start</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                      {READINESS_OPTIONS.map(r => (
                        <TouchableOpacity key={r} style={[s.chip, convertForm.client_readiness === r && s.chipActive]}
                          onPress={() => setConvertForm(f => ({ ...f, client_readiness: f.client_readiness === r ? "" : r }))}>
                          <Text style={[s.chipText, convertForm.client_readiness === r && s.chipTextActive]}>{r}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {clientSkills.length > 0 && (
                      <>
                        <Text style={s.fieldLabel}>Skill Targets Worked On</Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                          {clientSkills.map(sk => {
                            const key = `${sk.program_name}: ${sk.target_name}`;
                            return (
                              <TouchableOpacity key={sk.id} style={[s.chip, convertForm.behaviors_worked_on.includes(key) && s.chipActive]}
                                onPress={() => setConvertForm(f => ({ ...f, behaviors_worked_on: toggleArr(f.behaviors_worked_on, key) }))}>
                                <Text style={[s.chipText, convertForm.behaviors_worked_on.includes(key) && s.chipTextActive]}>{key}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </>
                    )}

                    {convertForm.behaviors_worked_on.length > 0 && (
                      <>
                        <Text style={s.fieldLabel}>Progress Per Target</Text>
                        {convertForm.behaviors_worked_on.map(target => (
                          <View key={target} style={{ backgroundColor: "#f9fafb", borderRadius: 10, padding: 10, marginBottom: 8 }}>
                            <Text style={{ fontSize: 12, color: "#374151", marginBottom: 6 }}>{target}</Text>
                            <View style={{ flexDirection: "row", gap: 6 }}>
                              {PROGRESS_OPTIONS.map(p => (
                                <TouchableOpacity key={p}
                                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: convertForm.progress_ratings[target] === p ? (p === "Progress" ? "#16a34a" : p === "Regression" ? "#dc2626" : "#d97706") : "#e5e7eb", backgroundColor: convertForm.progress_ratings[target] === p ? (p === "Progress" ? "#16a34a" : p === "Regression" ? "#dc2626" : "#d97706") : "#fff" }}
                                  onPress={() => setConvertForm(f => ({ ...f, progress_ratings: { ...f.progress_ratings, [target]: p } }))}>
                                  <Text style={{ fontSize: 11, fontWeight: "600", color: convertForm.progress_ratings[target] === p ? "#fff" : "#374151" }}>{p}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        ))}
                      </>
                    )}

                    {clientBehaviors.length > 0 && (
                      <>
                        <Text style={s.fieldLabel}>Maladaptive Behaviors Observed</Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                          {clientBehaviors.map(b => (
                            <TouchableOpacity key={b.id} style={[s.chip, convertForm.maladaptive_behaviors.includes(b.name) && { ...s.chipActive, backgroundColor: "#fef2f2", borderColor: "#dc2626" }]}
                              onPress={() => setConvertForm(f => ({ ...f, maladaptive_behaviors: toggleArr(f.maladaptive_behaviors, b.name) }))}>
                              <Text style={[s.chipText, convertForm.maladaptive_behaviors.includes(b.name) && { color: "#dc2626" }]}>{b.name}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </>
                    )}

                    <Text style={s.fieldLabel}>Antecedents Noted</Text>
                    <TextInput style={[s.textInput, { minHeight: 60 }]} value={convertForm.antecedents}
                      onChangeText={t => setConvertForm(p => ({ ...p, antecedents: t }))}
                      placeholder="Environmental triggers, demands, transitions..." multiline />

                    <Text style={[s.fieldLabel, { marginTop: 4 }]}>Reinforcements Used</Text>
                    <TextInput style={s.textInput} value={convertForm.reinforcements_used}
                      onChangeText={t => setConvertForm(p => ({ ...p, reinforcements_used: t }))}
                      placeholder="iPad time, verbal praise, token board..." />

                    <Text style={s.fieldLabel}>When Introduced</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                      {REINFORCEMENT_TIMING.map(rt => (
                        <TouchableOpacity key={rt} style={[s.chip, convertForm.reinforcements_timing === rt && s.chipActive]}
                          onPress={() => setConvertForm(f => ({ ...f, reinforcements_timing: f.reinforcements_timing === rt ? "" : rt }))}>
                          <Text style={[s.chipText, convertForm.reinforcements_timing === rt && s.chipTextActive]}>{rt}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={s.fieldLabel}>Client Disposition When Leaving</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                      {DISPOSITION_OPTIONS.map(d => (
                        <TouchableOpacity key={d} style={[s.chip, convertForm.client_disposition === d && s.chipActive]}
                          onPress={() => setConvertForm(f => ({ ...f, client_disposition: f.client_disposition === d ? "" : d }))}>
                          <Text style={[s.chipText, convertForm.client_disposition === d && s.chipTextActive]}>{d}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={s.fieldLabel}>Clinical Session Notes</Text>
                    <TextInput style={[s.textInput, { minHeight: 80 }]} value={convertForm.clinical_notes}
                      onChangeText={t => setConvertForm(p => ({ ...p, clinical_notes: t }))}
                      placeholder="Overall session summary, follow-up items for BCBA..." multiline />

                    <TouchableOpacity style={[s.submitBtn, saving && { opacity: 0.6 }]}
                      onPress={() => createEntryFromEVV(true)} disabled={saving}>
                      {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Submit for Review</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.draftBtn, saving && { opacity: 0.6 }]}
                      onPress={() => createEntryFromEVV(false)} disabled={saving}>
                      <Text style={s.draftBtnText}>Save as Draft</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  statsRow: { flexDirection: "row", padding: 12, gap: 8 },
  statCard: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center" },
  statNum: { fontSize: 24, fontWeight: "900" },
  statLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", textAlign: "center", marginTop: 2 },
  statSub: { fontSize: 10, color: "#9ca3af", textAlign: "center", marginTop: 2 },
  tabs: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent", flexDirection: "row", justifyContent: "center", gap: 4 },
  tabActive: { borderBottomColor: "#2563eb" },
  tabText: { fontSize: 12, color: "#9ca3af", fontWeight: "500" },
  tabTextActive: { color: "#2563eb", fontWeight: "700" },
  tabBadge: { borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1 },
  tabBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", marginBottom: 12, letterSpacing: 0.5 },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 14, color: "#9ca3af", textAlign: "center" },
  card: { backgroundColor: "#fff", borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden" },
  cardHighlight: { borderColor: "#c4b5fd", borderWidth: 1.5 },
  cardHeader: { padding: 14, flexDirection: "row", alignItems: "center" },
  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  cardClient: { fontSize: 15, fontWeight: "700", color: "#111827", flex: 1 },
  cardMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  cardExpanded: { borderTopWidth: 1, borderTopColor: "#f3f4f6", padding: 14, gap: 8 },
  chevron: { fontSize: 20, color: "#d1d5db", marginLeft: 8 },
  needsEntryBadge: { backgroundColor: "#ede9fe", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  needsEntryText: { fontSize: 10, fontWeight: "700", color: "#7c3aed" },
  doneBadge: { backgroundColor: "#dcfce7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  doneText: { fontSize: 10, fontWeight: "700", color: "#16a34a" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 10, fontWeight: "700" },
  evvGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  evvItem: { backgroundColor: "#f9fafb", borderRadius: 8, padding: 10, minWidth: "45%", flex: 1 },
  evvItemLabel: { fontSize: 10, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", marginBottom: 3 },
  evvItemValue: { fontSize: 13, fontWeight: "600", color: "#111827" },
  createBtn: { backgroundColor: "#2563eb", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  createBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  linkedText: { fontSize: 13, color: "#16a34a", fontWeight: "600", textAlign: "center", paddingVertical: 8 },
  detailBox: { backgroundColor: "#f9fafb", borderRadius: 8, padding: 10 },
  detailLabel: { fontSize: 10, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", marginBottom: 4 },
  detailValue: { fontSize: 13, color: "#374151" },
  correctionBox: { backgroundColor: "#fef2f2", borderRadius: 8, padding: 10 },
  correctionTitle: { fontSize: 12, fontWeight: "700", color: "#dc2626", marginBottom: 4 },
  correctionText: { fontSize: 12, color: "#dc2626" },
  modalContainer: { flex: 1, backgroundColor: "#f9fafb" },
  modalHeader: { backgroundColor: "#1a2234", paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  modalClose: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  modalCloseText: { color: "#fff", fontSize: 18 },
  evvSummaryBox: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#e5e7eb" },
  evvSummaryClient: { fontSize: 17, fontWeight: "800", color: "#111827", marginBottom: 4 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#fff", marginRight: 8 },
  chipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { fontSize: 12, color: "#374151" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  cptOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 6, backgroundColor: "#fff" },
  cptOptionActive: { backgroundColor: "#eff6ff", borderColor: "#2563eb" },
  cptText: { fontSize: 13, color: "#374151", flex: 1 },
  cptTextActive: { color: "#2563eb", fontWeight: "600" },
  textInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#111827", marginBottom: 14, backgroundColor: "#fff" },
  submitBtn: { backgroundColor: "#2563eb", paddingVertical: 16, borderRadius: 14, alignItems: "center", marginBottom: 10 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  draftBtn: { backgroundColor: "#f3f4f6", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  draftBtnText: { color: "#374151", fontSize: 15, fontWeight: "600" },
  locationRow: { backgroundColor: "#fff", borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: "#e5e7eb" },
  locationRowActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  locationName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  locationAddr: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
});