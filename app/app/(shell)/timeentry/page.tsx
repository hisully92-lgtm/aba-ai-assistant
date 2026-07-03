"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import AppShell from "@/components/app/AppShell";

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
type ClientLocation = { id: string; name: string; address: string; city: string; latitude: number; longitude: number };

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
const PROGRESS_OPTIONS = ["Progress", "Same", "Regression"];
const REINFORCEMENT_TIMING = ["In the moment", "After task completion", "On a schedule", "Introduced later in session"];
const INTERVENTION_OPTIONS = ["Redirection", "Planned ignoring", "Differential reinforcement", "Response blocking", "NCR", "Token economy", "Visual supports", "Prompting hierarchy"];
const CLIENT_RESPONSE_OPTIONS = ["Responded well", "Minimal response", "No response", "Negative response"];
const TREATMENT_PROGRESS_OPTIONS = ["Making progress", "Maintaining", "Regression noted", "Inconsistent"];
const MASTERY_OPTIONS = ["No goals mastered", "Partial mastery", "Goal mastered", "Multiple goals mastered"];
const GENERALIZATION_OPTIONS = ["Observed", "Not observed", "Partially observed"];
const TRANSITION_OPTIONS = ["Calm and regulated", "Slightly elevated", "Escalated", "Required additional support"];
const ANTECEDENT_OPTIONS = ["None observed", "Environmental distractions", "Task demands", "Transitions", "Peer interactions", "Physical discomfort", "Other"];
const MALADAPTIVE_OPTIONS = ["None observed", "Aggression", "Self-injurious behavior", "Elopement", "Vocal disruption", "Property destruction", "Stereotypy", "Non-compliance", "Other"];

const STATUS_COLORS: Record<string, string> = { draft: "#6b7280", pending: "#d97706", needs_correction: "#dc2626", approved: "#16a34a", billed: "#2563eb" };
const STATUS_LABELS: Record<string, string> = { draft: "Draft", pending: "Pending Review", needs_correction: "Needs Correction", approved: "Approved", billed: "Billed" };

function fmt(minutes: number) { const h = Math.floor(minutes / 60); const m = minutes % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }); }

type NewEntryStep = "select_client" | "select_auth" | "select_evv" | "clinical_notes" | "preview";
type MainTab = "evv" | "entries" | "drive";

function Chip({ label, active, onClick, activeStyle }: { label: string; active: boolean; onClick: () => void; activeStyle?: React.CSSProperties }) {
  return (
    <button onClick={onClick} className="px-3 py-2 rounded-full border text-xs whitespace-nowrap mr-2 mb-2"
      style={active ? { backgroundColor: "#2563eb", borderColor: "#2563eb", color: "#fff", fontWeight: 600, ...activeStyle } : { borderColor: "#d1d5db", color: "#374151", backgroundColor: "#fff" }}>
      {label}
    </button>
  );
}

