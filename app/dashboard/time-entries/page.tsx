"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";

type TimeEntry = {
  id: string;
  user_id: string;
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
  clinical_notes: string | null;
  status: string;
  submitted_at: string | null;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  location_name: string | null;
  geofence_verified: boolean;
  start_time_adjusted: boolean;
  start_adjustment_reason: string | null;
  end_time_adjusted: boolean;
  end_adjustment_reason: string | null;
  created_at: string;
  evv_record_id?: string | null;
  behaviors_worked_on: string[] | null;
  maladaptive_behaviors: string[] | null;
  progress_ratings: Record<string, string> | null;
  reinforcements_used: string | null;
  reinforcements_worked: boolean | null;
  reinforcements_timing: string | null;
  antecedents: string | null;
  who_was_present: string[] | null;
  client_readiness: string | null;
  client_disposition: string | null;
  clients?: { full_name: string };
  profiles?: { full_name: string; role: string };
};

type EVVRecord = {
  id: string;
  client_id: string;
  date: string;
  actual_start: string;
  actual_end: string;
  session_duration_minutes: number;
  location_name: string | null;
  start_geofence_verified: boolean;
  end_geofence_verified: boolean;
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

type Behavior = { id: string; name: string; category: string };
type SkillTarget = { id: string; program_name: string; target_name: string };

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  pending: "bg-yellow-100 text-yellow-700",
  needs_correction: "bg-red-100 text-red-700",
  approved: "bg-green-100 text-green-700",
  billed: "bg-blue-100 text-blue-700",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "Pending Review",
  needs_correction: "Needs Correction",
  approved: "Approved",
  billed: "Billed",
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
  const [clients, setClients] = useState<{ id: string; full_name: string }[]>([]);
  const [activeTab, setActiveTab] = useState<"evv" | "entries">("evv");

  // Client behaviors/skills for the convert form
  const [clientBehaviors, setClientBehaviors] = useState<Behavior[]>([]);
  const [clientSkills, setClientSkills] = useState<SkillTarget[]>([]);

  // EVV → Time Entry conversion form
  const [convertingEVV, setConvertingEVV] = useState<EVVRecord | null>(null);
  const [convertStep, setConvertStep] = useState<"billing" | "clinical">("billing");
  const [convertForm, setConvertForm] = useState({
    cpt_code: "97153",
    session_type: "Direct Therapy",
    drive_time_minutes: 0,
    drive_time_billable: false,
    notes: "",
    behaviors_worked_on: [] as string[],
    maladaptive_behaviors: [] as string[],
    progress_ratings: {} as Record<string, string>,
    reinforcements_used: "",
    reinforcements_worked: null as boolean | null,
    reinforcements_timing: "",
    antecedents: "",
    who_was_present: [] as string[],
    client_readiness: "",
    client_disposition: "",
    clinical_notes: "",
  });

  // Manual entry form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    client_id: "", date: new Date().toISOString().split("T")[0],
    start_time: "", end_time: "", session_type: "Direct Therapy",
    cpt_code: "97153", drive_time_minutes: 0, drive_time_billable: false, notes: "",
  });

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

  async function loadEntries(cId?: string, uId?: string, r?: string) {
    const isAdmin = ["bcba", "supervisor", "admin", "clinical_director"].includes(r ?? role);
    let query = supabase
      .from("time_entry_logs")
      .select("*, clients(full_name), profiles(full_name, role)")
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

  async function loadClientData(clientId: string) {
    const [{ data: behaviors }, { data: skills }] = await Promise.all([
      supabase.from("custom_behaviors").select("id, name, category").eq("client_id", clientId).eq("is_active", true).order("display_order"),
      supabase.from("skill_targets").select("id, program_name, target_name").eq("client_id", clientId).eq("is_active", true).order("display_order"),
    ]);
    setClientBehaviors(behaviors ?? []);
    setClientSkills(skills ?? []);
  }

  const isAdmin = ["bcba", "supervisor", "admin", "clinical_director"].includes(role);

  async function openConvertForm(evv: EVVRecord) {
    setConvertingEVV(evv);
    setConvertStep("billing");
    setConvertForm({
      cpt_code: "97153", session_type: "Direct Therapy",
      drive_time_minutes: 0, drive_time_billable: false, notes: "",
      behaviors_worked_on: [], maladaptive_behaviors: [], progress_ratings: {},
      reinforcements_used: "", reinforcements_worked: null, reinforcements_timing: "",
      antecedents: "", who_was_present: [], client_readiness: "",
      client_disposition: "", clinical_notes: "",
    });
    await loadClientData(evv.client_id);
  }

  function toggleArray(arr: string[], val: string): string[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  }

  async function createEntryFromEVV() {
    if (!convertingEVV) return;
    setSaving("convert");

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
      status: "draft",
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

    if (error) { alert("Error: " + error.message); setSaving(null); return; }

    await supabase.from("evv_records").update({ time_entry_id: data.id }).eq("id", convertingEVV.id);

    setConvertingEVV(null);
    setSaving(null);
    setActiveTab("entries");
    await Promise.all([loadEntries(), loadEVVRecords()]);
  }

  async function submitEntry(id: string) {
    setSaving(id);
    await supabase.from("time_entry_logs").update({ status: "pending", submitted_at: new Date().toISOString() }).eq("id", id);
    await loadEntries();
    setSaving(null);
  }

  async function approveEntry(id: string) {
    setSaving(id);
    await supabase.from("time_entry_logs").update({ status: "approved", reviewed_by: userId, reviewed_at: new Date().toISOString(), reviewer_notes: reviewNotes[id] ?? null }).eq("id", id);
    await loadEntries();
    setSaving(null);
  }

  async function rejectEntry(id: string) {
    if (!reviewNotes[id]?.trim()) { alert("Please add correction notes before rejecting."); return; }
    setSaving(id);
    await supabase.from("time_entry_logs").update({ status: "needs_correction", reviewed_by: userId, reviewed_at: new Date().toISOString(), reviewer_notes: reviewNotes[id] }).eq("id", id);
    await loadEntries();
    setSaving(null);
  }

  async function markBilled(id: string) {
    setSaving(id);
    await supabase.from("time_entry_logs").update({ status: "billed", billed_at: new Date().toISOString() }).eq("id", id);
    await loadEntries();
    setSaving(null);
  }

  async function saveEntry() {
    if (!form.client_id || !form.start_time || !form.end_time) return;
    setSaving("new");
    const start = new Date(`${form.date}T${form.start_time}`);
    const end = new Date(`${form.date}T${form.end_time}`);
    const duration = Math.floor((end.getTime() - start.getTime()) / 60000);
    await supabase.from("time_entry_logs").insert({
      company_id: companyId, user_id: userId, client_id: form.client_id,
      date: form.date, start_time: start.toISOString(), end_time: end.toISOString(),
      duration_minutes: duration, session_type: form.session_type, cpt_code: form.cpt_code,
      drive_time_minutes: form.drive_time_minutes, drive_time_billable: form.drive_time_billable,
      notes: form.notes || null, status: "draft",
    });
    setShowForm(false);
    setForm({ client_id: "", date: new Date().toISOString().split("T")[0], start_time: "", end_time: "", session_type: "Direct Therapy", cpt_code: "97153", drive_time_minutes: 0, drive_time_billable: false, notes: "" });
    await loadEntries();
    setSaving(null);
  }

  const fmt = (minutes: number) => { const h = Math.floor(minutes / 60); const m = minutes % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; };
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

  const filtered = filterStatus === "all" ? entries : entries.filter(e => e.status === filterStatus);
  const pendingCount = entries.filter(e => e.status === "pending").length;
  const correctionCount = entries.filter(e => e.status === "needs_correction").length;
  const unbilledEVV = evvRecords.filter(e => !e.time_entry_id);

  const chip = (label: string, active: boolean, onClick: () => void) => (
    <button key={label} type="button" onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-300"}`}>
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Time Entries & EVV">
        <Button variant="outline" onClick={() => { setShowForm(s => !s); setActiveTab("entries"); }}>
          {showForm ? "Cancel" : "+ Manual Entry"}
        </Button>
      </PageHeader>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "EVV Complete", val: evvRecords.length, sub: unbilledEVV.length > 0 ? `${unbilledEVV.length} need entry` : undefined, color: "bg-purple-50 border-purple-100 text-purple-700" },
          { label: "Pending Review", val: pendingCount, color: "bg-yellow-50 border-yellow-100 text-yellow-700" },
          { label: "Approved", val: entries.filter(e => e.status === "approved").length, color: "bg-green-50 border-green-100 text-green-700" },
          { label: "Billed", val: entries.filter(e => e.status === "billed").length, color: "bg-blue-50 border-blue-100 text-blue-700" },
        ].map(s => (
          <div key={s.label} className={`border rounded-xl p-4 ${s.color}`}>
            <p className="text-xs font-semibold uppercase">{s.label}</p>
            <p className="text-3xl font-bold mt-1">{s.val}</p>
            {s.sub && <p className="text-xs mt-1">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="flex border-b border-gray-200">
        {[
          { key: "evv", label: "EVV Records", badge: unbilledEVV.length > 0 ? unbilledEVV.length : null, badgeColor: "bg-purple-500" },
          { key: "entries", label: "Time Entries", badge: pendingCount > 0 ? pendingCount : null, badgeColor: "bg-yellow-500" },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t.label}
            {t.badge && <span className={`${t.badgeColor} text-white text-xs rounded-full px-1.5`}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* EVV → TIME ENTRY MODAL */}
      {convertingEVV && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Create Time Entry from EVV</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{convertingEVV.clients?.full_name} — {fmtDate(convertingEVV.actual_start)}</p>
                </div>
                <button onClick={() => setConvertingEVV(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
              {/* Step indicator */}
              <div className="flex gap-2 mt-4">
                {["billing", "clinical"].map((s, i) => (
                  <button key={s} type="button" onClick={() => setConvertStep(s as any)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${convertStep === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${convertStep === s ? "bg-white text-blue-600" : "bg-gray-300 text-gray-600"}`}>{i + 1}</span>
                    {s === "billing" ? "Billing Info" : "Clinical Notes"}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              {/* EVV Summary — always visible */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">From EVV Record</p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><span className="text-gray-500">Date:</span> <span className="font-semibold">{fmtDate(convertingEVV.actual_start)}</span></div>
                  <div><span className="text-gray-500">Start:</span> <span className="font-semibold">{fmtTime(convertingEVV.actual_start)}</span></div>
                  <div><span className="text-gray-500">End:</span> <span className="font-semibold">{fmtTime(convertingEVV.actual_end)}</span></div>
                  <div><span className="text-gray-500">Duration:</span> <span className="font-semibold">{fmt(convertingEVV.session_duration_minutes)}</span></div>
                  <div><span className="text-gray-500">Location:</span> <span className="font-semibold">{convertingEVV.location_name ?? "—"}</span></div>
                  <div><span className="text-gray-500">Geofence:</span> <span className={convertingEVV.start_geofence_verified ? "text-green-600 font-semibold" : "text-orange-500 font-semibold"}>{convertingEVV.start_geofence_verified ? "✓ Verified" : "⚠️ Not verified"}</span></div>
                </div>
              </div>

              {/* STEP 1 — BILLING */}
              {convertStep === "billing" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">CPT / Billing Code *</label>
                      <select value={convertForm.cpt_code} onChange={e => setConvertForm(p => ({ ...p, cpt_code: e.target.value }))}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                        {CPT_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Session Type</label>
                      <select value={convertForm.session_type} onChange={e => setConvertForm(p => ({ ...p, session_type: e.target.value }))}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                        {SESSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  {driveTimeEnabled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Drive Time (min, max {driveTimeMax})</label>
                        <input type="number" min={0} max={driveTimeMax} value={convertForm.drive_time_minutes}
                          onChange={e => setConvertForm(p => ({ ...p, drive_time_minutes: Math.min(parseInt(e.target.value) || 0, driveTimeMax) }))}
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div className="flex items-end pb-2">
                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <input type="checkbox" checked={convertForm.drive_time_billable}
                            onChange={e => setConvertForm(p => ({ ...p, drive_time_billable: e.target.checked }))}
                            className="rounded border-gray-300" />
                          Drive time is billable
                        </label>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Billing Notes</label>
                    <textarea value={convertForm.notes} onChange={e => setConvertForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Notes for billing review..." rows={2}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Who Was Present</label>
                    <div className="flex flex-wrap gap-2">
                      {PRESENT_OPTIONS.map(p => chip(p, convertForm.who_was_present.includes(p), () => setConvertForm(f => ({ ...f, who_was_present: toggleArray(f.who_was_present, p) }))))}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={() => setConvertStep("clinical")}>Next: Clinical Notes →</Button>
                  </div>
                </div>
              )}

              {/* STEP 2 — CLINICAL */}
              {convertStep === "clinical" && (
                <div className="space-y-5">
                  {/* Client Readiness */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Client Readiness at Start of Session</label>
                    <div className="flex flex-wrap gap-2">
                      {READINESS_OPTIONS.map(r => chip(r, convertForm.client_readiness === r, () => setConvertForm(f => ({ ...f, client_readiness: f.client_readiness === r ? "" : r }))))}
                    </div>
                  </div>

                  {/* Behaviors Worked On */}
                  {clientSkills.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Skill Targets Worked On</label>
                      <div className="flex flex-wrap gap-2">
                        {clientSkills.map(s => {
                          const key = `${s.program_name}: ${s.target_name}`;
                          return chip(key, convertForm.behaviors_worked_on.includes(key), () => setConvertForm(f => ({ ...f, behaviors_worked_on: toggleArray(f.behaviors_worked_on, key) })));
                        })}
                      </div>
                    </div>
                  )}

                  {/* Progress per skill */}
                  {convertForm.behaviors_worked_on.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Progress Per Target</label>
                      <div className="space-y-2">
                        {convertForm.behaviors_worked_on.map(target => (
                          <div key={target} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                            <span className="text-sm text-gray-700 flex-1">{target}</span>
                            <div className="flex gap-1">
                              {PROGRESS_OPTIONS.map(p => (
                                <button key={p} type="button"
                                  onClick={() => setConvertForm(f => ({ ...f, progress_ratings: { ...f.progress_ratings, [target]: p } }))}
                                  className={`text-xs px-2 py-1 rounded border transition-all ${convertForm.progress_ratings[target] === p ? (p === "Progress" ? "bg-green-500 text-white border-green-500" : p === "Regression" ? "bg-red-500 text-white border-red-500" : "bg-yellow-500 text-white border-yellow-500") : "bg-white text-gray-600 border-gray-300"}`}>
                                  {p}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Maladaptive Behaviors */}
                  {clientBehaviors.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Maladaptive Behaviors Observed</label>
                      <div className="flex flex-wrap gap-2">
                        {clientBehaviors.map(b => chip(b.name, convertForm.maladaptive_behaviors.includes(b.name), () => setConvertForm(f => ({ ...f, maladaptive_behaviors: toggleArray(f.maladaptive_behaviors, b.name) }))))}
                      </div>
                    </div>
                  )}

                  {/* Antecedents */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Antecedents Noted</label>
                    <textarea value={convertForm.antecedents} onChange={e => setConvertForm(p => ({ ...p, antecedents: e.target.value }))}
                      placeholder="What happened before any behaviors? Environmental triggers, demands, transitions..." rows={2}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>

                  {/* Reinforcements */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Reinforcements Used</label>
                      <input type="text" value={convertForm.reinforcements_used}
                        onChange={e => setConvertForm(p => ({ ...p, reinforcements_used: e.target.value }))}
                        placeholder="e.g. iPad time, verbal praise, token board, preferred snack..."
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Did They Work?</label>
                        <div className="flex gap-2">
                          {["Yes", "No", "Partially"].map(opt => chip(opt, convertForm.reinforcements_worked === (opt === "Yes") && !(opt === "Partially" && convertForm.reinforcements_worked !== null), () => setConvertForm(p => ({ ...p, reinforcements_worked: opt === "Yes" ? true : opt === "No" ? false : null }))))}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">When Introduced</label>
                        <select value={convertForm.reinforcements_timing} onChange={e => setConvertForm(p => ({ ...p, reinforcements_timing: e.target.value }))}
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                          <option value="">Select...</option>
                          {REINFORCEMENT_TIMING.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Client Disposition */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Client Disposition When Leaving Session</label>
                    <div className="flex flex-wrap gap-2">
                      {DISPOSITION_OPTIONS.map(d => chip(d, convertForm.client_disposition === d, () => setConvertForm(f => ({ ...f, client_disposition: f.client_disposition === d ? "" : d }))))}
                    </div>
                  </div>

                  {/* Clinical Notes */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Clinical Session Notes</label>
                    <textarea value={convertForm.clinical_notes} onChange={e => setConvertForm(p => ({ ...p, clinical_notes: e.target.value }))}
                      placeholder="Overall session summary, anything notable, follow-up items for BCBA..." rows={4}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={() => setConvertStep("billing")}>← Back</Button>
                    <Button onClick={createEntryFromEVV} loading={saving === "convert"}>✓ Create Time Entry</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
                    {evv.rbt_signature && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-2 font-semibold">RBT Signature</p>
                        <img src={evv.rbt_signature} alt="RBT Signature" className="max-h-16 border border-gray-200 rounded bg-white p-1" />
                      </div>
                    )}
                    {evv.guardian_signature && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-2 font-semibold">Guardian Signature</p>
                        <img src={evv.guardian_signature} alt="Guardian Signature" className="max-h-16 border border-gray-200 rounded bg-white p-1" />
                      </div>
                    )}
                    {!hasEntry ? (
                      <div className="pt-2 border-t border-gray-100">
                        <Button onClick={() => openConvertForm(evv)}>+ Create Time Entry from this Visit</Button>
                      </div>
                    ) : (
                      <p className="text-xs text-green-600 font-semibold pt-2 border-t border-gray-100">✓ Time entry created and linked to this EVV record</p>
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
          {showForm && (
            <Section title="Manual Time Entry">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
                  <select value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="">Select client...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Date *</label>
                  <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Start Time *</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">End Time *</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Session Type</label>
                  <select value={form.session_type} onChange={e => setForm(p => ({ ...p, session_type: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    {SESSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">CPT Code</label>
                  <select value={form.cpt_code} onChange={e => setForm(p => ({ ...p, cpt_code: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    {CPT_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                </div>
                {driveTimeEnabled && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Drive Time (min, max {driveTimeMax})</label>
                      <input type="number" min={0} max={driveTimeMax} value={form.drive_time_minutes}
                        onChange={e => setForm(p => ({ ...p, drive_time_minutes: Math.min(parseInt(e.target.value) || 0, driveTimeMax) }))}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <div className="flex items-center gap-3 pt-6">
                      <input type="checkbox" id="drive_billable" checked={form.drive_time_billable}
                        onChange={e => setForm(p => ({ ...p, drive_time_billable: e.target.checked }))}
                        className="rounded border-gray-300" />
                      <label htmlFor="drive_billable" className="text-sm text-gray-700">Drive time is billable</label>
                    </div>
                  </>
                )}
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Session Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Session summary, behaviors observed, programs targeted..."
                    rows={3} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={saveEntry} loading={saving === "new"}>Save Entry</Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </Section>
          )}

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
              <p className="text-gray-400 text-sm mt-1">Create one from an EVV record above, or use Manual Entry</p>
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
                        {isAdmin && entry.profiles && <span className="text-xs text-gray-400">— {entry.profiles.full_name}</span>}
                        {entry.evv_record_id && <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-medium">EVV</span>}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                        <span>📅 {entry.date}</span>
                        <span>⏱️ {fmt(entry.duration_minutes)}</span>
                        <span>{entry.session_type}</span>
                        {entry.cpt_code && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">{entry.cpt_code}</span>}
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
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Start Time</p>
                        <p className="font-semibold text-gray-800">{fmtTime(entry.start_time)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">End Time</p>
                        <p className="font-semibold text-gray-800">{fmtTime(entry.end_time)}</p>
                      </div>
                    </div>
                    {entry.location_name && (
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-blue-600 font-semibold mb-1">📍 Location</p>
                        <p className="text-sm text-blue-800">{entry.location_name} {entry.geofence_verified ? "✓" : "⚠️"}</p>
                      </div>
                    )}
                    {entry.who_was_present && entry.who_was_present.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 font-semibold mb-1">Who Was Present</p>
                        <p className="text-sm text-gray-700">{entry.who_was_present.join(", ")}</p>
                      </div>
                    )}
                    {entry.client_readiness && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 font-semibold mb-1">Client Readiness</p>
                        <p className="text-sm text-gray-700">{entry.client_readiness}</p>
                      </div>
                    )}
                    {entry.behaviors_worked_on && entry.behaviors_worked_on.length > 0 && (
                      <div className="bg-green-50 rounded-lg p-3">
                        <p className="text-xs text-green-700 font-semibold mb-2">Skill Targets Worked On</p>
                        <div className="space-y-1">
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
                      </div>
                    )}
                    {entry.maladaptive_behaviors && entry.maladaptive_behaviors.length > 0 && (
                      <div className="bg-red-50 rounded-lg p-3">
                        <p className="text-xs text-red-700 font-semibold mb-1">Maladaptive Behaviors Observed</p>
                        <p className="text-sm text-red-800">{entry.maladaptive_behaviors.join(", ")}</p>
                      </div>
                    )}
                    {entry.antecedents && (
                      <div className="bg-orange-50 rounded-lg p-3">
                        <p className="text-xs text-orange-700 font-semibold mb-1">Antecedents</p>
                        <p className="text-sm text-orange-800">{entry.antecedents}</p>
                      </div>
                    )}
                    {entry.reinforcements_used && (
                      <div className="bg-purple-50 rounded-lg p-3">
                        <p className="text-xs text-purple-700 font-semibold mb-1">Reinforcements</p>
                        <p className="text-sm text-purple-800">{entry.reinforcements_used}</p>
                        {entry.reinforcements_worked !== null && <p className="text-xs text-purple-600 mt-1">Worked: {entry.reinforcements_worked ? "Yes" : "No"} {entry.reinforcements_timing ? `— ${entry.reinforcements_timing}` : ""}</p>}
                      </div>
                    )}
                    {entry.client_disposition && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 font-semibold mb-1">Client Disposition at End</p>
                        <p className="text-sm text-gray-700">{entry.client_disposition}</p>
                      </div>
                    )}
                    {entry.clinical_notes && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 font-semibold mb-1">Clinical Notes</p>
                        <p className="text-sm text-gray-700">{entry.clinical_notes}</p>
                      </div>
                    )}
                    {entry.notes && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 font-semibold mb-1">Billing Notes</p>
                        <p className="text-sm text-gray-700">{entry.notes}</p>
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
                              placeholder="Add review notes (required for rejection)..." rows={2}
                              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
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
    </div>
  );
}