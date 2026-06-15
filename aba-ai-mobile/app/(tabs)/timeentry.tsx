import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, Switch, TextInput, Modal
} from "react-native";
import { supabase } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";

type Client = { id: string; full_name: string };
type Authorization = {
  id: string; client_id: string; insurance_provider: string;
  cpt_code: string; start_date: string; end_date: string;
  total_units: number; used_units: number; status: string;
};
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
type SessionData = {
  id: string; behaviors_observed: string | null;
  interventions_used: string | null; programs_targeted: string | null;
  notes: string | null; cpt_code: string | null;
};
type TimeEntryLog = {
  id: string; client_id: string; date: string;
  start_time: string; end_time: string; duration_minutes: number;
  session_type: string; cpt_code: string | null;
  drive_time_minutes: number; status: string;
  reviewer_notes: string | null; evv_record_id: string | null;
  location_name: string | null; who_was_present: string[] | null;
  client_readiness: string | null; client_disposition: string | null;
  behaviors_worked_on: string[] | null; maladaptive_behaviors: string[] | null;
  progress_ratings: Record<string, string> | null;
  reinforcements_used: string | null; antecedents: string | null;
  clinical_notes: string | null;
  session_location: string | null; session_participants: string | null;
  evidence_of_readiness: string | null;
  intervention_techniques: string[] | null;
  client_response_to_interventions: string | null;
  evidence_of_response: string | null;
  reinforcement_timing: string | null;
  effect_of_reinforcement: string | null;
  treatment_progress: string | null;
  goal_mastery_status: string | null;
  skill_generalization: string | null;
  additional_information: string | null;
};
type ClientLocation = {
  id: string; name: string; address: string; city: string;
  latitude: number; longitude: number;
};

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
const INTERVENTION_OPTIONS = ["Redirection", "Planned ignoring", "Differential reinforcement", "Response blocking", "NCR", "Token economy", "Visual supports", "Prompting hierarchy"];
const CLIENT_RESPONSE_OPTIONS = ["Responded well", "Minimal response", "No response", "Negative response"];
const TREATMENT_PROGRESS_OPTIONS = ["Making progress", "Maintaining", "Regression noted", "Inconsistent"];
const MASTERY_OPTIONS = ["No goals mastered", "Partial mastery", "Goal mastered", "Multiple goals mastered"];
const GENERALIZATION_OPTIONS = ["Observed", "Not observed", "Partially observed"];
const TRANSITION_OPTIONS = ["Calm and regulated", "Slightly elevated", "Escalated", "Required additional support"];
const ANTECEDENT_OPTIONS = ["None observed", "Environmental distractions", "Task demands", "Transitions", "Peer interactions", "Physical discomfort", "Other"];

const STATUS_COLORS: Record<string, string> = {
  draft: "#6b7280", pending: "#d97706", needs_correction: "#dc2626",
  approved: "#16a34a", billed: "#2563eb",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", pending: "Pending Review",
  needs_correction: "Needs Correction", approved: "Approved", billed: "Billed",
};

function fmt(minutes: number) { const h = Math.floor(minutes / 60); const m = minutes % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }); }

type NewEntryStep = "select_client" | "select_auth" | "select_evv" | "clinical_notes" | "preview";
type MainTab = "evv" | "entries" | "drive";

