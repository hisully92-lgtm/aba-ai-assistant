"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";

import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type Authorization = {
  id: string; client_id: string; insurance_provider: string | null;
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
type TimeEntry = {
  id: string; user_id: string; client_id: string; date: string;
  start_time: string; end_time: string; duration_minutes: number;
  session_type: string; cpt_code: string | null;
  drive_time_minutes: number; drive_time_billable: boolean;
  notes: string | null; clinical_notes: string | null;
  status: string; submitted_at: string | null;
  reviewer_notes: string | null; reviewed_at: string | null;
  location_name: string | null; geofence_verified: boolean;
  evv_record_id?: string | null;
  behaviors_worked_on: string[] | null;
  maladaptive_behaviors: string[] | null;
  progress_ratings: Record<string, string> | null;
  reinforcements_used: string | null; reinforcements_worked: boolean | null;
  reinforcements_timing: string | null; antecedents: string | null;
  who_was_present: string[] | null; client_readiness: string | null;
  client_disposition: string | null;
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
  client_transition: string | null;
  additional_information: string | null;
  clients?: { full_name: string };
  profiles?: { full_name: string; role: string };
};
type DriveLocation = {
  id: string; name: string; address: string; city: string;
  latitude: number; longitude: number;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  pending: "bg-yellow-100 text-yellow-700",
  needs_correction: "bg-red-100 text-red-700",
  approved: "bg-green-100 text-green-700",
  billed: "bg-blue-100 text-blue-700",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", pending: "Pending Review",
  needs_correction: "Needs Correction", approved: "Approved", billed: "Billed",
};
const CPT_CODES = [
  { code: "97153", label: "97153 — Adaptive Behavior Treatment (RBT)" },
  { code: "97155", label: "97155 — Protocol Modification (BCBA)" },
  { code: "97156", label: "97156 — Family Guidance" },
  { code: "97151", label: "97151 — Behavior Identification Assessment" },
  { code: "97152", label: "97152 — Behavior Identification Supporting Assessment" },
  { code: "T1016", label: "T1016 — Drive Time" },
];
const SESSION_TYPES = ["Direct Therapy", "Supervision", "Parent Training", "Assessment", "Team Meeting", "Telehealth"];
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
const MALADAPTIVE_OPTIONS = ["None observed", "Aggression", "Self-injurious behavior", "Elopement", "Vocal disruption", "Property destruction", "Stereotypy", "Non-compliance", "Other"];

type NewEntryStep = "select_client" | "select_auth" | "select_evv" | "clinical_notes" | "preview";

export default function TimeEntriesPage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [evvRecords, setEvvRecords] = useState<EVVRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [evvLoading, setEvvLoading] = useState(true);
  const [role, setRole] = useState("");
  const [userId, setUserId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [driveTimeEnabled, setDriveTimeEnabled] = useState(false);
  const [driveTimeMax, setDriveTimeMax] = useState(120);
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [expandedEVV, setExpandedEVV] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [noteOptions, setNoteOptions] = useState<Record<string, string[]>>({});
  const [activeTab, setActiveTab] = useState<"evv" | "entries" | "drive">("evv");

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
    client_readiness: "", evidence_of_readiness: "",
    antecedents: "",
    behaviors_worked_on: [] as string[],
    maladaptive_behaviors: [] as string[],
    progress_ratings: {} as Record<string, string>,
    intervention_techniques: [] as string[],
    client_response_to_interventions: "", evidence_of_response: "",
    reinforcements_used: "", reinforcement_timing: "",
    effect_of_reinforcement: "", reinforcements_worked: null as boolean | null,
    treatment_progress: "", goal_mastery_status: "",
    skill_generalization: "", client_disposition: "",
    additional_information: "", who_was_present: [] as string[],
    drive_time_minutes: 0, drive_time_billable: false, notes: "",
  });

  // Drive time
  const [driveClient1Id, setDriveClient1Id] = useState("");
  const [driveClient2Id, setDriveClient2Id] = useState("");
  const [driveLocations1, setDriveLocations1] = useState<DriveLocation[]>([]);
  const [driveLocations2, setDriveLocations2] = useState<DriveLocation[]>([]);
  const [driveLocation1Id, setDriveLocation1Id] = useState("");
  const [driveLocation2Id, setDriveLocation2Id] = useState("");
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
      .from("company_users").select("company_id, role")
      .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();

    setRole(companyUser?.role ?? "");
    setCompanyId(companyUser?.company_id ?? "");

    await loadNoteOptions(companyUser?.company_id);

    const [{ data: company }, { data: clientData }] = await Promise.all([
      supabase.from("companies").select("drive_time_enabled, drive_time_max_minutes").eq("id", companyUser?.company_id).single(),
      supabase.from("clients").select("id, full_name").eq("company_id", companyUser?.company_id).order("full_name"),
    ]);

    setDriveTimeEnabled(company?.drive_time_enabled ?? false);
    setDriveTimeMax(company?.drive_time_max_minutes ?? 120);
    setClients(clientData ?? []);

    await Promise.all([
      loadEntries(companyUser?.company_id, user.id, companyUser?.role),
      loadEVVRecords(companyUser?.company_id, user.id, companyUser?.role),
    ]);
  }

  async function loadNoteOptions(cId?: string) {
    const { data } = await supabase
      .from("clinical_note_options")
      .select("category, option_value, display_order")
      .eq("company_id", cId ?? companyId)
      .eq("is_active", true)
      .order("display_order");
    if (!data) return;
    const grouped = data.reduce((acc: Record<string, string[]>, row: { category: string; option_value: string; display_order: number }) => {
      if (!acc[row.category]) acc[row.category] = [];
      acc[row.category].push(row.option_value);
      return acc;
    }, {} as Record<string, string[]>);
    setNoteOptions(grouped);
  }

  async function loadEntries(cId?: string, uId?: string, r?: string) {
    const isAdmin = ["bcba", "supervisor", "admin", "clinical_director"].includes(r ?? role);
    let query = supabase
      .from("time_entry_logs")
      .select("*, clients(full_name)")
      .eq("company_id", cId ?? companyId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (!isAdmin) query = query.eq("user_id", uId ?? userId);
    const { data } = await query;
    setEntries(data ?? []);
    setLoading(false);
  }

  async function loadEVVRecords(cId?: string, uId?: string, r?: string) {
    const isAdmin = ["bcba", "supervisor", "admin", "clinical_director"].includes(r ?? role);
    let query = supabase
      .from("evv_records")
      .select("*, clients(full_name)")
      .eq("company_id", cId ?? companyId)
      .eq("evv_status", "complete")
      .order("actual_start", { ascending: false })
      .limit(50);
    if (!isAdmin) query = query.eq("rbt_id", uId ?? userId);
    const { data } = await query;
    setEvvRecords(data ?? []);
    setEvvLoading(false);
  }

  async function loadDriveLocations(clientId: string, which: 1 | 2) {
    const { data } = await supabase.from("client_locations").select("*")
      .eq("client_id", clientId).order("is_primary", { ascending: false });
    if (which === 1) { setDriveLocations1(data ?? []); setDriveLocation1Id(""); }
    else { setDriveLocations2(data ?? []); setDriveLocation2Id(""); }
  }

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
      .from("sessions")
      .select("id, behaviors_observed, interventions_used, programs_targeted, notes, cpt_code")
      .eq("evv_record_id", evv.id).maybeSingle();
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

  async function saveTimeEntry() {
    if (!selectedEVV || !selectedClient || !selectedAuth) return;
    setSaving("new");
    const { data: insertedEntry, error: insertError } = await supabase.from("time_entry_logs").insert({
      company_id: companyId, user_id: userId,
      client_id: selectedClient.id, date: selectedEVV.date,
      start_time: selectedEVV.actual_start, end_time: selectedEVV.actual_end,
      duration_minutes: selectedEVV.session_duration_minutes,
      session_type: clinicalForm.session_type, cpt_code: clinicalForm.cpt_code,
      drive_time_minutes: clinicalForm.drive_time_minutes,
      drive_time_billable: clinicalForm.drive_time_billable,
      notes: clinicalForm.notes || null, status: "pending",
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
    }).select().single();

if (insertError) {
  alert("Error saving time entry: " + insertError.message);
  setSaving(null);
  return;
}

    if (insertedEntry?.id) {
  await supabase.from("evv_records").update({ time_entry_id: insertedEntry.id }).eq("id", selectedEVV.id);
}
    setShowNewEntry(false);
    setNewEntryStep("select_client");
    setSelectedClient(null); setSelectedAuth(null); setSelectedEVV(null);
    setSessionData(null); setAgreedToTerms(false); setSaving(null);
    await Promise.all([loadEntries(), loadEVVRecords()]);
    setActiveTab("entries");
  }

  function calculateDriveEstimate() {
    const loc1 = driveLocations1.find(l => l.id === driveLocation1Id);
    const loc2 = driveLocations2.find(l => l.id === driveLocation2Id);
    if (!loc1 || !loc2) return;
    const R = 6371;
    const dLat = (loc2.latitude - loc1.latitude) * Math.PI / 180;
    const dLon = (loc2.longitude - loc1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(loc1.latitude * Math.PI / 180) * Math.cos(loc2.latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const mins = Math.round((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 0.621371 / 30) * 60);
    setDriveEstimated(mins); setDriveActual(String(mins)); setDriveStep("confirm");
  }

  async function saveDriveTime() {
    const loc1 = driveLocations1.find(l => l.id === driveLocation1Id);
    const loc2 = driveLocations2.find(l => l.id === driveLocation2Id);
    const client1 = clients.find(c => c.id === driveClient1Id);
    const client2 = clients.find(c => c.id === driveClient2Id);
    if (!loc1 || !loc2 || !client1 || !client2) return;
    setDriveSaving(true);
    const mins = parseInt(driveActual) || 0;
    const today = new Date().toISOString().split("T")[0];
    const now = new Date().toISOString();
    await supabase.from("time_entry_logs").insert({
      company_id: companyId, user_id: userId,
      client_id: driveClient1Id, date: today,
      start_time: now, end_time: now,
      duration_minutes: mins, session_type: "Drive Time",
      cpt_code: "T1016", drive_time_minutes: mins, drive_time_billable: true,
      notes: `Drive from ${client1.full_name} (${loc1.name}) to ${client2.full_name} (${loc2.name}).${driveReason ? ` Adjusted from ${driveEstimated}min: ${driveReason}` : ""}`,
      status: "draft",
    });
    setDriveSaving(false); setDriveStep("select");
    setDriveClient1Id(""); setDriveClient2Id("");
    setDriveLocation1Id(""); setDriveLocation2Id("");
    setDriveEstimated(null); setDriveActual(""); setDriveReason("");
    await loadEntries(); setActiveTab("entries");
  }

  async function submitEntry(id: string) {
    setSaving(id);
    await supabase.from("time_entry_logs").update({ status: "pending", submitted_at: new Date().toISOString() }).eq("id", id);
    await loadEntries(); setSaving(null);
  }

  async function approveEntry(id: string) {
    setSaving(id);
    await supabase.from("time_entry_logs").update({ status: "approved", reviewed_by: userId, reviewed_at: new Date().toISOString(), reviewer_notes: reviewNotes[id] ?? null }).eq("id", id);
    await loadEntries(); setSaving(null);
  }

  async function rejectEntry(id: string) {
    if (!reviewNotes[id]?.trim()) { alert("Please add correction notes before rejecting."); return; }
    setSaving(id);
    await supabase.from("time_entry_logs").update({ status: "needs_correction", reviewed_by: userId, reviewed_at: new Date().toISOString(), reviewer_notes: reviewNotes[id] }).eq("id", id);
    await loadEntries(); setSaving(null);
  }

  async function markBilled(id: string) {
    setSaving(id);
    await supabase.from("time_entry_logs").update({ status: "billed", billed_at: new Date().toISOString() }).eq("id", id);
    await loadEntries(); setSaving(null);
  }

  const fmt = (minutes: number) => { const h = Math.floor(minutes / 60); const m = minutes % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; };
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

  const filtered = filterStatus === "all" ? entries : entries.filter(e => e.status === filterStatus);
  const pendingCount = entries.filter(e => e.status === "pending").length;
  const correctionCount = entries.filter(e => e.status === "needs_correction").length;
  const unbilledEVV = evvRecords.filter(e => !e.time_entry_id);
  const isAdmin = ["bcba", "supervisor", "admin", "clinical_director"].includes(role);

  const chip = (label: string, active: boolean, onClick: () => void, activeClass = "bg-blue-600 text-white border-blue-600") => (
    <button key={label} type="button" onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${active ? activeClass : "bg-white text-gray-600 border-gray-300 hover:border-blue-300"}`}>
      {label}
    </button>
  );

  const inputClass = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";
  const labelClass = "text-sm font-medium text-gray-700 mb-1 block";
  const fieldClass = "space-y-1";

  return (
    <div className="space-y-6">
      <PageHeader title="Time Entries & EVV">
        <Button onClick={() => { setShowNewEntry(s => !s); setNewEntryStep("select_client"); setSelectedClient(null); setSelectedAuth(null); setSelectedEVV(null); }}>
          {showNewEntry ? "Cancel" : "+ New Time Entry"}
        </Button>
      </PageHeader>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-xl p-4 bg-purple-50 border-purple-100 text-purple-700">
          <p className="text-xs font-semibold uppercase">EVV Complete</p>
          <p className="text-3xl font-bold mt-1">{evvRecords.length}</p>
          {unbilledEVV.length > 0 && <p className="text-xs mt-1">{unbilledEVV.length} need entry</p>}
        </div>
        <Link href="/dashboard/session-review">
          <div className="border rounded-xl p-4 bg-yellow-50 border-yellow-100 text-yellow-700 cursor-pointer hover:shadow-md transition-all">
            <p className="text-xs font-semibold uppercase">Pending Review</p>
            <p className="text-3xl font-bold mt-1">{pendingCount}</p>
            {pendingCount > 0 && <p className="text-xs mt-1">Tap to review →</p>}
          </div>
        </Link>
        <Link href="/dashboard/billing/approved">
          <div className="border rounded-xl p-4 bg-green-50 border-green-100 text-green-700 cursor-pointer hover:shadow-md transition-all">
            <p className="text-xs font-semibold uppercase">Approved</p>
            <p className="text-3xl font-bold mt-1">{entries.filter(e => e.status === "approved").length}</p>
            <p className="text-xs mt-1">Ready to bill →</p>
          </div>
        </Link>
        <Link href="/dashboard/billing/approved?tab=billed">
          <div className="border rounded-xl p-4 bg-blue-50 border-blue-100 text-blue-700 cursor-pointer hover:shadow-md transition-all">
            <p className="text-xs font-semibold uppercase">Billed</p>
            <p className="text-3xl font-bold mt-1">{entries.filter(e => e.status === "billed").length}</p>
            <p className="text-xs mt-1">View history →</p>
          </div>
        </Link>
      </div>

      {/* NEW TIME ENTRY FLOW */}
      {showNewEntry && (
        <div className="border border-blue-200 rounded-2xl bg-blue-50 overflow-hidden">
          <div className="flex bg-white border-b border-blue-100">
            {[
              { key: "select_client", label: "1 Client" },
              { key: "select_auth", label: "2 Service" },
              { key: "select_evv", label: "3 Session" },
              { key: "clinical_notes", label: "4 Notes" },
              { key: "preview", label: "5 Submit" },
            ].map((step, i) => {
              const steps = ["select_client", "select_auth", "select_evv", "clinical_notes", "preview"];
              const currentIdx = steps.indexOf(newEntryStep);
              const stepIdx = steps.indexOf(step.key);
              const isDone = stepIdx < currentIdx;
              const isCurrent = step.key === newEntryStep;
              return (
                <div key={step.key} className={`flex-1 py-3 text-center text-xs font-semibold border-b-2 transition-colors ${isCurrent ? "border-blue-600 text-blue-600" : isDone ? "border-green-500 text-green-600" : "border-transparent text-gray-400"}`}>
                  {isDone ? "✓" : i + 1} {step.label}
                </div>
              );
            })}
          </div>

          <div className="p-6">
            {/* STEP 1 — SELECT CLIENT */}
            {newEntryStep === "select_client" && (
              <div>
                <h3 className="font-bold text-gray-800 mb-1">Select Client</h3>
                <p className="text-sm text-gray-500 mb-4">Who is this time entry for?</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {clients.map(client => (
                    <button key={client.id} type="button" onClick={() => selectClientForEntry(client)}
                      className="bg-white border border-gray-200 hover:border-blue-400 rounded-xl p-4 text-left transition-all flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {client.full_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <span className="font-semibold text-gray-800">{client.full_name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 2 — SELECT AUTHORIZATION */}
            {newEntryStep === "select_auth" && selectedClient && (
              <div>
                <button onClick={() => setNewEntryStep("select_client")} className="text-xs text-blue-500 hover:underline mb-3 block">‹ Back</button>
                <h3 className="font-bold text-gray-800 mb-1">Select Service Authorization</h3>
                <p className="text-sm text-gray-500 mb-4">Choose the insurance authorization for <strong>{selectedClient.full_name}</strong></p>
                {authorizations.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl bg-white">
                    <p className="text-2xl mb-2">🏦</p>
                    <p className="font-semibold text-gray-700">No active authorizations</p>
                    <p className="text-sm text-gray-400 mt-1">Add an authorization for this client first.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {authorizations.map(auth => (
                      <button key={auth.id} type="button" onClick={() => selectAuth(auth)}
                        className="w-full bg-white border border-gray-200 hover:border-blue-400 rounded-xl p-4 text-left transition-all">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono font-bold text-blue-700 text-sm">{auth.cpt_code}</span>
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Active</span>
                            </div>
                            <p className="text-sm text-gray-700">{auth.insurance_provider}</p>
                            <p className="text-xs text-gray-400">{auth.start_date} → {auth.end_date}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Units</p>
                            <p className="font-bold text-gray-800">{auth.used_units} / {auth.total_units}</p>
                            <p className="text-xs text-gray-400">{auth.total_units - auth.used_units} remaining</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* STEP 3 — SELECT EVV */}
            {newEntryStep === "select_evv" && selectedAuth && (
              <div>
                <button onClick={() => setNewEntryStep("select_auth")} className="text-xs text-blue-500 hover:underline mb-3 block">‹ Back</button>
                <h3 className="font-bold text-gray-800 mb-1">Select EVV Session</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Sessions within auth period <strong>{selectedAuth.start_date} → {selectedAuth.end_date}</strong> · Code: <span className="font-mono font-bold text-blue-700">{selectedAuth.cpt_code}</span>
                </p>
                {clientEVVs.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl bg-white">
                    <p className="text-2xl mb-2">📋</p>
                    <p className="font-semibold text-gray-700">No EVV sessions available</p>
                    <p className="text-sm text-gray-400 mt-1">All sessions within this auth period already have time entries, or none exist yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {clientEVVs.map(evv => (
                      <button key={evv.id} type="button" onClick={() => selectEVV(evv)}
                        className="w-full bg-white border border-gray-200 hover:border-blue-400 rounded-xl p-4 text-left transition-all flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-800">{fmtDate(evv.actual_start)}</p>
                          <p className="text-sm text-gray-500">{fmtTime(evv.actual_start)} – {fmtTime(evv.actual_end)} · {fmt(evv.session_duration_minutes)}</p>
                          {evv.location_name && <p className="text-xs text-gray-400 mt-0.5">📍 {evv.location_name}</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg">{selectedAuth.cpt_code}</span>
                          <span className="text-gray-300 text-xl">›</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* STEP 4 — CLINICAL NOTES */}
            {newEntryStep === "clinical_notes" && selectedEVV && (
              <div>
                <button onClick={() => setNewEntryStep("select_evv")} className="text-xs text-blue-500 hover:underline mb-3 block">‹ Back</button>
                <h3 className="font-bold text-gray-800 mb-1">Clinical Documentation</h3>

                <div className="bg-white rounded-xl p-4 mb-5 border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-2">Session Details (from EVV)</p>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div><span className="text-gray-400">Date:</span> <span className="font-semibold">{fmtDate(selectedEVV.actual_start)}</span></div>
                    <div><span className="text-gray-400">Start:</span> <span className="font-semibold">{fmtTime(selectedEVV.actual_start)}</span></div>
                    <div><span className="text-gray-400">End:</span> <span className="font-semibold">{fmtTime(selectedEVV.actual_end)}</span></div>
                    <div><span className="text-gray-400">Duration:</span> <span className="font-semibold">{fmt(selectedEVV.session_duration_minutes)}</span></div>
                    <div><span className="text-gray-400">Location:</span> <span className="font-semibold">{selectedEVV.location_name ?? "—"}</span></div>
                    <div><span className="text-gray-400">Code:</span> <span className="font-mono font-bold text-blue-700">{selectedAuth?.cpt_code}</span></div>
                  </div>
                </div>

                {sessionData && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-xs text-green-700">
                    ✓ Session data found — some fields pre-populated from your data collection
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className={fieldClass}>
                    <label className={labelClass}>Session Type</label>
                    <select value={clinicalForm.session_type} onChange={e => setClinicalForm(p => ({ ...p, session_type: e.target.value }))} className={inputClass}>
                      {SESSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>CPT / Billing Code</label>
                    <select value={clinicalForm.cpt_code} onChange={e => setClinicalForm(p => ({ ...p, cpt_code: e.target.value }))} className={inputClass}>
                      {CPT_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                    </select>
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Session Location *</label>
                    <input type="text" value={clinicalForm.session_location} onChange={e => setClinicalForm(p => ({ ...p, session_location: e.target.value }))} placeholder="e.g. Home in the living room" className={inputClass} />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Session Participants *</label>
                    <input type="text" value={clinicalForm.session_participants} onChange={e => setClinicalForm(p => ({ ...p, session_participants: e.target.value }))} placeholder="List participants and their relationships" className={inputClass} />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Who Was Present</label>
                    <div className="flex flex-wrap gap-2">
                      {PRESENT_OPTIONS.map(p => chip(p, clinicalForm.who_was_present.includes(p),
                        () => setClinicalForm(f => ({ ...f, who_was_present: f.who_was_present.includes(p) ? f.who_was_present.filter(x => x !== p) : [...f.who_was_present, p] }))))}
                    </div>
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Client Readiness *</label>
                    <select value={clinicalForm.client_readiness} onChange={e => setClinicalForm(p => ({ ...p, client_readiness: e.target.value }))} className={inputClass}>
                      <option value="">Was the client ready for the session?</option>
                      {(noteOptions.client_readiness ?? READINESS_OPTIONS).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Evidence of Readiness *</label>
                    <input type="text" value={clinicalForm.evidence_of_readiness} onChange={e => setClinicalForm(p => ({ ...p, evidence_of_readiness: e.target.value }))} placeholder="e.g. smiling, crying, calm" className={inputClass} />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Antecedents / Barriers Observed *</label>
                    <select value={clinicalForm.antecedents} onChange={e => setClinicalForm(p => ({ ...p, antecedents: e.target.value }))} className={inputClass}>
                      <option value="">Observations related to antecedents or barriers</option>
                      {(noteOptions.antecedents ?? ANTECEDENT_OPTIONS).map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Skill Target *</label>
                    <input type="text" value={clinicalForm.behaviors_worked_on.join(", ")} onChange={e => setClinicalForm(p => ({ ...p, behaviors_worked_on: e.target.value.split(", ").filter(Boolean) }))} placeholder="Skill that was the focus of today's session" className={inputClass} />
                    {clinicalForm.behaviors_worked_on.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase">Progress Per Target</p>
                        {clinicalForm.behaviors_worked_on.map(target => (
                          <div key={target} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-gray-100">
                            <span className="text-sm text-gray-700 flex-1">{target}</span>
                            <div className="flex gap-1">
                              {PROGRESS_OPTIONS.map(p => (
                                <button key={p} type="button"
                                  onClick={() => setClinicalForm(f => ({ ...f, progress_ratings: { ...f.progress_ratings, [target]: p } }))}
                                  className={`text-xs px-2 py-1 rounded border transition-all ${clinicalForm.progress_ratings[target] === p ? (p === "Progress" ? "bg-green-500 text-white border-green-500" : p === "Regression" ? "bg-red-500 text-white border-red-500" : "bg-yellow-500 text-white border-yellow-500") : "bg-white text-gray-600 border-gray-300"}`}>
                                  {p}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Maladaptive Behavior Observed *</label>
                    <select value="" onChange={e => { if (e.target.value) setClinicalForm(p => ({ ...p, maladaptive_behaviors: [...p.maladaptive_behaviors, e.target.value] })); }} className={inputClass}>
                      <option value="">Select maladaptive behavior...</option>
                      {(noteOptions.maladaptive_behaviors ?? MALADAPTIVE_OPTIONS).map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    {clinicalForm.maladaptive_behaviors.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {clinicalForm.maladaptive_behaviors.map(b => (
                          <span key={b} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full flex items-center gap-1">
                            {b}
                            <button onClick={() => setClinicalForm(p => ({ ...p, maladaptive_behaviors: p.maladaptive_behaviors.filter(x => x !== b) }))}>✕</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Intervention Techniques Used *</label>
                    <div className="flex flex-wrap gap-2">
                      {(noteOptions.intervention_techniques ?? INTERVENTION_OPTIONS).map(i => chip(i, clinicalForm.intervention_techniques.includes(i),
                        () => setClinicalForm(f => ({ ...f, intervention_techniques: f.intervention_techniques.includes(i) ? f.intervention_techniques.filter(x => x !== i) : [...f.intervention_techniques, i] }))))}
                    </div>
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Client Response to Interventions *</label>
                    <select value={clinicalForm.client_response_to_interventions} onChange={e => setClinicalForm(p => ({ ...p, client_response_to_interventions: e.target.value }))} className={inputClass}>
                      <option value="">Client's response to interventions</option>
                      {(noteOptions.client_response ?? CLIENT_RESPONSE_OPTIONS).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Evidence of Response *</label>
                    <input type="text" value={clinicalForm.evidence_of_response} onChange={e => setClinicalForm(p => ({ ...p, evidence_of_response: e.target.value }))} placeholder="e.g. engaging in task, refusal" className={inputClass} />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Reinforcement Timing *</label>
                    <select value={clinicalForm.reinforcement_timing} onChange={e => setClinicalForm(p => ({ ...p, reinforcement_timing: e.target.value }))} className={inputClass}>
                      <option value="">Timing of reinforcement delivery</option>
                      {(noteOptions.reinforcement_timing ?? REINFORCEMENT_TIMING).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Effect of Reinforcement *</label>
                    <input type="text" value={clinicalForm.effect_of_reinforcement} onChange={e => setClinicalForm(p => ({ ...p, effect_of_reinforcement: e.target.value }))} placeholder="Describe client behavior following reinforcement" className={inputClass} />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Reinforcements Used</label>
                    <input type="text" value={clinicalForm.reinforcements_used} onChange={e => setClinicalForm(p => ({ ...p, reinforcements_used: e.target.value }))} placeholder="e.g. iPad time, verbal praise, token board" className={inputClass} />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Did Reinforcements Work?</label>
                    <div className="flex gap-2 mt-1">
                      {["Yes", "No", "Partially"].map(opt => chip(opt,
                        clinicalForm.reinforcements_worked === (opt === "Yes" ? true : opt === "No" ? false : null),
                        () => setClinicalForm(p => ({ ...p, reinforcements_worked: opt === "Yes" ? true : opt === "No" ? false : null }))))}
                    </div>
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Treatment Progress *</label>
                    <select value={clinicalForm.treatment_progress} onChange={e => setClinicalForm(p => ({ ...p, treatment_progress: e.target.value }))} className={inputClass}>
                      <option value="">Client's progress status</option>
                      {(noteOptions.treatment_progress ?? TREATMENT_PROGRESS_OPTIONS).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Goal Mastery Status *</label>
                    <select value={clinicalForm.goal_mastery_status} onChange={e => setClinicalForm(p => ({ ...p, goal_mastery_status: e.target.value }))} className={inputClass}>
                      <option value="">Whether any goals were mastered</option>
                      {(noteOptions.goal_mastery ?? MASTERY_OPTIONS).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Skill Generalization Observed *</label>
                    <select value={clinicalForm.skill_generalization} onChange={e => setClinicalForm(p => ({ ...p, skill_generalization: e.target.value }))} className={inputClass}>
                      <option value="">Whether generalization was observed</option>
                      {(noteOptions.skill_generalization ?? GENERALIZATION_OPTIONS).map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass}>Client Transition from Session *</label>
                    <select value={clinicalForm.client_disposition} onChange={e => setClinicalForm(p => ({ ...p, client_disposition: e.target.value }))} className={inputClass}>
                      <option value="">Client behavior transitioning away from session</option>
                      {(noteOptions.client_transition ?? TRANSITION_OPTIONS).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  {driveTimeEnabled && (
                    <>
                      <div className={fieldClass}>
                        <label className={labelClass}>Drive Time (min, max {driveTimeMax})</label>
                        <input type="number" min={0} max={driveTimeMax} value={clinicalForm.drive_time_minutes} onChange={e => setClinicalForm(p => ({ ...p, drive_time_minutes: Math.min(parseInt(e.target.value) || 0, driveTimeMax) }))} className={inputClass} />
                      </div>
                      <div className="flex items-center gap-3 pt-6">
                        <input type="checkbox" id="drive_billable" checked={clinicalForm.drive_time_billable} onChange={e => setClinicalForm(p => ({ ...p, drive_time_billable: e.target.checked }))} className="rounded border-gray-300" />
                        <label htmlFor="drive_billable" className="text-sm text-gray-700">Drive time is billable</label>
                      </div>
                    </>
                  )}
                  <div className="md:col-span-2">
                    <label className={labelClass}>Additional Information</label>
                    <textarea value={clinicalForm.additional_information} onChange={e => setClinicalForm(p => ({ ...p, additional_information: e.target.value }))} placeholder="New behaviors observed, incidents, relevant events..." rows={3} className={inputClass} />
                  </div>
                </div>
                <div className="flex justify-end mt-6">
                  <Button onClick={() => setNewEntryStep("preview")}>Preview Note →</Button>
                </div>
              </div>
            )}

            {/* STEP 5 — PREVIEW + SIGN + SUBMIT */}
            {newEntryStep === "preview" && selectedEVV && selectedClient && (
              <div>
                <button onClick={() => setNewEntryStep("clinical_notes")} className="text-xs text-blue-500 hover:underline mb-3 block">‹ Back to Edit</button>
                <h3 className="font-bold text-gray-800 mb-4">Preview & Submit</h3>
                <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 mb-6 text-sm">
                  <div className="border-b border-gray-100 pb-3">
                    <p className="font-bold text-gray-800 text-base">{selectedClient.full_name}</p>
                    <p className="text-gray-500">{fmtDate(selectedEVV.actual_start)} · {fmtTime(selectedEVV.actual_start)} – {fmtTime(selectedEVV.actual_end)} · {fmt(selectedEVV.session_duration_minutes)}</p>
                    <p className="text-gray-500">{clinicalForm.session_type} · <span className="font-mono font-bold text-blue-700">{clinicalForm.cpt_code}</span></p>
                  </div>
                  {[
                    { label: "Session Location", value: clinicalForm.session_location },
                    { label: "Session Participants", value: clinicalForm.session_participants },
                    { label: "Who Was Present", value: clinicalForm.who_was_present.join(", ") },
                    { label: "Client Readiness", value: clinicalForm.client_readiness },
                    { label: "Evidence of Readiness", value: clinicalForm.evidence_of_readiness },
                    { label: "Antecedents / Barriers", value: clinicalForm.antecedents },
                    { label: "Skill Targets", value: clinicalForm.behaviors_worked_on.join(", ") },
                    { label: "Maladaptive Behaviors", value: clinicalForm.maladaptive_behaviors.join(", ") },
                    { label: "Intervention Techniques", value: clinicalForm.intervention_techniques.join(", ") },
                    { label: "Client Response", value: clinicalForm.client_response_to_interventions },
                    { label: "Evidence of Response", value: clinicalForm.evidence_of_response },
                    { label: "Reinforcement Timing", value: clinicalForm.reinforcement_timing },
                    { label: "Effect of Reinforcement", value: clinicalForm.effect_of_reinforcement },
                    { label: "Reinforcements Used", value: clinicalForm.reinforcements_used },
                    { label: "Treatment Progress", value: clinicalForm.treatment_progress },
                    { label: "Goal Mastery Status", value: clinicalForm.goal_mastery_status },
                    { label: "Skill Generalization", value: clinicalForm.skill_generalization },
                    { label: "Client Transition", value: clinicalForm.client_disposition },
                    { label: "Additional Information", value: clinicalForm.additional_information },
                  ].filter(f => f.value).map(field => (
                    <div key={field.label} className="grid grid-cols-3 gap-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase col-span-1">{field.label}</p>
                      <p className="text-gray-700 col-span-2">{field.value}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-4">
                  <p className="text-sm text-gray-700 mb-4 leading-relaxed">
                    By checking this box I am electronically signing this time entry and attest that I am the service provider for the above client. I have reviewed the time entry details above and performed the services as described for the entire duration from start to end time. I understand that deliberately submitting information that is not accurate constitutes fraud and will result in employment termination and may be punishable by state and federal laws.
                  </p>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                    <span className="text-sm font-semibold text-gray-700">I agree to the terms</span>
                  </label>
                </div>
                <div className="flex gap-3">
                  <Button onClick={saveTimeEntry} loading={saving === "new"} disabled={!agreedToTerms}>Submit Time Entry</Button>
                  <Button variant="outline" onClick={() => setNewEntryStep("clinical_notes")}>Back to Edit</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TABS */}
      <div className="flex border-b border-gray-200">
        {[
          { key: "evv", label: "EVV Records", badge: unbilledEVV.length > 0 ? unbilledEVV.length : null, badgeColor: "bg-purple-500" },
          { key: "entries", label: "Time Entries", badge: pendingCount > 0 ? pendingCount : null, badgeColor: "bg-yellow-500" },
          { key: "drive", label: "🚗 Drive Time", badge: null, badgeColor: "" },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t.label}
            {t.badge && <span className={`${t.badgeColor} text-white text-xs rounded-full px-1.5`}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* EVV RECORDS TAB */}
      {activeTab === "evv" && (
        <div className="space-y-3">
          {evvLoading && <p className="text-gray-400 text-sm">Loading EVV records...</p>}
          {!evvLoading && evvRecords.length === 0 && (
            <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
              <p className="text-3xl mb-3">📋</p>
              <p className="text-gray-600 font-medium">No completed EVV records yet</p>
              <p className="text-gray-400 text-sm mt-1">EVV records appear here after RBTs complete a visit in the mobile app</p>
            </div>
          )}
          {evvRecords.map(evv => {
            const hasEntry = !!evv.time_entry_id;
            return (
              <div key={evv.id} className={`border rounded-xl bg-white overflow-hidden ${!hasEntry ? "border-purple-200" : "border-gray-100"}`}>
                <button type="button" className="w-full text-left p-4" onClick={() => setExpandedEVV(expandedEVV === evv.id ? null : evv.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800">{evv.clients?.full_name ?? "Unknown"}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${!hasEntry ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}`}>
                          {!hasEntry ? "Needs Time Entry" : "✓ Entry Created"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                        <span>📅 {fmtDate(evv.actual_start)}</span>
                        <span>🕐 {fmtTime(evv.actual_start)} – {fmtTime(evv.actual_end)}</span>
                        <span>⏱️ {fmt(evv.session_duration_minutes)}</span>
                        {evv.location_name && <span>📍 {evv.location_name}</span>}
                        {evv.start_geofence_verified && <span className="text-green-600">✓ Geofenced</span>}
                      </div>
                    </div>
                    <span className="text-gray-400 text-xs">{expandedEVV === evv.id ? "▼" : "▶"}</span>
                  </div>
                </button>
                {expandedEVV === evv.id && (
                  <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: "RBT Signature", val: evv.rbt_signature ? "✓ Signed" : "Missing", color: evv.rbt_signature ? "text-green-600" : "text-red-500" },
                        { label: "Guardian", val: evv.guardian_signature ? "✓ Signed" : evv.guardian_unavailable ? "Unavailable" : "Missing", color: evv.guardian_signature ? "text-green-600" : evv.guardian_unavailable ? "text-orange-500" : "text-red-500" },
                        { label: "Behaviors", val: String(evv.behaviors_recorded), color: "text-gray-800" },
                        { label: "Trials", val: String(evv.trials_recorded), color: "text-gray-800" },
                      ].map(item => (
                        <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                          <p className={`font-semibold text-sm ${item.color}`}>{item.val}</p>
                        </div>
                      ))}
                    </div>
                    {!hasEntry && (
                      <div className="pt-2 border-t border-gray-100">
                        <Button onClick={() => { setShowNewEntry(true); setNewEntryStep("select_client"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                          + Create Time Entry from this Visit
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TIME ENTRIES TAB */}
      {activeTab === "entries" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {["all", "draft", "pending", "needs_correction", "approved", "billed"].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-all ${filterStatus === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-300"}`}>
                {s === "all" ? "All" : STATUS_LABELS[s]}
                {s === "pending" && pendingCount > 0 && <span className="ml-1 bg-yellow-500 text-white rounded-full px-1.5 text-xs">{pendingCount}</span>}
                {s === "needs_correction" && correctionCount > 0 && <span className="ml-1 bg-red-500 text-white rounded-full px-1.5 text-xs">{correctionCount}</span>}
              </button>
            ))}
          </div>
          {loading && <p className="text-gray-400 text-sm">Loading...</p>}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
              <p className="text-3xl mb-3">⏱️</p>
              <p className="text-gray-600 font-medium">No time entries found</p>
              <p className="text-gray-400 text-sm mt-1">Click "+ New Time Entry" to create one</p>
            </div>
          )}
          <div className="space-y-3">
            {filtered.map(entry => (
              <div key={entry.id} className="border border-gray-100 rounded-xl bg-white overflow-hidden">
                <button type="button" className="w-full text-left p-4" onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800">{entry.clients?.full_name ?? "Unknown Client"}</p>
                        {isAdmin && (entry as any).profiles && <span className="text-xs text-gray-400">— {(entry as any).profiles.full_name}</span>}
                        {entry.evv_record_id && <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-medium">EVV</span>}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                        <span>📅 {entry.date}</span>
                        <span>⏱️ {fmt(entry.duration_minutes)}</span>
                        <span>{entry.session_type}</span>
                        {entry.cpt_code && <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{entry.cpt_code}</span>}
                        {entry.drive_time_minutes > 0 && <span>🚗 {entry.drive_time_minutes}min{entry.drive_time_billable ? " (billable)" : ""}</span>}
                        {entry.geofence_verified && <span className="text-green-600">✓ Geofenced</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[entry.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABELS[entry.status] ?? entry.status}
                      </span>
                      <span className="text-gray-400 text-xs">{expandedEntry === entry.id ? "▼" : "▶"}</span>
                    </div>
                  </div>
                </button>
                {expandedEntry === entry.id && (
                  <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
                    {[
                      { label: "Session Location", value: entry.session_location },
                      { label: "Session Participants", value: entry.session_participants },
                      { label: "Who Was Present", value: entry.who_was_present?.join(", ") },
                      { label: "Client Readiness", value: entry.client_readiness },
                      { label: "Evidence of Readiness", value: entry.evidence_of_readiness },
                      { label: "Antecedents / Barriers", value: entry.antecedents },
                      { label: "Intervention Techniques", value: entry.intervention_techniques?.join(", ") },
                      { label: "Client Response", value: entry.client_response_to_interventions },
                      { label: "Evidence of Response", value: entry.evidence_of_response },
                      { label: "Reinforcements Used", value: entry.reinforcements_used },
                      { label: "Reinforcement Timing", value: entry.reinforcement_timing },
                      { label: "Effect of Reinforcement", value: entry.effect_of_reinforcement },
                      { label: "Treatment Progress", value: entry.treatment_progress },
                      { label: "Goal Mastery Status", value: entry.goal_mastery_status },
                      { label: "Skill Generalization", value: entry.skill_generalization },
                      { label: "Client Transition", value: entry.client_disposition },
                      { label: "Additional Information", value: entry.additional_information },
                    ].filter(f => f.value).map(field => (
                      <div key={field.label} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-400 font-semibold uppercase mb-1">{field.label}</p>
                        <p className="text-sm text-gray-700">{field.value}</p>
                      </div>
                    ))}
                    {entry.behaviors_worked_on && entry.behaviors_worked_on.length > 0 && (
                      <div className="bg-green-50 rounded-lg p-3">
                        <p className="text-xs text-green-700 font-semibold mb-2 uppercase">Skill Targets</p>
                        {entry.behaviors_worked_on.map(b => (
                          <div key={b} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">{b}</span>
                            {entry.progress_ratings?.[b] && (
                              <span className={`text-xs px-2 py-0.5 rounded font-semibold ${entry.progress_ratings[b] === "Progress" ? "bg-green-100 text-green-700" : entry.progress_ratings[b] === "Regression" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                                {entry.progress_ratings[b]}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {entry.maladaptive_behaviors && entry.maladaptive_behaviors.length > 0 && (
                      <div className="bg-red-50 rounded-lg p-3">
                        <p className="text-xs text-red-700 font-semibold mb-1 uppercase">Maladaptive Behaviors</p>
                        <p className="text-sm text-red-800">{entry.maladaptive_behaviors.join(", ")}</p>
                      </div>
                    )}
                    {entry.status === "needs_correction" && entry.reviewer_notes && (
                      <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                        <p className="text-xs text-red-600 font-semibold mb-1">⚠️ Correction Required</p>
                        <p className="text-sm text-red-800">{entry.reviewer_notes}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                      {!isAdmin && entry.status === "draft" && <Button onClick={() => submitEntry(entry.id)} loading={saving === entry.id}>Submit for Review</Button>}
                      {!isAdmin && entry.status === "needs_correction" && <Button onClick={() => submitEntry(entry.id)} loading={saving === entry.id}>Resubmit</Button>}
                      {isAdmin && entry.status === "pending" && (
                        <>
                          <div className="w-full mb-2">
                            <textarea value={reviewNotes[entry.id] ?? ""} onChange={e => setReviewNotes(prev => ({ ...prev, [entry.id]: e.target.value }))}
                              placeholder="Add review notes (required for rejection)..." rows={2} className={inputClass} />
                          </div>
                          <Button onClick={() => approveEntry(entry.id)} loading={saving === entry.id}>✓ Approve</Button>
                          <Button variant="danger" onClick={() => rejectEntry(entry.id)} loading={saving === entry.id}>✗ Request Correction</Button>
                        </>
                      )}
                      {isAdmin && entry.status === "approved" && <Button onClick={() => markBilled(entry.id)} loading={saving === entry.id}>Mark as Billed</Button>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DRIVE TIME TAB */}
      {activeTab === "drive" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-sm font-semibold text-blue-800 mb-1">🚗 Drive Time Entry</p>
            <p className="text-sm text-blue-700">Calculate drive time between clients. Saves as a <span className="font-mono font-bold">T1016</span> billing entry.</p>
          </div>
          {driveStep === "select" && (
            <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>From: First Client</label>
                  <select value={driveClient1Id} onChange={e => { setDriveClient1Id(e.target.value); if (e.target.value) loadDriveLocations(e.target.value, 1); }} className={inputClass}>
                    <option value="">Select client...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>From: Location</label>
                  <select value={driveLocation1Id} onChange={e => setDriveLocation1Id(e.target.value)} disabled={!driveClient1Id || driveLocations1.length === 0} className={`${inputClass} disabled:opacity-50`}>
                    <option value="">Select location...</option>
                    {driveLocations1.map(l => <option key={l.id} value={l.id}>{l.name} — {l.address}, {l.city}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>To: Second Client</label>
                  <select value={driveClient2Id} onChange={e => { setDriveClient2Id(e.target.value); if (e.target.value) loadDriveLocations(e.target.value, 2); }} className={inputClass}>
                    <option value="">Select client...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>To: Location</label>
                  <select value={driveLocation2Id} onChange={e => setDriveLocation2Id(e.target.value)} disabled={!driveClient2Id || driveLocations2.length === 0} className={`${inputClass} disabled:opacity-50`}>
                    <option value="">Select location...</option>
                    {driveLocations2.map(l => <option key={l.id} value={l.id}>{l.name} — {l.address}, {l.city}</option>)}
                  </select>
                </div>
              </div>
              <Button onClick={calculateDriveEstimate} disabled={!driveLocation1Id || !driveLocation2Id}>
                📍 Calculate Drive Time
              </Button>
            </div>
          )}
          {driveStep === "confirm" && driveEstimated !== null && (
            <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Route Summary</p>
                <p className="text-sm text-gray-800">📍 {driveLocations1.find(l => l.id === driveLocation1Id)?.name} ({clients.find(c => c.id === driveClient1Id)?.full_name})</p>
                <p className="text-xs text-gray-400 ml-5">↓</p>
                <p className="text-sm text-gray-800">📍 {driveLocations2.find(l => l.id === driveLocation2Id)?.name} ({clients.find(c => c.id === driveClient2Id)?.full_name})</p>
                <p className="text-2xl font-bold text-blue-600 mt-3">~{driveEstimated} min estimated</p>
                <p className="text-xs text-gray-400">Based on straight-line distance at 30mph average</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="font-mono font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded text-xs">T1016</span>
                  <span className="text-xs text-gray-500">Drive Time billing code</span>
                </div>
              </div>
              <div>
                <label className={labelClass}>Actual Drive Time (minutes)</label>
                <input type="number" min={0} value={driveActual} onChange={e => setDriveActual(e.target.value)} className={inputClass} />
              </div>
              {driveActual !== String(driveEstimated) && (
                <div>
                  <label className={labelClass}>Reason for Adjustment</label>
                  <textarea value={driveReason} onChange={e => setDriveReason(e.target.value)} placeholder="Traffic, detour, road closure, etc..." rows={2} className={inputClass} />
                </div>
              )}
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setDriveStep("select")}>← Back</Button>
                <Button onClick={saveDriveTime} loading={driveSaving}>✓ Save Drive Time Entry (T1016)</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