export default function TimeEntryPage() {
  const [userId, setUserId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>("evv");

  const [clients, setClients] = useState<Client[]>([]);
  const [evvRecords, setEvvRecords] = useState<EVVRecord[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntryLog[]>([]);
  const [expandedEVV, setExpandedEVV] = useState<string | null>(null);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [driveTimeEnabled, setDriveTimeEnabled] = useState(false);
  const [driveTimeMax, setDriveTimeMax] = useState(120);

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
  const [noteOptions, setNoteOptions] = useState<Record<string, string[]>>({});

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const { data: companyUser } = await supabase.from("company_users").select("company_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
    setCompanyId(companyUser?.company_id ?? "");
    await loadNoteOptions(companyUser?.company_id);

    try {
      const [{ data: clientData }, { data: evvData }, { data: entryData }, { data: company }] = await Promise.all([
        supabase.from("clients").select("id, full_name").eq("company_id", companyUser?.company_id).order("full_name"),
        supabase.from("evv_records").select("*, clients(full_name)").eq("company_id", companyUser?.company_id).eq("rbt_id", user.id).eq("evv_status", "complete").order("actual_start", { ascending: false }).limit(50),
        supabase.from("time_entry_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("companies").select("drive_time_enabled, drive_time_max_minutes").eq("id", companyUser?.company_id).single(),
      ]);
      setClients(clientData ?? []);
      setEvvRecords(evvData ?? []);
      setTimeEntries(entryData ?? []);
      setDriveTimeEnabled(company?.drive_time_enabled ?? false);
      setDriveTimeMax(company?.drive_time_max_minutes ?? 120);
    } catch (e) { console.log("Init error:", e); }
    setLoading(false);
  }

  async function loadNoteOptions(cId?: string) {
    try {
      const { data } = await supabase.from("clinical_note_options").select("category, option_value, display_order").eq("company_id", cId ?? companyId).eq("is_active", true).order("display_order");
      if (!data) return;
      const grouped = data.reduce((acc: Record<string, string[]>, row: any) => {
        if (!acc[row.category]) acc[row.category] = [];
        acc[row.category].push(row.option_value);
        return acc;
      }, {} as Record<string, string[]>);
      setNoteOptions(grouped);
    } catch (e) { console.log("loadNoteOptions error:", e); }
  }

  async function selectClientForEntry(client: Client) {
    setSelectedClient(client);
    const { data } = await supabase.from("authorizations").select("*").eq("client_id", client.id).eq("status", "approved").order("end_date", { ascending: false });
    setAuthorizations(data ?? []);
    setNewEntryStep("select_auth");
  }

  async function selectAuth(auth: Authorization) {
    setSelectedAuth(auth);
    const { data } = await supabase.from("evv_records").select("*, clients(full_name)").eq("client_id", auth.client_id).eq("evv_status", "complete").gte("date", auth.start_date).lte("date", auth.end_date).is("time_entry_id", null).order("actual_start", { ascending: false });
    setClientEVVs(data ?? []);
    setNewEntryStep("select_evv");
  }

  async function selectEVV(evv: EVVRecord) {
    setSelectedEVV(evv);
    const { data: session } = await supabase.from("sessions").select("id, behaviors_observed, interventions_used, programs_targeted, notes, cpt_code").eq("evv_record_id", evv.id).maybeSingle();
    setSessionData(session);
    setClinicalForm(prev => ({
      ...prev,
      cpt_code: selectedAuth?.cpt_code ?? "97153",
      session_location: evv.location_name ?? "",
      behaviors_worked_on: session?.programs_targeted ? session.programs_targeted.split(", ").filter(Boolean) : [],
      intervention_techniques: session?.interventions_used ? session.interventions_used.split(", ").filter(Boolean) : [],
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

    if (error) { alert(error.message); setSaving(false); return; }

    await supabase.from("evv_records").update({ time_entry_id: "pending" }).eq("id", selectedEVV.id);

    setSaving(false);
    setShowNewEntry(false);
    setNewEntryStep("select_client");
    setSelectedClient(null); setSelectedAuth(null); setSelectedEVV(null);
    setSessionData(null); setAgreedToTerms(false);
    await init();
    alert("✅ Submitted! Time entry submitted for BCBA review.");
  }

  async function loadLocationsForClient(clientId: string, which: 1 | 2) {
    const { data } = await supabase.from("client_locations").select("*").eq("client_id", clientId).order("is_primary", { ascending: false });
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
    alert(`✅ Drive Time Saved — ${mins} min (T1016) saved as draft.`);
  }

  const clientMap = new Map(clients.map(c => [c.id, c.full_name]));
  const unbilledEVV = evvRecords.filter(e => !e.time_entry_id);
  const pendingCount = timeEntries.filter(e => e.status === "pending").length;

  if (loading) {
    return <AppShell title="Time Entry & EVV"><div className="flex justify-center py-20"><p className="text-gray-400 text-sm">Loading...</p></div></AppShell>;
  }

  const STEPS: NewEntryStep[] = ["select_client", "select_auth", "select_evv", "clinical_notes", "preview"];
  const STEP_LABELS = ["1 Client", "2 Service", "3 Session", "4 Notes", "5 Submit"];

  return (
    <AppShell title="Time Entry & EVV">
      <div className="pb-10">
        {/* STATS */}
        <div className="flex gap-2 p-3">
          {[
            { num: evvRecords.length, label: "EVV", sub: unbilledEVV.length > 0 ? `${unbilledEVV.length} need entry` : undefined, bg: "#f5f3ff", color: "#7c3aed" },
            { num: pendingCount, label: "Pending", bg: "#fefce8", color: "#d97706" },
            { num: timeEntries.filter(e => e.status === "approved").length, label: "Approved", bg: "#f0fdf4", color: "#16a34a" },
          ].map(stat => (
            <div key={stat.label} className="flex-1 rounded-xl p-3 text-center" style={{ backgroundColor: stat.bg }}>
              <p className="text-xl font-black" style={{ color: stat.color }}>{stat.num}</p>
              <p className="text-[10px] font-bold uppercase mt-0.5" style={{ color: stat.color }}>{stat.label}</p>
              {stat.sub && <p className="text-[9px] text-gray-400 mt-0.5">{stat.sub}</p>}
            </div>
          ))}
        </div>

        {/* TABS */}
        <div className="flex bg-white border-b border-gray-100">
          {[
            { key: "evv", label: "📋 EVV", badge: unbilledEVV.length > 0 ? unbilledEVV.length : null, badgeColor: "#7c3aed" },
            { key: "entries", label: "⏱️ Entries", badge: pendingCount > 0 ? pendingCount : null, badgeColor: "#d97706" },
            { key: "drive", label: "🚗 Drive", badge: null, badgeColor: "#2563eb" },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as MainTab)} className="flex-1 py-3 flex items-center justify-center gap-1.5 border-b-2" style={{ borderColor: activeTab === tab.key ? "#2563eb" : "transparent" }}>
              <span className="text-xs font-medium" style={{ color: activeTab === tab.key ? "#2563eb" : "#9ca3af", fontWeight: activeTab === tab.key ? 700 : 500 }}>{tab.label}</span>
              {tab.badge && <span className="rounded-full px-1.5 text-[10px] font-bold text-white" style={{ backgroundColor: tab.badgeColor }}>{tab.badge}</span>}
            </button>
          ))}
        </div>

        <div className="p-4">
          {!showNewEntry && (
            <button onClick={() => { setShowNewEntry(true); setNewEntryStep("select_client"); }} className="w-full text-white font-bold py-3.5 rounded-2xl mb-4" style={{ backgroundColor: "#2563eb" }}>
              + New Time Entry
            </button>
          )}

          {/* NEW ENTRY FLOW */}
          {showNewEntry && (
            <div className="bg-white rounded-2xl border overflow-hidden mb-4" style={{ borderColor: "#dbeafe" }}>
              <div className="flex border-b" style={{ backgroundColor: "#eff6ff", borderColor: "#dbeafe" }}>
                {STEPS.map((step, i) => {
                  const currentIdx = STEPS.indexOf(newEntryStep);
                  const isDone = i < currentIdx;
                  const isCurrent = step === newEntryStep;
                  return (
                    <div key={step} className="flex-1 py-2 text-center border-b-2" style={{ borderColor: isCurrent ? "#2563eb" : isDone ? "#16a34a" : "transparent" }}>
                      <span className="text-[9px] font-semibold" style={{ color: isCurrent || isDone ? "#2563eb" : "#9ca3af" }}>{isDone ? "✓" : STEP_LABELS[i]}</span>
                    </div>
                  );
                })}
              </div>

              {/* STEP 1 */}
              {newEntryStep === "select_client" && (
                <div>
                  <p className="text-[17px] font-extrabold text-gray-900 m-4 mb-1">Select Client</p>
                  <p className="text-[13px] text-gray-500 mx-4 mb-4">Who is this time entry for?</p>
                  {clients.map(client => (
                    <button key={client.id} onClick={() => selectClientForEntry(client)} className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 text-left">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-extrabold text-sm" style={{ backgroundColor: "#2563eb" }}>{client.full_name.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>
                      <span className="flex-1 text-[15px] font-semibold text-gray-900">{client.full_name}</span>
                      <span className="text-xl text-gray-300">›</span>
                    </button>
                  ))}
                  <button onClick={() => setShowNewEntry(false)} className="w-full text-center py-3.5 m-4 rounded-2xl border border-gray-200 text-gray-500 font-semibold" style={{ width: "calc(100% - 2rem)" }}>Cancel</button>
                </div>
              )}

              {/* STEP 2 */}
              {newEntryStep === "select_auth" && selectedClient && (
                <div>
                  <button onClick={() => setNewEntryStep("select_client")} className="px-4 py-2.5 text-sm font-semibold" style={{ color: "#2563eb" }}>‹ Back</button>
                  <p className="text-[17px] font-extrabold text-gray-900 mx-4 mb-1">Select Service Authorization</p>
                  <p className="text-[13px] text-gray-500 mx-4 mb-4">{selectedClient.full_name}</p>
                  {authorizations.length === 0 ? (
                    <div className="flex flex-col items-center py-10"><p className="text-4xl mb-2.5">🏦</p><p className="text-sm text-gray-400">No active authorizations found</p></div>
                  ) : authorizations.map(auth => (
                    <button key={auth.id} onClick={() => selectAuth(auth)} className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 text-left">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-extrabold" style={{ color: "#2563eb" }}>{auth.cpt_code}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#dcfce7", color: "#16a34a" }}>Active</span>
                        </div>
                        <p className="text-[13px] text-gray-700">{auth.insurance_provider}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{auth.start_date} → {auth.end_date}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 font-semibold">Units</p>
                        <p className="text-base font-extrabold text-gray-900">{auth.used_units}/{auth.total_units}</p>
                        <p className="text-[10px] font-semibold" style={{ color: "#16a34a" }}>{auth.total_units - auth.used_units} left</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* STEP 3 */}
              {newEntryStep === "select_evv" && selectedAuth && (
                <div>
                  <button onClick={() => setNewEntryStep("select_auth")} className="px-4 py-2.5 text-sm font-semibold" style={{ color: "#2563eb" }}>‹ Back</button>
                  <p className="text-[17px] font-extrabold text-gray-900 mx-4 mb-1">Select EVV Session</p>
                  <p className="text-[13px] text-gray-500 mx-4 mb-4">{selectedAuth.start_date} → {selectedAuth.end_date}</p>
                  {clientEVVs.length === 0 ? (
                    <div className="flex flex-col items-center py-10"><p className="text-4xl mb-2.5">📋</p><p className="text-sm text-gray-400 text-center px-4">No EVV sessions available in this auth period</p></div>
                  ) : clientEVVs.map(evv => (
                    <button key={evv.id} onClick={() => selectEVV(evv)} className="w-full flex items-center gap-2 px-4 py-3.5 border-b border-gray-100 text-left">
                      <div className="flex-1">
                        <p className="text-[15px] font-bold text-gray-900">{fmtDate(evv.actual_start)}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{fmtTime(evv.actual_start)} – {fmtTime(evv.actual_end)} · {fmt(evv.session_duration_minutes)}</p>
                        {evv.location_name && <p className="text-[11px] text-gray-400 mt-0.5">📍 {evv.location_name}</p>}
                      </div>
                      <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#eff6ff", color: "#2563eb" }}>{selectedAuth.cpt_code}</span>
                      <span className="text-xl text-gray-300">›</span>
                    </button>
                  ))}
                </div>
              )}

              {/* STEP 4 — CLINICAL NOTES */}
              {newEntryStep === "clinical_notes" && selectedEVV && (
                <div className="pb-4">
                  <button onClick={() => setNewEntryStep("select_evv")} className="px-4 py-2.5 text-sm font-semibold" style={{ color: "#2563eb" }}>‹ Back</button>
                  <p className="text-[17px] font-extrabold text-gray-900 mx-4 mb-3">Clinical Documentation</p>

                  <div className="mx-4 rounded-xl p-3.5 mb-3" style={{ backgroundColor: "#1a2234" }}>
                    <p className="text-base font-extrabold text-white mb-1">{selectedClient?.full_name}</p>
                    <p className="text-xs" style={{ color: "#93c5fd" }}>{fmtDate(selectedEVV.actual_start)} · {fmtTime(selectedEVV.actual_start)}–{fmtTime(selectedEVV.actual_end)} · {fmt(selectedEVV.session_duration_minutes)}</p>
                    <p className="text-xs font-bold mt-1" style={{ color: "#60a5fa" }}>{selectedAuth?.cpt_code}</p>
                  </div>

                  {sessionData && (
                    <div className="mx-4 mb-3 rounded-lg p-2.5" style={{ backgroundColor: "#f0fdf4" }}>
                      <p className="text-xs font-semibold" style={{ color: "#16a34a" }}>✓ Session data found — fields pre-populated from data collection</p>
                    </div>
                  )}

                  <p className="text-xs font-bold text-gray-500 uppercase mx-4 mb-2">Session Type</p>
                  <div className="flex flex-wrap px-4 mb-2">
                    {SESSION_TYPES.map(t => <Chip key={t} label={t} active={clinicalForm.session_type === t} onClick={() => setClinicalForm(p => ({ ...p, session_type: t }))} />)}
                  </div>

                  <p className="text-xs font-bold text-gray-500 uppercase mx-4 mb-2 mt-3">CPT / Billing Code</p>
                  <div className="mx-4 mb-3">
                    {CPT_CODES.map(c => (
                      <button key={c.code} onClick={() => setClinicalForm(p => ({ ...p, cpt_code: c.code }))} className="w-full flex items-center justify-between p-3 rounded-lg border mb-1.5" style={clinicalForm.cpt_code === c.code ? { backgroundColor: "#eff6ff", borderColor: "#2563eb" } : { backgroundColor: "#fff", borderColor: "#e5e7eb" }}>
                        <span className="text-[13px] text-gray-700 text-left" style={clinicalForm.cpt_code === c.code ? { color: "#2563eb", fontWeight: 600 } : {}}>{c.label}</span>
                        {clinicalForm.cpt_code === c.code && <span style={{ color: "#2563eb", fontWeight: 700 }}>✓</span>}
                      </button>
                    ))}
                  </div>

                  <p className="text-xs font-bold text-gray-500 uppercase mx-4 mb-2">Session Location *</p>
                  <input value={clinicalForm.session_location} onChange={e => setClinicalForm(p => ({ ...p, session_location: e.target.value }))} placeholder="e.g. Home in the living room, bedroom"
                    className="mx-4 border border-gray-300 rounded-lg px-3.5 py-3 text-sm mb-3" style={{ width: "calc(100% - 2rem)" }} />

                  <p className="text-xs font-bold text-gray-500 uppercase mx-4 mb-2">Session Participants *</p>
                  <input value={clinicalForm.session_participants} onChange={e => setClinicalForm(p => ({ ...p, session_participants: e.target.value }))} placeholder="List participants and their relationships"
                    className="mx-4 border border-gray-300 rounded-lg px-3.5 py-3 text-sm mb-3" style={{ width: "calc(100% - 2rem)" }} />

                  <p className="text-xs font-bold text-gray-500 uppercase mx-4 mb-2">Who Was Present</p>
                  <div className="flex flex-wrap px-4 mb-1">
                    {PRESENT_OPTIONS.map(p => <Chip key={p} label={p} active={clinicalForm.who_was_present.includes(p)} onClick={() => setClinicalForm(f => ({ ...f, who_was_present: toggleArr(f.who_was_present, p) }))} />)}
                  </div>

                  <p className="text-xs font-bold text-gray-500 uppercase mx-4 mb-2 mt-2">Client Readiness *</p>
                  <div className="flex flex-wrap px-4 mb-1">
                    {(noteOptions.client_readiness ?? READINESS_OPTIONS).map(r => <Chip key={r} label={r} active={clinicalForm.client_readiness === r} onClick={() => setClinicalForm(f => ({ ...f, client_readiness: f.client_readiness === r ? "" : r }))} />)}
                  </div>

                  <p className="text-xs font-bold text-gray-500 uppercase mx-4 mb-2 mt-2">Evidence of Readiness *</p>
                  <input value={clinicalForm.evidence_of_readiness} onChange={e => setClinicalForm(p => ({ ...p, evidence_of_readiness: e.target.value }))} placeholder="e.g. smiling, crying, calm"
                    className="mx-4 border border-gray-300 rounded-lg px-3.5 py-3 text-sm mb-3" style={{ width: "calc(100% - 2rem)" }} />

                  <p className="text-xs font-bold text-gray-500 uppercase mx-4 mb-2">Antecedents / Barriers *</p>
                  <div className="flex flex-wrap px-4 mb-1">
                    {(noteOptions.antecedents ?? ANTECEDENT_OPTIONS).map(a => <Chip key={a} label={a} active={clinicalForm.antecedents === a} onClick={() => setClinicalForm(f => ({ ...f, antecedents: f.antecedents === a ? "" : a }))} />)}
                  </div>

                  <p className="text-xs font-bold text-gray-500 uppercase mx-4 mb-2 mt-2">Skill Target *</p>
                  <input value={clinicalForm.behaviors_worked_on.join(", ")} onChange={e => setClinicalForm(p => ({ ...p, behaviors_worked_on: e.target.value.split(", ").filter(Boolean) }))} placeholder="Skill that was the focus of today's session"
                    className="mx-4 border border-gray-300 rounded-lg px-3.5 py-3 text-sm mb-3" style={{ width: "calc(100% - 2rem)" }} />

                  {clinicalForm.behaviors_worked_on.length > 0 && (
                    <>
                      <p className="text-xs font-bold text-gray-500 uppercase mx-4 mb-2">Progress Per Target</p>
                      <div className="mx-4 mb-3">
                        {clinicalForm.behaviors_worked_on.map(target => (
                          <div key={target} className="bg-gray-50 rounded-lg p-2.5 mb-2">
                            <p className="text-xs text-gray-700 mb-1.5">{target}</p>
                            <div className="flex gap-1.5">
                              {PROGRESS_OPTIONS.map(p => {
                                const active = clinicalForm.progress_ratings[target] === p;
                                const color = p === "Progress" ? "#16a34a" : p === "Regression" ? "#dc2626" : "#d97706";
                                return (
                                  <button key={p} onClick={() => setClinicalForm(f => ({ ...f, progress_ratings: { ...f.progress_ratings, [target]: p } }))}
                                    className="px-3 py-1.5 rounded-full border text-[11px] font-semibold" style={active ? { backgroundColor: color, borderColor: color, color: "#fff" } : { borderColor: "#e5e7eb", color: "#374151" }}>
                                    {p}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <p className="text-xs font-bold text-gray-500 uppercase mx-4 mb-2">Maladaptive Behaviors Observed *</p>
                  <div className="flex flex-wrap px-4 mb-1">
                    {MALADAPTIVE_OPTIONS.map(b => {
                      const active = clinicalForm.maladaptive_behaviors.includes(b);
                      return (
                        <Chip key={b} label={b} active={active} onClick={() => setClinicalForm(f => ({ ...f, maladaptive_behaviors: toggleArr(f.maladaptive_behaviors, b) }))}
                          activeStyle={{ backgroundColor: b === "None observed" ? "#2563eb" : "#fef2f2", borderColor: b === "None observed" ? "#2563eb" : "#dc2626", color: b === "None observed" ? "#fff" : "#dc2626" }} />
                      );
                    })}
                  </div>

                  <p className="text-xs font-bold text-gray-500 uppercase mx-4 mb-2 mt-2">Intervention Techniques Used *</p>
                  <div className="flex flex-wrap px-4 mb-1">
                    {(noteOptions.intervention_techniques ?? INTERVENTION_OPTIONS).map(i => <Chip key={i} label={i} active={clinicalForm.intervention_techniques.includes(i)} onClick={() => setClinicalForm(f => ({ ...f, intervention_techniques: toggleArr(f.intervention_techniques, i) }))} />)}
                  </div>

                  <p className="text-xs font-bold text-gray-500 uppercase mx-4 mb-2 mt-2">Client Response to Interventions *</p>
                  <div className="flex flex-wrap px-4 mb-1">
                    {(noteOptions.client_response ?? CLIENT_RESPONSE_OPTIONS).map(r => <Chip key={r} label={r} active={clinicalForm.client_response_to_interventions === r} onClick={() => setClinicalForm(f => ({ ...f, client_response_to_interventions: f.client_response_to_interventions === r ? "" : r }))} />)}
                  </div>

                  <p className="text-xs font-bold text-gray-500 uppercase mx-4 mb-2 mt-2">Evidence of Response *</p>
                  <input value={clinicalForm.evidence_of_response} onChange={e => setClinicalForm(p => ({ ...p, evidence_of_response: e.target.value }))} placeholder="e.g. engaging in task, refusal"
                    className="mx-4 border border-gray-300 rounded-lg px-3.5 py-3 text-sm mb-3" style={{ width: "calc(100% - 2rem)" }} />

                  <p className="text-xs font-bold text-gray-500 uppercase mx-4 mb-2">Reinforcement Timing *</p>
                  <div className="flex flex-wrap px-4 mb-1">
                    {(noteOptions.reinforcement_timing ?? REINFORCEMENT_TIMING).map(rt => <Chip key={rt} label={rt} active={clinicalForm.reinforcement_timing === rt} onClick={() => setClinicalForm(f => ({ ...f, reinforcement_timing: f.reinforcement_timing === rt ? "" : rt }))} />)}
                  </div>

                  <p className="text-xs font-bold text-gray-500 uppercase mx-4 mb-2 mt-2">Effect of Reinforcement *</p>
                  <input value={clinicalForm.effect_of_reinforcement} onChange={e => setClinicalForm(p => ({ ...p, effect_of_reinforcement: e.target.value }))} placeholder="Describe client behavior following reinforcement"
                    className="mx-4 border border-gray-300 rounded-lg px-3.5 py-3 text-sm mb-3" style={{ width: "calc(100% - 2rem)" }} />

                  <p className="text-xs font-bold text-gray-500 uppercase mx-4 mb-2">Reinforcements Used</p>
                  <input value={clinicalForm.reinforcements_used} onChange={e => setClinicalForm(p => ({ ...p, reinforcements_used: e.target.value }))} placeholder="iPad time, verbal praise, token board..."
                    className="mx-4 border border-gray-300 rounded-lg px-3.5 py-3 text-sm mb-3" style={{ width: "calc(100% - 2rem)" }} />

                  <p className="text-xs font-bold text-gray-500 uppercase mx-4 mb-2">Did Reinforcements Work?</p>
                  <div className="flex gap-2 px-4 mb-3">
                    {["Yes", "No", "Partially"].map(opt => {
                      const val = opt === "Yes" ? true : opt === "No" ? false : null;
                      const active = clinicalForm.reinforcements_worked === val;
                      return <Chip key={opt} label={opt} active={active} onClick={() => setClinicalForm(p => ({ ...p, reinforcements_worked: val }))} />;
                    })}
                  </div>

                  <p className="text-xs font-bold text-gray-500 uppercase mx-4 mb-2">Treatment Progress *</p>
                  <div className="flex flex-wrap px-4 mb-1">
                    {(noteOptions.treatment_progress ?? TREATMENT_PROGRESS_OPTIONS).map(t => <Chip key={t} label={t} active={clinicalForm.treatment_progress === t} onClick={() => setClinicalForm(f => ({ ...f, treatment_progress: f.treatment_progress === t ? "" : t }))} />)}
                  </div>

                  <p className="text-xs font-bold text-gray-500 uppercase mx-4 mb-2 mt-2">Goal Mastery Status *</p>
                  <div className="flex flex-wrap px-4 mb-1">
                    {(noteOptions.goal_mastery ?? MASTERY_OPTIONS).map(m => <Chip key={m} label={m} active={clinicalForm.goal_mastery_status === m} onClick={() => setClinicalForm(f => ({ ...f, goal_mastery_status: f.goal_mastery_status === m ? "" : m }))} />)}
                  </div>

                  <p className="text-xs font-bold text-gray-500 uppercase mx-4 mb-2 mt-2">Skill Generalization *</p>
                  <div className="flex flex-wrap px-4 mb-1">
                    {(noteOptions.skill_generalization ?? GENERALIZATION_OPTIONS).map(g => <Chip key={g} label={g} active={clinicalForm.skill_generalization === g} onClick={() => setClinicalForm(f => ({ ...f, skill_generalization: f.skill_generalization === g ? "" : g }))} />)}
                  </div>

                  <p className="text-xs font-bold text-gray-500 uppercase mx-4 mb-2 mt-2">Client Transition from Session *</p>
                  <div className="flex flex-wrap px-4 mb-1">
                    {(noteOptions.client_transition ?? TRANSITION_OPTIONS).map(t => <Chip key={t} label={t} active={clinicalForm.client_disposition === t} onClick={() => setClinicalForm(f => ({ ...f, client_disposition: f.client_disposition === t ? "" : t }))} />)}
                  </div>

                  {driveTimeEnabled && (
                    <div className="mx-4 mb-3 mt-2">
                      <p className="text-xs font-bold text-gray-500 uppercase mb-2">Drive Time (max {driveTimeMax} min)</p>
                      <input value={String(clinicalForm.drive_time_minutes)} onChange={e => setClinicalForm(p => ({ ...p, drive_time_minutes: Math.min(parseInt(e.target.value) || 0, driveTimeMax) }))}
                        type="number" className="w-full border border-gray-300 rounded-lg px-3.5 py-3 text-sm mb-2" />
                      {clinicalForm.drive_time_minutes > 0 && (
                        <label className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">Billable</span>
                          <input type="checkbox" checked={clinicalForm.drive_time_billable} onChange={e => setClinicalForm(p => ({ ...p, drive_time_billable: e.target.checked }))} className="w-5 h-5" />
                        </label>
                      )}
                    </div>
                  )}

                  <p className="text-xs font-bold text-gray-500 uppercase mx-4 mb-2 mt-2">Additional Information</p>
                  <textarea value={clinicalForm.additional_information} onChange={e => setClinicalForm(p => ({ ...p, additional_information: e.target.value }))} placeholder="New behaviors observed, incidents, relevant events..."
                    className="mx-4 border border-gray-300 rounded-lg px-3.5 py-3 text-sm mb-3" style={{ width: "calc(100% - 2rem)", minHeight: 80 }} />

                  <button onClick={() => setNewEntryStep("preview")} className="mx-4 text-white font-bold py-4 rounded-2xl" style={{ backgroundColor: "#2563eb", width: "calc(100% - 2rem)" }}>
                    Preview Note →
                  </button>
                </div>
              )}

              {/* STEP 5 — PREVIEW + SUBMIT */}
              {newEntryStep === "preview" && selectedEVV && selectedClient && (
                <div className="pb-4">
                  <button onClick={() => setNewEntryStep("clinical_notes")} className="px-4 py-2.5 text-sm font-semibold" style={{ color: "#2563eb" }}>‹ Back to Edit</button>
                  <p className="text-[17px] font-extrabold text-gray-900 mx-4 mb-3">Preview & Submit</p>

                  <div className="mx-4 bg-white rounded-2xl border border-gray-200 p-4 mb-4">
                    <p className="text-[17px] font-extrabold text-gray-900 mb-1">{selectedClient.full_name}</p>
                    <p className="text-[13px] text-gray-500">{fmtDate(selectedEVV.actual_start)} · {fmtTime(selectedEVV.actual_start)}–{fmtTime(selectedEVV.actual_end)} · {fmt(selectedEVV.session_duration_minutes)}</p>
                    <p className="text-xs font-bold mb-3 mt-1" style={{ color: "#2563eb" }}>{clinicalForm.session_type} · {clinicalForm.cpt_code}</p>
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
                      <div key={field.label} className="border-t border-gray-100 pt-2 mt-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">{field.label}</p>
                        <p className="text-[13px] text-gray-700">{field.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mx-4 bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-4">
                    <p className="text-xs text-gray-700 leading-relaxed mb-4">
                      By checking this box I am electronically signing this time entry and attest that I am the service provider for the above client. I have reviewed the time entry details above and performed the services as described for the entire duration from start to end time. I understand that deliberately submitting information that is not accurate constitutes fraud and will result in employment termination and may be punishable by state and federal laws.
                    </p>
                    <label className="flex items-center gap-2.5">
                      <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} className="w-5 h-5" />
                      <span className="text-sm font-semibold text-gray-700">I agree to the terms</span>
                    </label>
                  </div>

                  <button onClick={saveTimeEntry} disabled={!agreedToTerms || saving} className="mx-4 text-white font-bold py-4 rounded-2xl disabled:opacity-40" style={{ backgroundColor: "#2563eb", width: "calc(100% - 2rem)" }}>
                    {saving ? "..." : "Submit Time Entry"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* EVV TAB */}
          {!showNewEntry && activeTab === "evv" && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Completed EVV visits</p>
              {evvRecords.length === 0 && <div className="flex flex-col items-center py-10"><p className="text-4xl mb-2.5">📋</p><p className="text-sm text-gray-400">No completed EVV records yet</p></div>}
              {evvRecords.map(evv => {
                const hasEntry = !!evv.time_entry_id;
                const isExp = expandedEVV === evv.id;
                return (
                  <div key={evv.id} className="bg-white rounded-2xl mb-2.5 border overflow-hidden" style={{ borderColor: hasEntry ? "#e5e7eb" : "#c4b5fd", borderWidth: hasEntry ? 1 : 1.5 }}>
                    <button onClick={() => setExpandedEVV(isExp ? null : evv.id)} className="w-full flex items-center p-3.5 text-left">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[15px] font-bold text-gray-900">{evv.clients?.full_name ?? clientMap.get(evv.client_id) ?? "Unknown"}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={hasEntry ? { backgroundColor: "#dcfce7", color: "#16a34a" } : { backgroundColor: "#ede9fe", color: "#7c3aed" }}>{hasEntry ? "✓ Done" : "Needs Entry"}</span>
                        </div>
                        <p className="text-xs text-gray-500">📅 {fmtDate(evv.actual_start)} · {fmtTime(evv.actual_start)}–{fmtTime(evv.actual_end)} · {fmt(evv.session_duration_minutes)}</p>
                        {evv.location_name && <p className="text-xs text-gray-500 mt-0.5">📍 {evv.location_name}</p>}
                      </div>
                      <span className="text-xl text-gray-300 ml-2">{isExp ? "▼" : "›"}</span>
                    </button>
                    {isExp && (
                      <div className="border-t border-gray-100 p-3.5">
                        <div className="flex flex-wrap gap-2 mb-3">
                          {[
                            { label: "RBT Sig", val: evv.rbt_signature ? "✓ Signed" : "Missing", color: evv.rbt_signature ? "#16a34a" : "#dc2626" },
                            { label: "Guardian", val: evv.guardian_signature ? "✓ Signed" : evv.guardian_unavailable ? "Unavailable" : "Missing", color: evv.guardian_signature ? "#16a34a" : "#d97706" },
                            { label: "Behaviors", val: String(evv.behaviors_recorded), color: "#111827" },
                            { label: "Trials", val: String(evv.trials_recorded), color: "#111827" },
                          ].map(item => (
                            <div key={item.label} className="bg-gray-50 rounded-lg p-2.5 flex-1" style={{ minWidth: "45%" }}>
                              <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">{item.label}</p>
                              <p className="text-[13px] font-semibold" style={{ color: item.color }}>{item.val}</p>
                            </div>
                          ))}
                        </div>
                        {!hasEntry ? (
                          <button onClick={() => { setShowNewEntry(true); setNewEntryStep("select_client"); }} className="w-full text-white font-bold py-3.5 rounded-xl" style={{ backgroundColor: "#2563eb" }}>+ Create Time Entry from this Visit</button>
                        ) : (
                          <p className="text-[13px] font-semibold text-center py-2" style={{ color: "#16a34a" }}>✓ Time entry created and linked</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ENTRIES TAB */}
          {!showNewEntry && activeTab === "entries" && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Your submitted time entries</p>
              {timeEntries.length === 0 && <div className="flex flex-col items-center py-10"><p className="text-4xl mb-2.5">⏱️</p><p className="text-sm text-gray-400">No time entries yet</p></div>}
              {timeEntries.map(entry => {
                const isExp = expandedEntry === entry.id;
                return (
                  <div key={entry.id} className="bg-white rounded-2xl mb-2.5 border border-gray-200 overflow-hidden">
                    <button onClick={() => setExpandedEntry(isExp ? null : entry.id)} className="w-full flex items-center p-3.5 text-left">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[15px] font-bold text-gray-900">{clientMap.get(entry.client_id) ?? "Unknown"}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${STATUS_COLORS[entry.status]}20`, color: STATUS_COLORS[entry.status] }}>{STATUS_LABELS[entry.status] ?? entry.status}</span>
                        </div>
                        <p className="text-xs text-gray-500">📅 {entry.date} · {fmt(entry.duration_minutes)}</p>
                        <div className="flex gap-1.5 mt-0.5">
                          <span className="text-xs text-gray-500">{entry.session_type}</span>
                          {entry.cpt_code && <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#eff6ff", color: "#2563eb" }}>{entry.cpt_code}</span>}
                        </div>
                        {entry.evv_record_id && <p className="text-xs mt-0.5" style={{ color: "#7c3aed" }}>🔗 Linked to EVV</p>}
                      </div>
                      <span className="text-xl text-gray-300 ml-2">{isExp ? "▼" : "›"}</span>
                    </button>
                    {isExp && (
                      <div className="border-t border-gray-100 p-3.5 space-y-2">
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
                          <div key={field.label} className="bg-gray-50 rounded-lg p-2.5">
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">{field.label}</p>
                            <p className="text-[13px] text-gray-700">{field.value}</p>
                          </div>
                        ))}
                        {entry.behaviors_worked_on && entry.behaviors_worked_on.length > 0 && (
                          <div className="rounded-lg p-2.5" style={{ backgroundColor: "#f0fdf4" }}>
                            <p className="text-[10px] font-bold uppercase mb-1" style={{ color: "#16a34a" }}>Skill Targets</p>
                            {entry.behaviors_worked_on.map(b => (
                              <div key={b} className="flex justify-between mt-1">
                                <span className="text-[13px] text-gray-700 flex-1">{b}</span>
                                {entry.progress_ratings?.[b] && (
                                  <span className="text-[11px] font-bold" style={{ color: entry.progress_ratings[b] === "Progress" ? "#16a34a" : entry.progress_ratings[b] === "Regression" ? "#dc2626" : "#d97706" }}>{entry.progress_ratings[b]}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {entry.maladaptive_behaviors && entry.maladaptive_behaviors.length > 0 && (
                          <div className="rounded-lg p-2.5" style={{ backgroundColor: "#fef2f2" }}>
                            <p className="text-[10px] font-bold uppercase mb-0.5" style={{ color: "#dc2626" }}>Maladaptive Behaviors</p>
                            <p className="text-[13px] text-gray-700">{entry.maladaptive_behaviors.join(", ")}</p>
                          </div>
                        )}
                        {entry.intervention_techniques && entry.intervention_techniques.length > 0 && (
                          <div className="bg-gray-50 rounded-lg p-2.5">
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Intervention Techniques</p>
                            <p className="text-[13px] text-gray-700">{entry.intervention_techniques.join(", ")}</p>
                          </div>
                        )}
                        {entry.status === "needs_correction" && entry.reviewer_notes && (
                          <div className="rounded-lg p-2.5" style={{ backgroundColor: "#fef2f2" }}>
                            <p className="text-xs font-bold mb-1" style={{ color: "#dc2626" }}>⚠️ Correction Required</p>
                            <p className="text-xs" style={{ color: "#dc2626" }}>{entry.reviewer_notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* DRIVE TIME TAB */}
          {!showNewEntry && activeTab === "drive" && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Drive Time Between Clients</p>
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <p className="text-[13px] text-gray-500 mb-4 leading-relaxed">
                  Select your first and second client locations. We&apos;ll calculate drive time and create a <span className="font-bold" style={{ color: "#2563eb" }}>T1016</span> billing entry.
                </p>

                {driveStep === "select" && (
                  <>
                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">From: First Client</p>
                    <div className="flex flex-wrap mb-2">
                      {clients.map(c => <Chip key={c.id} label={c.full_name} active={driveClient1?.id === c.id} onClick={async () => { setDriveClient1(c); await loadLocationsForClient(c.id, 1); }} />)}
                    </div>
                    {driveClient1 && driveLocations1.length > 0 && (
                      <>
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2 mt-2">From Location</p>
                        {driveLocations1.map(loc => (
                          <button key={loc.id} onClick={() => setDriveLocation1(loc)} className="w-full text-left rounded-lg p-3 mb-1.5 border" style={driveLocation1?.id === loc.id ? { borderColor: "#2563eb", backgroundColor: "#eff6ff" } : { borderColor: "#e5e7eb", backgroundColor: "#fff" }}>
                            <p className="text-sm font-semibold text-gray-900">{loc.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{loc.address}, {loc.city}</p>
                          </button>
                        ))}
                      </>
                    )}

                    <p className="text-xs font-bold text-gray-500 uppercase mb-2 mt-4">To: Second Client</p>
                    <div className="flex flex-wrap mb-2">
                      {clients.map(c => <Chip key={c.id} label={c.full_name} active={driveClient2?.id === c.id} onClick={async () => { setDriveClient2(c); await loadLocationsForClient(c.id, 2); }} />)}
                    </div>
                    {driveClient2 && driveLocations2.length > 0 && (
                      <>
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2 mt-2">To Location</p>
                        {driveLocations2.map(loc => (
                          <button key={loc.id} onClick={() => setDriveLocation2(loc)} className="w-full text-left rounded-lg p-3 mb-1.5 border" style={driveLocation2?.id === loc.id ? { borderColor: "#2563eb", backgroundColor: "#eff6ff" } : { borderColor: "#e5e7eb", backgroundColor: "#fff" }}>
                            <p className="text-sm font-semibold text-gray-900">{loc.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{loc.address}, {loc.city}</p>
                          </button>
                        ))}
                      </>
                    )}

                    <button onClick={calculateDriveTime} disabled={!driveLocation1 || !driveLocation2} className="w-full text-white font-bold py-3.5 rounded-xl mt-5 disabled:opacity-40" style={{ backgroundColor: "#2563eb" }}>
                      📍 Calculate Drive Time
                    </button>
                  </>
                )}

                {driveStep === "confirm" && driveEstimated !== null && (
                  <>
                    <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: "#eff6ff" }}>
                      <p className="text-xs font-bold text-gray-500 uppercase">Route Summary</p>
                      <p className="text-sm text-gray-900 mt-1.5">📍 {driveLocation1?.name} ({driveClient1?.full_name})</p>
                      <p className="text-xs text-gray-400 ml-5">↓</p>
                      <p className="text-sm text-gray-900">📍 {driveLocation2?.name} ({driveClient2?.full_name})</p>
                      <p className="text-xl font-black mt-3" style={{ color: "#2563eb" }}>~{driveEstimated} min estimated</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#dbeafe", color: "#2563eb" }}>T1016</span>
                        <span className="text-[11px] text-gray-400">Drive Time billing code</span>
                      </div>
                    </div>

                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Actual Drive Time (minutes)</p>
                    <input value={driveActual} onChange={e => setDriveActual(e.target.value)} type="number" className="w-full border border-gray-300 rounded-lg px-3.5 py-3 text-sm mb-3" />

                    {driveActual !== String(driveEstimated) && (
                      <>
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Reason for Adjustment</p>
                        <textarea value={driveReason} onChange={e => setDriveReason(e.target.value)} placeholder="Traffic, detour, road closure, etc..." className="w-full border border-gray-300 rounded-lg px-3.5 py-3 text-sm mb-3" style={{ minHeight: 60 }} />
                      </>
                    )}

                    <div className="flex gap-2.5 mt-4">
                      <button onClick={() => setDriveStep("select")} className="flex-1 py-3.5 rounded-xl border border-gray-200 text-gray-700 font-semibold">‹ Back</button>
                      <button onClick={submitDriveTime} disabled={driveSaving} className="flex-[2] text-white font-bold py-3.5 rounded-xl disabled:opacity-60" style={{ backgroundColor: "#2563eb" }}>
                        {driveSaving ? "..." : "✓ Save Drive Time (T1016)"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