export default function TimeEntryScreen() {
  const [userId, setUserId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>("evv");

  // Data
  const [clients, setClients] = useState<Client[]>([]);
  const [evvRecords, setEvvRecords] = useState<EVVRecord[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntryLog[]>([]);
  const [expandedEVV, setExpandedEVV] = useState<string | null>(null);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [driveTimeEnabled, setDriveTimeEnabled] = useState(false);
  const [driveTimeMax, setDriveTimeMax] = useState(120);

  // New entry flow
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [newEntryStep, setNewEntryStep] = useState<NewEntryStep>("select_client");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [selectedAuth, setSelectedAuth] = useState<Authorization | null>(null);
  const [clientEVVs, setClientEVVs] = useState<EVVRecord[]>([]);
  const [selectedEVV, setSelectedEVV] = useState<EVVRecord | null>(null);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [clinicalForm, setClinicalForm] = useState({
    session_type: "Direct Therapy", cpt_code: "97153",
    session_location: "", session_participants: "",
    who_was_present: [] as string[],
    client_readiness: "", evidence_of_readiness: "",
    antecedents: "",
    behaviors_worked_on: [] as string[],
    maladaptive_behaviors: [] as string[],
    progress_ratings: {} as Record<string, string>,
    intervention_techniques: [] as string[],
    client_response_to_interventions: "",
    evidence_of_response: "",
    reinforcements_used: "", reinforcement_timing: "",
    effect_of_reinforcement: "",
    reinforcements_worked: null as boolean | null,
    treatment_progress: "", goal_mastery_status: "",
    skill_generalization: "", client_disposition: "",
    additional_information: "",
    drive_time_minutes: 0, drive_time_billable: false,
    notes: "",
  });

  // Drive time
  const [driveClient1, setDriveClient1] = useState<Client | null>(null);
  const [driveClient2, setDriveClient2] = useState<Client | null>(null);
  const [driveLocation1, setDriveLocation1] = useState<ClientLocation | null>(null);
  const [driveLocation2, setDriveLocation2] = useState<ClientLocation | null>(null);
  const [driveLocations1, setDriveLocations1] = useState<ClientLocation[]>([]);
  const [driveLocations2, setDriveLocations2] = useState<ClientLocation[]>([]);
  const [driveEstimated, setDriveEstimated] = useState<number | null>(null);
  const [driveActual, setDriveActual] = useState("");
  const [driveReason, setDriveReason] = useState("");
  const [driveStep, setDriveStep] = useState<"select" | "confirm">("select");
  const [driveSaving, setDriveSaving] = useState(false);

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
        supabase.from("clients").select("id, full_name").eq("company_id", companyUser?.company_id).order("full_name"),
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

  // ── NEW ENTRY FLOW ──────────────────────────────────────

  async function selectClientForEntry(client: Client) {
    setSelectedClient(client);
    const { data } = await supabase
      .from("authorizations").select("*")
      .eq("client_id", client.id).eq("status", "approved")
      .order("end_date", { ascending: false });
    setAuthorizations(data ?? []);
    setNewEntryStep("select_auth");
  }

  async function selectAuth(auth: Authorization) {
    setSelectedAuth(auth);
    const { data } = await supabase
      .from("evv_records").select("*, clients(full_name)")
      .eq("client_id", auth.client_id).eq("evv_status", "complete")
      .gte("date", auth.start_date).lte("date", auth.end_date)
      .is("time_entry_id", null)
      .order("actual_start", { ascending: false });
    setClientEVVs(data ?? []);
    setNewEntryStep("select_evv");
  }

  async function selectEVV(evv: EVVRecord) {
    setSelectedEVV(evv);
    const { data: session } = await supabase
      .from("sessions").select("id, behaviors_observed, interventions_used, programs_targeted, notes, cpt_code")
      .eq("evv_record_id", evv.id).maybeSingle();
    setSessionData(session);
    setClinicalForm(prev => ({
      ...prev,
      cpt_code: selectedAuth?.cpt_code ?? "97153",
      session_location: evv.location_name ?? "",
      behaviors_worked_on: session?.programs_targeted
        ? session.programs_targeted.split(", ").filter(Boolean) : [],
      intervention_techniques: session?.interventions_used
        ? session.interventions_used.split(", ").filter(Boolean) : [],
      notes: session?.notes ?? "",
    }));
    setNewEntryStep("clinical_notes");
  }

  function toggleArr(arr: string[], val: string): string[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  }

  async function saveTimeEntry() {
    if (!selectedEVV || !selectedClient || !selectedAuth) return;
    setSaving(true);

    const { error } = await supabase.from("time_entry_logs").insert({
      company_id: companyId, user_id: userId,
      client_id: selectedClient.id,
      date: selectedEVV.date,
      start_time: selectedEVV.actual_start,
      end_time: selectedEVV.actual_end,
      duration_minutes: selectedEVV.session_duration_minutes,
      session_type: clinicalForm.session_type,
      cpt_code: clinicalForm.cpt_code,
      drive_time_minutes: clinicalForm.drive_time_minutes,
      drive_time_billable: clinicalForm.drive_time_billable,
      notes: clinicalForm.notes || null,
      status: "pending",
      submitted_at: new Date().toISOString(),
      location_name: selectedEVV.location_name,
      geofence_verified: selectedEVV.start_geofence_verified,
      evv_record_id: selectedEVV.id,
      session_location: clinicalForm.session_location || null,
      session_participants: clinicalForm.session_participants || null,
      who_was_present: clinicalForm.who_was_present.length ? clinicalForm.who_was_present : null,
      client_readiness: clinicalForm.client_readiness || null,
      evidence_of_readiness: clinicalForm.evidence_of_readiness || null,
      antecedents: clinicalForm.antecedents || null,
      behaviors_worked_on: clinicalForm.behaviors_worked_on.length ? clinicalForm.behaviors_worked_on : null,
      maladaptive_behaviors: clinicalForm.maladaptive_behaviors.length ? clinicalForm.maladaptive_behaviors : null,
      progress_ratings: Object.keys(clinicalForm.progress_ratings).length ? clinicalForm.progress_ratings : null,
      intervention_techniques: clinicalForm.intervention_techniques.length ? clinicalForm.intervention_techniques : null,
      client_response_to_interventions: clinicalForm.client_response_to_interventions || null,
      evidence_of_response: clinicalForm.evidence_of_response || null,
      reinforcements_used: clinicalForm.reinforcements_used || null,
      reinforcements_worked: clinicalForm.reinforcements_worked,
      reinforcement_timing: clinicalForm.reinforcement_timing || null,
      effect_of_reinforcement: clinicalForm.effect_of_reinforcement || null,
      treatment_progress: clinicalForm.treatment_progress || null,
      goal_mastery_status: clinicalForm.goal_mastery_status || null,
      skill_generalization: clinicalForm.skill_generalization || null,
      client_disposition: clinicalForm.client_disposition || null,
      additional_information: clinicalForm.additional_information || null,
    });

    if (error) { Alert.alert("Error", error.message); setSaving(false); return; }

    await supabase.from("evv_records").update({ time_entry_id: "pending" }).eq("id", selectedEVV.id);

    setSaving(false);
    setShowNewEntry(false);
    setNewEntryStep("select_client");
    setSelectedClient(null); setSelectedAuth(null); setSelectedEVV(null);
    setSessionData(null); setAgreedToTerms(false);
    await init();
    Alert.alert("✅ Submitted!", "Time entry submitted for BCBA review.");
  }

  // ── DRIVE TIME ──────────────────────────────────────────

  async function loadLocationsForClient(clientId: string, which: 1 | 2) {
    const { data } = await supabase.from("client_locations").select("*")
      .eq("client_id", clientId).order("is_primary", { ascending: false });
    if (which === 1) { setDriveLocations1(data ?? []); setDriveLocation1(null); }
    else { setDriveLocations2(data ?? []); setDriveLocation2(null); }
  }

  function calculateDriveTime() {
    if (!driveLocation1 || !driveLocation2) return;
    const R = 6371;
    const dLat = (driveLocation2.latitude - driveLocation1.latitude) * Math.PI / 180;
    const dLon = (driveLocation2.longitude - driveLocation1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(driveLocation1.latitude * Math.PI / 180) * Math.cos(driveLocation2.latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const mins = Math.round((distKm * 0.621371 / 30) * 60);
    setDriveEstimated(mins);
    setDriveActual(String(mins));
    setDriveStep("confirm");
  }

  async function submitDriveTime() {
    if (!driveLocation1 || !driveLocation2 || !driveClient1 || !driveClient2) return;
    setDriveSaving(true);
    const mins = parseInt(driveActual) || 0;
    const today = new Date().toISOString().split("T")[0];
    const now = new Date().toISOString();
    await supabase.from("time_entry_logs").insert({
      company_id: companyId, user_id: userId,
      client_id: driveClient1.id, date: today,
      start_time: now, end_time: now,
      duration_minutes: mins, session_type: "Drive Time",
      cpt_code: "T1016", drive_time_minutes: mins,
      drive_time_billable: true,
      notes: `Drive from ${driveClient1.full_name} (${driveLocation1.name}) to ${driveClient2.full_name} (${driveLocation2.name}).${driveReason ? ` Adjusted from ${driveEstimated}min: ${driveReason}` : ""}`,
      status: "draft",
    });
    setDriveSaving(false);
    setDriveStep("select");
    setDriveClient1(null); setDriveClient2(null);
    setDriveLocation1(null); setDriveLocation2(null);
    setDriveEstimated(null); setDriveActual(""); setDriveReason("");
    await init();
    Alert.alert("✅ Drive Time Saved", `${mins} min (T1016) saved as draft.`);
  }

  const clientMap = new Map(clients.map(c => [c.id, c.full_name]));
  const unbilledEVV = evvRecords.filter(e => !e.time_entry_id);
  const pendingCount = timeEntries.filter(e => e.status === "pending").length;

  if (loading) return <View style={s.center}><ActivityIndicator color="#2563eb" size="large" /></View>;

  const STEPS: NewEntryStep[] = ["select_client", "select_auth", "select_evv", "clinical_notes", "preview"];
  const STEP_LABELS = ["1 Client", "2 Service", "3 Session", "4 Notes", "5 Submit"];

  return (
    <View style={s.container}>
      <AppHeader title="Time Entry & EVV" />

      {/* STATS */}
      <View style={s.statsRow}>
        {[
          { num: evvRecords.length, label: "EVV", sub: unbilledEVV.length > 0 ? `${unbilledEVV.length} need entry` : undefined, bg: "#f5f3ff", color: "#7c3aed" },
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
          { key: "drive", label: "🚗 Drive", badge: null, badgeColor: "#2563eb" },
        ].map(tab => (
          <TouchableOpacity key={tab.key} style={[s.tab, activeTab === tab.key && s.tabActive]}
            onPress={() => setActiveTab(tab.key as MainTab)}>
            <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>{tab.label}</Text>
            {tab.badge && <View style={[s.tabBadge, { backgroundColor: tab.badgeColor }]}><Text style={s.tabBadgeText}>{tab.badge}</Text></View>}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>

        {/* NEW ENTRY BUTTON */}
        {!showNewEntry && (
          <TouchableOpacity style={s.newEntryBtn} onPress={() => { setShowNewEntry(true); setNewEntryStep("select_client"); }}>
            <Text style={s.newEntryBtnText}>+ New Time Entry</Text>
          </TouchableOpacity>
        )}

        {/* ── NEW ENTRY FLOW ── */}
        {showNewEntry && (
          <View style={s.flowCard}>
            {/* Step indicator */}
            <View style={s.stepRow}>
              {STEPS.map((step, i) => {
                const currentIdx = STEPS.indexOf(newEntryStep);
                const isDone = i < currentIdx;
                const isCurrent = step === newEntryStep;
                return (
                  <View key={step} style={[s.stepItem, isCurrent && s.stepItemActive, isDone && s.stepItemDone]}>
                    <Text style={[s.stepText, (isCurrent || isDone) && s.stepTextActive]}>
                      {isDone ? "✓" : STEP_LABELS[i]}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* STEP 1 — SELECT CLIENT */}
            {newEntryStep === "select_client" && (
              <View>
                <Text style={s.stepTitle}>Select Client</Text>
                <Text style={s.stepSub}>Who is this time entry for?</Text>
                {clients.map(client => (
                  <TouchableOpacity key={client.id} style={s.clientCard}
                    onPress={() => selectClientForEntry(client)}>
                    <View style={s.clientAvatar}>
                      <Text style={s.clientAvatarText}>{client.full_name.split(" ").map(n => n[0]).join("").slice(0, 2)}</Text>
                    </View>
                    <Text style={s.clientName}>{client.full_name}</Text>
                    <Text style={s.chevron}>›</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={s.cancelBtn} onPress={() => setShowNewEntry(false)}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 2 — SELECT AUTH */}
            {newEntryStep === "select_auth" && selectedClient && (
              <View>
                <TouchableOpacity onPress={() => setNewEntryStep("select_client")} style={s.backBtn}>
                  <Text style={s.backBtnText}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={s.stepTitle}>Select Service Authorization</Text>
                <Text style={s.stepSub}>{selectedClient.full_name}</Text>
                {authorizations.length === 0 ? (
                  <View style={s.empty}>
                    <Text style={s.emptyEmoji}>🏦</Text>
                    <Text style={s.emptyText}>No active authorizations found</Text>
                  </View>
                ) : authorizations.map(auth => (
                  <TouchableOpacity key={auth.id} style={s.authCard} onPress={() => selectAuth(auth)}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <Text style={s.authCode}>{auth.cpt_code}</Text>
                        <View style={s.activeBadge}><Text style={s.activeBadgeText}>Active</Text></View>
                      </View>
                      <Text style={s.authProvider}>{auth.insurance_provider}</Text>
                      <Text style={s.authDates}>{auth.start_date} → {auth.end_date}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={s.authUnitsLabel}>Units</Text>
                      <Text style={s.authUnits}>{auth.used_units}/{auth.total_units}</Text>
                      <Text style={s.authRemaining}>{auth.total_units - auth.used_units} left</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* STEP 3 — SELECT EVV */}
            {newEntryStep === "select_evv" && selectedAuth && (
              <View>
                <TouchableOpacity onPress={() => setNewEntryStep("select_auth")} style={s.backBtn}>
                  <Text style={s.backBtnText}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={s.stepTitle}>Select EVV Session</Text>
                <Text style={s.stepSub}>{selectedAuth.start_date} → {selectedAuth.end_date}</Text>
                {clientEVVs.length === 0 ? (
                  <View style={s.empty}>
                    <Text style={s.emptyEmoji}>📋</Text>
                    <Text style={s.emptyText}>No EVV sessions available in this auth period</Text>
                  </View>
                ) : clientEVVs.map(evv => (
                  <TouchableOpacity key={evv.id} style={s.evvSelectCard} onPress={() => selectEVV(evv)}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.evvSelectDate}>{fmtDate(evv.actual_start)}</Text>
                      <Text style={s.evvSelectTime}>{fmtTime(evv.actual_start)} – {fmtTime(evv.actual_end)} · {fmt(evv.session_duration_minutes)}</Text>
                      {evv.location_name && <Text style={s.evvSelectLocation}>📍 {evv.location_name}</Text>}
                    </View>
                    <Text style={s.codeTag}>{selectedAuth.cpt_code}</Text>
                    <Text style={s.chevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* STEP 4 — CLINICAL NOTES */}
            {newEntryStep === "clinical_notes" && selectedEVV && (
              <View>
                <TouchableOpacity onPress={() => setNewEntryStep("select_evv")} style={s.backBtn}>
                  <Text style={s.backBtnText}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={s.stepTitle}>Clinical Documentation</Text>

                {/* EVV Summary */}
                <View style={s.evvSummaryBox}>
                  <Text style={s.evvSummaryClient}>{selectedClient?.full_name}</Text>
                  <Text style={s.evvSummaryMeta}>{fmtDate(selectedEVV.actual_start)} · {fmtTime(selectedEVV.actual_start)}–{fmtTime(selectedEVV.actual_end)} · {fmt(selectedEVV.session_duration_minutes)}</Text>
                  <Text style={s.evvSummaryCode}>{selectedAuth?.cpt_code}</Text>
                </View>

                {sessionData && (
                  <View style={s.sessionDataBanner}>
                    <Text style={s.sessionDataText}>✓ Session data found — fields pre-populated from data collection</Text>
                  </View>
                )}

                {/* Session Type */}
                <Text style={s.fieldLabel}>Session Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {SESSION_TYPES.map(t => (
                    <TouchableOpacity key={t} style={[s.chip, clinicalForm.session_type === t && s.chipActive]}
                      onPress={() => setClinicalForm(p => ({ ...p, session_type: t }))}>
                      <Text style={[s.chipText, clinicalForm.session_type === t && s.chipTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* CPT Code */}
                <Text style={s.fieldLabel}>CPT / Billing Code</Text>
                {CPT_CODES.map(c => (
                  <TouchableOpacity key={c.code} style={[s.cptOption, clinicalForm.cpt_code === c.code && s.cptOptionActive]}
                    onPress={() => setClinicalForm(p => ({ ...p, cpt_code: c.code }))}>
                    <Text style={[s.cptText, clinicalForm.cpt_code === c.code && s.cptTextActive]}>{c.label}</Text>
                    {clinicalForm.cpt_code === c.code && <Text style={{ color: "#2563eb", fontWeight: "700" }}>✓</Text>}
                  </TouchableOpacity>
                ))}

                {/* Session Location */}
                <Text style={[s.fieldLabel, { marginTop: 8 }]}>Session Location *</Text>
                <TextInput style={s.textInput} value={clinicalForm.session_location}
                  onChangeText={t => setClinicalForm(p => ({ ...p, session_location: t }))}
                  placeholder="e.g. Home in the living room, bedroom" />

                {/* Session Participants */}
                <Text style={s.fieldLabel}>Session Participants *</Text>
                <TextInput style={s.textInput} value={clinicalForm.session_participants}
                  onChangeText={t => setClinicalForm(p => ({ ...p, session_participants: t }))}
                  placeholder="List participants and their relationships" />

                {/* Who Was Present */}
                <Text style={s.fieldLabel}>Who Was Present</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {PRESENT_OPTIONS.map(p => (
                    <TouchableOpacity key={p} style={[s.chip, clinicalForm.who_was_present.includes(p) && s.chipActive]}
                      onPress={() => setClinicalForm(f => ({ ...f, who_was_present: toggleArr(f.who_was_present, p) }))}>
                      <Text style={[s.chipText, clinicalForm.who_was_present.includes(p) && s.chipTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Client Readiness */}
                <Text style={s.fieldLabel}>Client Readiness *</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {READINESS_OPTIONS.map(r => (
                    <TouchableOpacity key={r} style={[s.chip, clinicalForm.client_readiness === r && s.chipActive]}
                      onPress={() => setClinicalForm(f => ({ ...f, client_readiness: f.client_readiness === r ? "" : r }))}>
                      <Text style={[s.chipText, clinicalForm.client_readiness === r && s.chipTextActive]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Evidence of Readiness */}
                <Text style={s.fieldLabel}>Evidence of Readiness *</Text>
                <TextInput style={s.textInput} value={clinicalForm.evidence_of_readiness}
                  onChangeText={t => setClinicalForm(p => ({ ...p, evidence_of_readiness: t }))}
                  placeholder="e.g. smiling, crying, calm" />

                {/* Antecedents */}
                <Text style={s.fieldLabel}>Antecedents / Barriers *</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {ANTECEDENT_OPTIONS.map(a => (
                    <TouchableOpacity key={a} style={[s.chip, clinicalForm.antecedents === a && s.chipActive]}
                      onPress={() => setClinicalForm(f => ({ ...f, antecedents: f.antecedents === a ? "" : a }))}>
                      <Text style={[s.chipText, clinicalForm.antecedents === a && s.chipTextActive]}>{a}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Skill Targets */}
                <Text style={s.fieldLabel}>Skill Target *</Text>
                <TextInput style={s.textInput} value={clinicalForm.behaviors_worked_on.join(", ")}
                  onChangeText={t => setClinicalForm(p => ({ ...p, behaviors_worked_on: t.split(", ").filter(Boolean) }))}
                  placeholder="Skill that was the focus of today's session" />

                {/* Progress Per Target */}
                {clinicalForm.behaviors_worked_on.length > 0 && (
                  <>
                    <Text style={s.fieldLabel}>Progress Per Target</Text>
                    {clinicalForm.behaviors_worked_on.map(target => (
                      <View key={target} style={{ backgroundColor: "#f9fafb", borderRadius: 10, padding: 10, marginBottom: 8 }}>
                        <Text style={{ fontSize: 12, color: "#374151", marginBottom: 6 }}>{target}</Text>
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          {PROGRESS_OPTIONS.map(p => (
                            <TouchableOpacity key={p}
                              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: clinicalForm.progress_ratings[target] === p ? (p === "Progress" ? "#16a34a" : p === "Regression" ? "#dc2626" : "#d97706") : "#e5e7eb", backgroundColor: clinicalForm.progress_ratings[target] === p ? (p === "Progress" ? "#16a34a" : p === "Regression" ? "#dc2626" : "#d97706") : "#fff" }}
                              onPress={() => setClinicalForm(f => ({ ...f, progress_ratings: { ...f.progress_ratings, [target]: p } }))}>
                              <Text style={{ fontSize: 11, fontWeight: "600", color: clinicalForm.progress_ratings[target] === p ? "#fff" : "#374151" }}>{p}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    ))}
                  </>
                )}

                {/* Maladaptive Behaviors */}
                <Text style={s.fieldLabel}>Maladaptive Behaviors Observed *</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {["None observed", "Aggression", "Self-injurious behavior", "Elopement", "Vocal disruption", "Property destruction", "Stereotypy", "Non-compliance", "Other"].map(b => (
                    <TouchableOpacity key={b}
                      style={[s.chip, clinicalForm.maladaptive_behaviors.includes(b) && { ...s.chipActive, backgroundColor: b === "None observed" ? "#2563eb" : "#fef2f2", borderColor: b === "None observed" ? "#2563eb" : "#dc2626" }]}
                      onPress={() => setClinicalForm(f => ({ ...f, maladaptive_behaviors: toggleArr(f.maladaptive_behaviors, b) }))}>
                      <Text style={[s.chipText, clinicalForm.maladaptive_behaviors.includes(b) && { color: b === "None observed" ? "#fff" : "#dc2626" }]}>{b}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Intervention Techniques */}
                <Text style={s.fieldLabel}>Intervention Techniques Used *</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {INTERVENTION_OPTIONS.map(i => (
                    <TouchableOpacity key={i} style={[s.chip, clinicalForm.intervention_techniques.includes(i) && s.chipActive]}
                      onPress={() => setClinicalForm(f => ({ ...f, intervention_techniques: toggleArr(f.intervention_techniques, i) }))}>
                      <Text style={[s.chipText, clinicalForm.intervention_techniques.includes(i) && s.chipTextActive]}>{i}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Client Response */}
                <Text style={s.fieldLabel}>Client Response to Interventions *</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {CLIENT_RESPONSE_OPTIONS.map(r => (
                    <TouchableOpacity key={r} style={[s.chip, clinicalForm.client_response_to_interventions === r && s.chipActive]}
                      onPress={() => setClinicalForm(f => ({ ...f, client_response_to_interventions: f.client_response_to_interventions === r ? "" : r }))}>
                      <Text style={[s.chipText, clinicalForm.client_response_to_interventions === r && s.chipTextActive]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Evidence of Response */}
                <Text style={s.fieldLabel}>Evidence of Response *</Text>
                <TextInput style={s.textInput} value={clinicalForm.evidence_of_response}
                  onChangeText={t => setClinicalForm(p => ({ ...p, evidence_of_response: t }))}
                  placeholder="e.g. engaging in task, refusal" />

                {/* Reinforcement Timing */}
                <Text style={s.fieldLabel}>Reinforcement Timing *</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {REINFORCEMENT_TIMING.map(rt => (
                    <TouchableOpacity key={rt} style={[s.chip, clinicalForm.reinforcement_timing === rt && s.chipActive]}
                      onPress={() => setClinicalForm(f => ({ ...f, reinforcement_timing: f.reinforcement_timing === rt ? "" : rt }))}>
                      <Text style={[s.chipText, clinicalForm.reinforcement_timing === rt && s.chipTextActive]}>{rt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Effect of Reinforcement */}
                <Text style={s.fieldLabel}>Effect of Reinforcement *</Text>
                <TextInput style={s.textInput} value={clinicalForm.effect_of_reinforcement}
                  onChangeText={t => setClinicalForm(p => ({ ...p, effect_of_reinforcement: t }))}
                  placeholder="Describe client behavior following reinforcement" />

                {/* Reinforcements Used */}
                <Text style={s.fieldLabel}>Reinforcements Used</Text>
                <TextInput style={s.textInput} value={clinicalForm.reinforcements_used}
                  onChangeText={t => setClinicalForm(p => ({ ...p, reinforcements_used: t }))}
                  placeholder="iPad time, verbal praise, token board..." />

                {/* Did they work */}
                <Text style={s.fieldLabel}>Did Reinforcements Work?</Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                  {["Yes", "No", "Partially"].map(opt => (
                    <TouchableOpacity key={opt}
                      style={[s.chip, clinicalForm.reinforcements_worked === (opt === "Yes" ? true : opt === "No" ? false : null) && s.chipActive]}
                      onPress={() => setClinicalForm(p => ({ ...p, reinforcements_worked: opt === "Yes" ? true : opt === "No" ? false : null }))}>
                      <Text style={[s.chipText, clinicalForm.reinforcements_worked === (opt === "Yes" ? true : opt === "No" ? false : null) && s.chipTextActive]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Treatment Progress */}
                <Text style={s.fieldLabel}>Treatment Progress *</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {TREATMENT_PROGRESS_OPTIONS.map(t => (
                    <TouchableOpacity key={t} style={[s.chip, clinicalForm.treatment_progress === t && s.chipActive]}
                      onPress={() => setClinicalForm(f => ({ ...f, treatment_progress: f.treatment_progress === t ? "" : t }))}>
                      <Text style={[s.chipText, clinicalForm.treatment_progress === t && s.chipTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Goal Mastery */}
                <Text style={s.fieldLabel}>Goal Mastery Status *</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {MASTERY_OPTIONS.map(m => (
                    <TouchableOpacity key={m} style={[s.chip, clinicalForm.goal_mastery_status === m && s.chipActive]}
                      onPress={() => setClinicalForm(f => ({ ...f, goal_mastery_status: f.goal_mastery_status === m ? "" : m }))}>
                      <Text style={[s.chipText, clinicalForm.goal_mastery_status === m && s.chipTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Skill Generalization */}
                <Text style={s.fieldLabel}>Skill Generalization *</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {GENERALIZATION_OPTIONS.map(g => (
                    <TouchableOpacity key={g} style={[s.chip, clinicalForm.skill_generalization === g && s.chipActive]}
                      onPress={() => setClinicalForm(f => ({ ...f, skill_generalization: f.skill_generalization === g ? "" : g }))}>
                      <Text style={[s.chipText, clinicalForm.skill_generalization === g && s.chipTextActive]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Client Transition */}
                <Text style={s.fieldLabel}>Client Transition from Session *</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {TRANSITION_OPTIONS.map(t => (
                    <TouchableOpacity key={t} style={[s.chip, clinicalForm.client_disposition === t && s.chipActive]}
                      onPress={() => setClinicalForm(f => ({ ...f, client_disposition: f.client_disposition === t ? "" : t }))}>
                      <Text style={[s.chipText, clinicalForm.client_disposition === t && s.chipTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Drive time */}
                {driveTimeEnabled && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={s.fieldLabel}>Drive Time (max {driveTimeMax} min)</Text>
                    <TextInput style={s.textInput} value={String(clinicalForm.drive_time_minutes)}
                      onChangeText={t => setClinicalForm(p => ({ ...p, drive_time_minutes: Math.min(parseInt(t) || 0, driveTimeMax) }))}
                      keyboardType="numeric" />
                    {clinicalForm.drive_time_minutes > 0 && (
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 14, color: "#374151" }}>Billable</Text>
                        <Switch value={clinicalForm.drive_time_billable}
                          onValueChange={v => setClinicalForm(p => ({ ...p, drive_time_billable: v }))}
                          trackColor={{ true: "#2563eb" }} />
                      </View>
                    )}
                  </View>
                )}

                {/* Additional Info */}
                <Text style={s.fieldLabel}>Additional Information</Text>
                <TextInput style={[s.textInput, { minHeight: 80 }]} value={clinicalForm.additional_information}
                  onChangeText={t => setClinicalForm(p => ({ ...p, additional_information: t }))}
                  placeholder="New behaviors observed, incidents, relevant events..."
                  multiline textAlignVertical="top" />

                <TouchableOpacity style={s.submitBtn} onPress={() => setNewEntryStep("preview")}>
                  <Text style={s.submitBtnText}>Preview Note →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 5 — PREVIEW + SIGN + SUBMIT */}
            {newEntryStep === "preview" && selectedEVV && selectedClient && (
              <View>
                <TouchableOpacity onPress={() => setNewEntryStep("clinical_notes")} style={s.backBtn}>
                  <Text style={s.backBtnText}>‹ Back to Edit</Text>
                </TouchableOpacity>
                <Text style={s.stepTitle}>Preview & Submit</Text>

                {/* Note preview */}
                <View style={s.previewCard}>
                  <Text style={s.previewClient}>{selectedClient.full_name}</Text>
                  <Text style={s.previewMeta}>{fmtDate(selectedEVV.actual_start)} · {fmtTime(selectedEVV.actual_start)}–{fmtTime(selectedEVV.actual_end)} · {fmt(selectedEVV.session_duration_minutes)}</Text>
                  <Text style={s.previewCode}>{clinicalForm.session_type} · {clinicalForm.cpt_code}</Text>

                  {[
                    { label: "Session Location", value: clinicalForm.session_location },
                    { label: "Session Participants", value: clinicalForm.session_participants },
                    { label: "Who Was Present", value: clinicalForm.who_was_present.join(", ") },
                    { label: "Client Readiness", value: clinicalForm.client_readiness },
                    { label: "Evidence of Readiness", value: clinicalForm.evidence_of_readiness },
                    { label: "Antecedents / Barriers", value: clinicalForm.antecedents },
                    { label: "Skill Targets", value: clinicalForm.behaviors_worked_on.join(", ") },
                    { label: "Maladaptive Behaviors", value: clinicalForm.maladaptive_behaviors.join(", ") },
                    { label: "Interventions", value: clinicalForm.intervention_techniques.join(", ") },
                    { label: "Client Response", value: clinicalForm.client_response_to_interventions },
                    { label: "Evidence of Response", value: clinicalForm.evidence_of_response },
                    { label: "Reinforcement Timing", value: clinicalForm.reinforcement_timing },
                    { label: "Effect of Reinforcement", value: clinicalForm.effect_of_reinforcement },
                    { label: "Reinforcements Used", value: clinicalForm.reinforcements_used },
                    { label: "Treatment Progress", value: clinicalForm.treatment_progress },
                    { label: "Goal Mastery", value: clinicalForm.goal_mastery_status },
                    { label: "Skill Generalization", value: clinicalForm.skill_generalization },
                    { label: "Client Transition", value: clinicalForm.client_disposition },
                    { label: "Additional Info", value: clinicalForm.additional_information },
                  ].filter(f => f.value).map(field => (
                    <View key={field.label} style={s.previewField}>
                      <Text style={s.previewFieldLabel}>{field.label}</Text>
                      <Text style={s.previewFieldValue}>{field.value}</Text>
                    </View>
                  ))}
                </View>

                {/* Electronic signature */}
                <View style={s.signatureBox}>
                  <Text style={s.signatureText}>
                    By checking this box I am electronically signing this time entry and attest that I am the service provider for the above client. I have reviewed the time entry details above and performed the services as described for the entire duration from start to end time. I understand that deliberately submitting information that is not accurate constitutes fraud and will result in employment termination and may be punishable by state and federal laws.
                  </Text>
                  <TouchableOpacity style={s.agreeRow} onPress={() => setAgreedToTerms(a => !a)}>
                    <View style={[s.checkbox, agreedToTerms && s.checkboxChecked]}>
                      {agreedToTerms && <Text style={s.checkboxCheck}>✓</Text>}
                    </View>
                    <Text style={s.agreeText}>I agree to the terms</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[s.submitBtn, (!agreedToTerms || saving) && { opacity: 0.4 }]}
                  onPress={saveTimeEntry}
                  disabled={!agreedToTerms || saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Submit Time Entry</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ── EVV TAB ── */}
        {!showNewEntry && activeTab === "evv" && (
          <View>
            <Text style={s.sectionLabel}>Completed EVV visits</Text>
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
                      {evv.location_name && <Text style={s.cardMeta}>📍 {evv.location_name}</Text>}
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
                        <TouchableOpacity style={s.createBtn} onPress={() => { setShowNewEntry(true); setNewEntryStep("select_client"); }}>
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

        {/* ── ENTRIES TAB ── */}
        {!showNewEntry && activeTab === "entries" && (
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
                      <Text style={s.cardMeta}>📅 {entry.date} · {fmt(entry.duration_minutes)}</Text>
                      <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
                        <Text style={s.cardMeta}>{entry.session_type}</Text>
                        {entry.cpt_code && <Text style={s.codeTag}>{entry.cpt_code}</Text>}
                      </View>
                      {entry.evv_record_id && <Text style={[s.cardMeta, { color: "#7c3aed" }]}>🔗 Linked to EVV</Text>}
                    </View>
                    <Text style={s.chevron}>{isExp ? "▼" : "›"}</Text>
                  </TouchableOpacity>
                  {isExp && (
                    <View style={s.cardExpanded}>
                      {[
                        { label: "Session Location", value: entry.session_location },
                        { label: "Session Participants", value: entry.session_participants },
                        { label: "Who Was Present", value: entry.who_was_present?.join(", ") },
                        { label: "Client Readiness", value: entry.client_readiness },
                        { label: "Evidence of Readiness", value: entry.evidence_of_readiness },
                        { label: "Antecedents", value: entry.antecedents },
                        { label: "Client Response", value: entry.client_response_to_interventions },
                        { label: "Evidence of Response", value: entry.evidence_of_response },
                        { label: "Reinforcements Used", value: entry.reinforcements_used },
                        { label: "Reinforcement Timing", value: entry.reinforcement_timing },
                        { label: "Effect of Reinforcement", value: entry.effect_of_reinforcement },
                        { label: "Treatment Progress", value: entry.treatment_progress },
                        { label: "Goal Mastery", value: entry.goal_mastery_status },
                        { label: "Skill Generalization", value: entry.skill_generalization },
                        { label: "Client Transition", value: entry.client_disposition },
                        { label: "Additional Info", value: entry.additional_information },
                      ].filter(f => f.value).map(field => (
                        <View key={field.label} style={s.detailBox}>
                          <Text style={s.detailLabel}>{field.label}</Text>
                          <Text style={s.detailValue}>{field.value}</Text>
                        </View>
                      ))}
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
                      {entry.intervention_techniques && entry.intervention_techniques.length > 0 && (
                        <View style={s.detailBox}>
                          <Text style={s.detailLabel}>Intervention Techniques</Text>
                          <Text style={s.detailValue}>{entry.intervention_techniques.join(", ")}</Text>
                        </View>
                      )}
                      {entry.status === "needs_correction" && entry.reviewer_notes && (
                        <View style={s.correctionBox}>
                          <Text style={s.correctionTitle}>⚠️ Correction Required</Text>
                          <Text style={s.correctionText}>{entry.reviewer_notes}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ── DRIVE TIME TAB ── */}
        {!showNewEntry && activeTab === "drive" && (
          <View>
            <Text style={s.sectionLabel}>Drive Time Between Clients</Text>
            <View style={[s.card, { padding: 16 }]}>
              <Text style={{ fontSize: 13, color: "#6b7280", marginBottom: 16, lineHeight: 20 }}>
                Select your first and second client locations. We'll calculate drive time and create a <Text style={{ fontWeight: "700", color: "#2563eb" }}>T1016</Text> billing entry.
              </Text>

              {driveStep === "select" && (
                <>
                  <Text style={s.fieldLabel}>From: First Client</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    {clients.map(c => (
                      <TouchableOpacity key={c.id}
                        style={[s.chip, driveClient1?.id === c.id && s.chipActive]}
                        onPress={async () => { setDriveClient1(c); await loadLocationsForClient(c.id, 1); }}>
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

                  <Text style={[s.fieldLabel, { marginTop: 16 }]}>To: Second Client</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    {clients.map(c => (
                      <TouchableOpacity key={c.id}
                        style={[s.chip, driveClient2?.id === c.id && s.chipActive]}
                        onPress={async () => { setDriveClient2(c); await loadLocationsForClient(c.id, 2); }}>
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
                    disabled={!driveLocation1 || !driveLocation2}>
                    <Text style={s.submitBtnText}>📍 Calculate Drive Time</Text>
                  </TouchableOpacity>
                </>
              )}

              {driveStep === "confirm" && driveEstimated !== null && (
                <>
                  <View style={{ backgroundColor: "#eff6ff", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, color: "#6b7280", fontWeight: "700", textTransform: "uppercase" }}>Route Summary</Text>
                    <Text style={{ fontSize: 14, color: "#111827", marginTop: 6 }}>📍 {driveLocation1?.name} ({driveClient1?.full_name})</Text>
                    <Text style={{ fontSize: 13, color: "#9ca3af", marginLeft: 20 }}>↓</Text>
                    <Text style={{ fontSize: 14, color: "#111827" }}>📍 {driveLocation2?.name} ({driveClient2?.full_name})</Text>
                    <Text style={{ fontSize: 20, fontWeight: "900", color: "#2563eb", marginTop: 12 }}>~{driveEstimated} min estimated</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <Text style={s.codeTag}>T1016</Text>
                      <Text style={{ fontSize: 11, color: "#9ca3af" }}>Drive Time billing code</Text>
                    </View>
                  </View>

                  <Text style={s.fieldLabel}>Actual Drive Time (minutes)</Text>
                  <TextInput style={s.textInput} value={driveActual}
                    onChangeText={setDriveActual} keyboardType="numeric" />

                  {driveActual !== String(driveEstimated) && (
                    <>
                      <Text style={s.fieldLabel}>Reason for Adjustment</Text>
                      <TextInput style={[s.textInput, { minHeight: 60 }]} value={driveReason}
                        onChangeText={setDriveReason} multiline
                        placeholder="Traffic, detour, road closure, etc..." />
                    </>
                  )}

                  <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                    <TouchableOpacity style={[s.draftBtn, { flex: 1 }]} onPress={() => setDriveStep("select")}>
                      <Text style={s.draftBtnText}>‹ Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.submitBtn, { flex: 2 }]} onPress={submitDriveTime} disabled={driveSaving}>
                      {driveSaving ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>✓ Save Drive Time (T1016)</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  statsRow: { flexDirection: "row", padding: 12, gap: 8 },
  statCard: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "900" },
  statLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", textAlign: "center", marginTop: 2 },
  statSub: { fontSize: 9, color: "#9ca3af", textAlign: "center", marginTop: 2 },
  tabs: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent", flexDirection: "row", justifyContent: "center", gap: 4 },
  tabActive: { borderBottomColor: "#2563eb" },
  tabText: { fontSize: 12, color: "#9ca3af", fontWeight: "500" },
  tabTextActive: { color: "#2563eb", fontWeight: "700" },
  tabBadge: { borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1 },
  tabBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  newEntryBtn: { backgroundColor: "#2563eb", paddingVertical: 14, borderRadius: 14, alignItems: "center", marginBottom: 16 },
  newEntryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  flowCard: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#dbeafe", marginBottom: 16, overflow: "hidden" },
  stepRow: { flexDirection: "row", backgroundColor: "#eff6ff", borderBottomWidth: 1, borderBottomColor: "#dbeafe" },
  stepItem: { flex: 1, paddingVertical: 8, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  stepItemActive: { borderBottomColor: "#2563eb" },
  stepItemDone: { borderBottomColor: "#16a34a" },
  stepText: { fontSize: 9, color: "#9ca3af", fontWeight: "600", textAlign: "center" },
  stepTextActive: { color: "#2563eb", fontWeight: "700" },
  stepTitle: { fontSize: 17, fontWeight: "800", color: "#111827", margin: 16, marginBottom: 4 },
  stepSub: { fontSize: 13, color: "#6b7280", marginHorizontal: 16, marginBottom: 16 },
  clientCard: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", gap: 12 },
  clientAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center" },
  clientAvatarText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  clientName: { flex: 1, fontSize: 15, fontWeight: "600", color: "#111827" },
  authCard: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", gap: 12 },
  authCode: { fontSize: 14, fontWeight: "800", color: "#2563eb", fontFamily: "monospace" },
  authProvider: { fontSize: 13, color: "#374151", marginTop: 2 },
  authDates: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  authUnitsLabel: { fontSize: 10, color: "#9ca3af", fontWeight: "600" },
  authUnits: { fontSize: 16, fontWeight: "800", color: "#111827" },
  authRemaining: { fontSize: 10, color: "#16a34a", fontWeight: "600" },
  activeBadge: { backgroundColor: "#dcfce7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  activeBadgeText: { fontSize: 9, fontWeight: "700", color: "#16a34a" },
  evvSelectCard: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", gap: 8 },
  evvSelectDate: { fontSize: 15, fontWeight: "700", color: "#111827" },
  evvSelectTime: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  evvSelectLocation: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  evvSummaryBox: { margin: 16, backgroundColor: "#1a2234", borderRadius: 12, padding: 14 },
  evvSummaryClient: { fontSize: 16, fontWeight: "800", color: "#fff", marginBottom: 4 },
  evvSummaryMeta: { fontSize: 12, color: "#93c5fd" },
  evvSummaryCode: { fontSize: 12, fontWeight: "700", color: "#60a5fa", marginTop: 4, fontFamily: "monospace" },
  sessionDataBanner: { marginHorizontal: 16, marginBottom: 8, backgroundColor: "#f0fdf4", borderRadius: 8, padding: 10 },
  sessionDataText: { fontSize: 12, color: "#16a34a", fontWeight: "600" },
  previewCard: { margin: 16, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e5e7eb", padding: 16 },
  previewClient: { fontSize: 17, fontWeight: "800", color: "#111827", marginBottom: 4 },
  previewMeta: { fontSize: 13, color: "#6b7280" },
  previewCode: { fontSize: 12, color: "#2563eb", fontWeight: "700", marginTop: 4, marginBottom: 12, fontFamily: "monospace" },
  previewField: { borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingTop: 8, marginTop: 8 },
  previewFieldLabel: { fontSize: 10, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", marginBottom: 2 },
  previewFieldValue: { fontSize: 13, color: "#374151" },
  signatureBox: { margin: 16, backgroundColor: "#f9fafb", borderRadius: 14, borderWidth: 1, borderColor: "#e5e7eb", padding: 16 },
  signatureText: { fontSize: 12, color: "#374151", lineHeight: 18, marginBottom: 16 },
  agreeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: "#d1d5db", alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  checkboxCheck: { color: "#fff", fontSize: 13, fontWeight: "800" },
  agreeText: { fontSize: 14, fontWeight: "600", color: "#374151" },
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
  codeTag: { fontSize: 11, fontWeight: "800", color: "#2563eb", backgroundColor: "#eff6ff", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, fontFamily: "monospace" },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5, marginHorizontal: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#fff", marginRight: 8, marginLeft: 16 },
  chipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { fontSize: 12, color: "#374151" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  cptOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, marginHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 6, backgroundColor: "#fff" },
  cptOptionActive: { backgroundColor: "#eff6ff", borderColor: "#2563eb" },
  cptText: { fontSize: 13, color: "#374151", flex: 1 },
  cptTextActive: { color: "#2563eb", fontWeight: "600" },
  textInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#111827", marginBottom: 14, backgroundColor: "#fff", marginHorizontal: 16 },
  submitBtn: { backgroundColor: "#2563eb", paddingVertical: 16, borderRadius: 14, alignItems: "center", marginBottom: 10, marginHorizontal: 16 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  draftBtn: { backgroundColor: "#f3f4f6", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  draftBtnText: { color: "#374151", fontSize: 15, fontWeight: "600" },
  backBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  backBtnText: { color: "#2563eb", fontSize: 13, fontWeight: "600" },
  cancelBtn: { margin: 16, paddingVertical: 14, borderRadius: 14, alignItems: "center", borderWidth: 1, borderColor: "#e5e7eb" },
  cancelBtnText: { color: "#6b7280", fontSize: 15, fontWeight: "600" },
  locationRow: { backgroundColor: "#fff", borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: "#e5e7eb", marginHorizontal: 16 },
  locationRowActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  locationName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  locationAddr: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
});