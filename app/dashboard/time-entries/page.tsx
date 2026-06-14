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
  profiles?: { full_name: string };
};

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

const SESSION_TYPES = [
  "Direct Therapy", "Supervision", "Parent Training",
  "Assessment", "Team Meeting", "Telehealth",
];

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

  // EVV → Time Entry conversion form
  const [convertingEVV, setConvertingEVV] = useState<EVVRecord | null>(null);
  const [convertForm, setConvertForm] = useState({
    cpt_code: "97153",
    session_type: "Direct Therapy",
    drive_time_minutes: 0,
    drive_time_billable: false,
    notes: "",
  });

  // Manual entry form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    client_id: "",
    date: new Date().toISOString().split("T")[0],
    start_time: "",
    end_time: "",
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

  const isAdmin = ["bcba", "supervisor", "admin", "clinical_director"].includes(role);

  function openConvertForm(evv: EVVRecord) {
    setConvertingEVV(evv);
    setConvertForm({
      cpt_code: "97153",
      session_type: "Direct Therapy",
      drive_time_minutes: 0,
      drive_time_billable: false,
      notes: "",
    });
  }

  async function createEntryFromEVV() {
    if (!convertingEVV) return;
    setSaving("convert");

    const start = new Date(convertingEVV.actual_start);
    const end = new Date(convertingEVV.actual_end);

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
    }).select().single();

    if (error) {
      alert("Error creating entry: " + error.message);
      setSaving(null);
      return;
    }

    // Link EVV record to the time entry log
    await supabase.from("evv_records").update({
      time_entry_id: data.id,
    }).eq("id", convertingEVV.id);

    setConvertingEVV(null);
    setSaving(null);
    setActiveTab("entries");
    await Promise.all([loadEntries(), loadEVVRecords()]);
  }

  async function submitEntry(id: string) {
    setSaving(id);
    await supabase.from("time_entry_logs").update({
      status: "pending",
      submitted_at: new Date().toISOString(),
    }).eq("id", id);
    await loadEntries();
    setSaving(null);
  }

  async function approveEntry(id: string) {
    setSaving(id);
    await supabase.from("time_entry_logs").update({
      status: "approved",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: reviewNotes[id] ?? null,
    }).eq("id", id);
    await loadEntries();
    setSaving(null);
  }

  async function rejectEntry(id: string) {
    if (!reviewNotes[id]?.trim()) {
      alert("Please add correction notes before rejecting.");
      return;
    }
    setSaving(id);
    await supabase.from("time_entry_logs").update({
      status: "needs_correction",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: reviewNotes[id],
    }).eq("id", id);
    await loadEntries();
    setSaving(null);
  }

  async function markBilled(id: string) {
    setSaving(id);
    await supabase.from("time_entry_logs").update({
      status: "billed",
      billed_at: new Date().toISOString(),
    }).eq("id", id);
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
      company_id: companyId,
      user_id: userId,
      client_id: form.client_id,
      date: form.date,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      duration_minutes: duration,
      session_type: form.session_type,
      cpt_code: form.cpt_code,
      drive_time_minutes: form.drive_time_minutes,
      drive_time_billable: form.drive_time_billable,
      notes: form.notes || null,
      status: "draft",
    });
    setShowForm(false);
    setForm({ client_id: "", date: new Date().toISOString().split("T")[0], start_time: "", end_time: "", session_type: "Direct Therapy", cpt_code: "97153", drive_time_minutes: 0, drive_time_billable: false, notes: "" });
    await loadEntries();
    setSaving(null);
  }

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

  const filtered = filterStatus === "all" ? entries : entries.filter(e => e.status === filterStatus);
  const pendingCount = entries.filter(e => e.status === "pending").length;
  const correctionCount = entries.filter(e => e.status === "needs_correction").length;
  const unbilledEVV = evvRecords.filter(e => !e.time_entry_id);

  return (
    <div className="space-y-6">
      <PageHeader title="Time Entries & EVV">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setShowForm(s => !s); setActiveTab("entries"); }}>
            {showForm ? "Cancel" : "+ Manual Entry"}
          </Button>
        </div>
      </PageHeader>

      {/* SUMMARY STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-xl p-4 bg-purple-50 border-purple-100 text-purple-700">
          <p className="text-xs font-semibold uppercase">EVV Complete</p>
          <p className="text-3xl font-bold mt-1">{evvRecords.length}</p>
          {unbilledEVV.length > 0 && <p className="text-xs mt-1">{unbilledEVV.length} need time entry</p>}
        </div>
        <div className="border rounded-xl p-4 bg-yellow-50 border-yellow-100 text-yellow-700">
          <p className="text-xs font-semibold uppercase">Pending Review</p>
          <p className="text-3xl font-bold mt-1">{pendingCount}</p>
        </div>
        <div className="border rounded-xl p-4 bg-green-50 border-green-100 text-green-700">
          <p className="text-xs font-semibold uppercase">Approved</p>
          <p className="text-3xl font-bold mt-1">{entries.filter(e => e.status === "approved").length}</p>
        </div>
        <div className="border rounded-xl p-4 bg-blue-50 border-blue-100 text-blue-700">
          <p className="text-xs font-semibold uppercase">Billed</p>
          <p className="text-3xl font-bold mt-1">{entries.filter(e => e.status === "billed").length}</p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab("evv")}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === "evv" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          EVV Records
          {unbilledEVV.length > 0 && (
            <span className="ml-2 bg-purple-500 text-white text-xs rounded-full px-1.5">{unbilledEVV.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("entries")}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === "entries" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          Time Entries
          {pendingCount > 0 && (
            <span className="ml-2 bg-yellow-500 text-white text-xs rounded-full px-1.5">{pendingCount}</span>
          )}
        </button>
      </div>

      {/* EVV → TIME ENTRY CONVERSION MODAL */}
      {convertingEVV && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Create Time Entry from EVV</h2>
              <p className="text-sm text-gray-500 mt-1">{convertingEVV.clients?.full_name} — {formatDate(convertingEVV.actual_start)}</p>
            </div>

            <div className="p-6 space-y-4">
              {/* EVV Summary */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">EVV Data (from mobile)</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">Start:</span> <span className="font-semibold">{formatTime(convertingEVV.actual_start)}</span></div>
                  <div><span className="text-gray-500">End:</span> <span className="font-semibold">{formatTime(convertingEVV.actual_end)}</span></div>
                  <div><span className="text-gray-500">Duration:</span> <span className="font-semibold">{formatDuration(convertingEVV.session_duration_minutes)}</span></div>
                  <div><span className="text-gray-500">Location:</span> <span className="font-semibold">{convertingEVV.location_name ?? "—"}</span></div>
                  <div><span className="text-gray-500">Geofence:</span> <span className={convertingEVV.start_geofence_verified ? "text-green-600 font-semibold" : "text-orange-500 font-semibold"}>{convertingEVV.start_geofence_verified ? "✓ Verified" : "⚠️ Not verified"}</span></div>
                  <div><span className="text-gray-500">RBT Sig:</span> <span className={convertingEVV.rbt_signature ? "text-green-600 font-semibold" : "text-red-500 font-semibold"}>{convertingEVV.rbt_signature ? "✓ Signed" : "Missing"}</span></div>
                  <div><span className="text-gray-500">Guardian:</span> <span className={convertingEVV.guardian_signature ? "text-green-600 font-semibold" : "text-orange-500 font-semibold"}>{convertingEVV.guardian_signature ? "✓ Signed" : convertingEVV.guardian_unavailable ? `⚠️ ${convertingEVV.guardian_unavailable_reason}` : "Missing"}</span></div>
                  <div><span className="text-gray-500">Behaviors:</span> <span className="font-semibold">{convertingEVV.behaviors_recorded}</span></div>
                </div>
              </div>

              {/* Billing Fields */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">CPT / Billing Code *</label>
                <select value={convertForm.cpt_code}
                  onChange={e => setConvertForm(p => ({ ...p, cpt_code: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  {CPT_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Session Type</label>
                <select value={convertForm.session_type}
                  onChange={e => setConvertForm(p => ({ ...p, session_type: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  {SESSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {driveTimeEnabled && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Drive Time (min, max {driveTimeMax})</label>
                    <input type="number" min={0} max={driveTimeMax}
                      value={convertForm.drive_time_minutes}
                      onChange={e => setConvertForm(p => ({ ...p, drive_time_minutes: Math.min(parseInt(e.target.value) || 0, driveTimeMax) }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={convertForm.drive_time_billable}
                        onChange={e => setConvertForm(p => ({ ...p, drive_time_billable: e.target.checked }))}
                        className="rounded border-gray-300" />
                      Billable
                    </label>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Billing Notes (optional)</label>
                <textarea value={convertForm.notes}
                  onChange={e => setConvertForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Any notes for billing or review..."
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <Button onClick={createEntryFromEVV} loading={saving === "convert"}>
                Create Time Entry
              </Button>
              <Button variant="outline" onClick={() => setConvertingEVV(null)}>Cancel</Button>
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
                <button type="button" className="w-full text-left p-4"
                  onClick={() => setExpandedEVV(expandedEVV === evv.id ? null : evv.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800">{evv.clients?.full_name ?? "Unknown"}</p>
                        {isAdmin && evv.profiles && (
                          <span className="text-xs text-gray-400">— {(evv.profiles as any)?.full_name}</span>
                        )}
                        {!hasEntry && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">Needs Time Entry</span>
                        )}
                        {hasEntry && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">✓ Entry Created</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                        <span>📅 {formatDate(evv.actual_start)}</span>
                        <span>🕐 {formatTime(evv.actual_start)} – {formatTime(evv.actual_end)}</span>
                        <span>⏱️ {formatDuration(evv.session_duration_minutes)}</span>
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
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">RBT Signature</p>
                        <p className={`font-semibold text-sm ${evv.rbt_signature ? "text-green-600" : "text-red-500"}`}>
                          {evv.rbt_signature ? "✓ Signed" : "Missing"}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Guardian</p>
                        <p className={`font-semibold text-sm ${evv.guardian_signature ? "text-green-600" : evv.guardian_unavailable ? "text-orange-500" : "text-red-500"}`}>
                          {evv.guardian_signature ? "✓ Signed" : evv.guardian_unavailable ? "Unavailable" : "Missing"}
                        </p>
                        {evv.guardian_unavailable && evv.guardian_unavailable_reason && (
                          <p className="text-xs text-gray-400 mt-0.5">{evv.guardian_unavailable_reason}</p>
                        )}
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Behaviors</p>
                        <p className="font-semibold text-sm text-gray-800">{evv.behaviors_recorded}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Trials</p>
                        <p className="font-semibold text-sm text-gray-800">{evv.trials_recorded}</p>
                      </div>
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

                    {!hasEntry && (
                      <div className="pt-2 border-t border-gray-100">
                        <Button onClick={() => openConvertForm(evv)}>
                          + Create Time Entry from this Visit
                        </Button>
                      </div>
                    )}
                    {hasEntry && (
                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-xs text-green-600 font-semibold">✓ Time entry created and linked to this EVV record</p>
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
          {/* MANUAL ENTRY FORM */}
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

          {/* FILTERS */}
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
                <button type="button" className="w-full text-left p-4"
                  onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800">{entry.clients?.full_name ?? "Unknown Client"}</p>
                        {isAdmin && entry.profiles && (
                          <span className="text-xs text-gray-400">— {entry.profiles.full_name}</span>
                        )}
                        {entry.evv_record_id && (
                          <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-medium">EVV</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                        <span>📅 {entry.date}</span>
                        <span>⏱️ {formatDuration(entry.duration_minutes)}</span>
                        <span>{entry.session_type}</span>
                        {entry.cpt_code && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">{entry.cpt_code}</span>}
                        {entry.drive_time_minutes > 0 && <span>🚗 {entry.drive_time_minutes}min drive{entry.drive_time_billable ? " (billable)" : ""}</span>}
                        {entry.geofence_verified && <span className="text-green-600">✓ Geofenced</span>}
                        {(entry.start_time_adjusted || entry.end_time_adjusted) && <span className="text-orange-500">⚠️ Time adjusted</span>}
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
                        <p className="font-semibold text-gray-800">{formatTime(entry.start_time)}</p>
                        {entry.start_time_adjusted && <p className="text-xs text-orange-500 mt-1">⚠️ {entry.start_adjustment_reason}</p>}
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">End Time</p>
                        <p className="font-semibold text-gray-800">{formatTime(entry.end_time)}</p>
                        {entry.end_time_adjusted && <p className="text-xs text-orange-500 mt-1">⚠️ {entry.end_adjustment_reason}</p>}
                      </div>
                    </div>
                    {entry.location_name && (
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-blue-600 font-semibold mb-1">📍 Location</p>
                        <p className="text-sm text-blue-800">{entry.location_name} {entry.geofence_verified ? "✓ Verified" : "⚠️ Not verified"}</p>
                      </div>
                    )}
                    {entry.drive_time_minutes > 0 && (
                      <div className="bg-purple-50 rounded-lg p-3">
                        <p className="text-xs text-purple-600 font-semibold mb-1">🚗 Drive Time</p>
                        <p className="text-sm text-purple-800">{entry.drive_time_minutes} minutes {entry.drive_time_billable ? "— Billable" : "— Not billable"}</p>
                      </div>
                    )}
                    {entry.notes && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 font-semibold mb-1">Session Notes</p>
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
                      {!isAdmin && entry.status === "draft" && (
                        <Button onClick={() => submitEntry(entry.id)} loading={saving === entry.id}>Submit for Review</Button>
                      )}
                      {!isAdmin && entry.status === "needs_correction" && (
                        <Button onClick={() => submitEntry(entry.id)} loading={saving === entry.id}>Resubmit</Button>
                      )}
                      {isAdmin && entry.status === "pending" && (
                        <>
                          <div className="w-full mb-2">
                            <textarea value={reviewNotes[entry.id] ?? ""}
                              onChange={e => setReviewNotes(prev => ({ ...prev, [entry.id]: e.target.value }))}
                              placeholder="Add review notes (required for rejection)..."
                              rows={2}
                              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                          </div>
                          <Button onClick={() => approveEntry(entry.id)} loading={saving === entry.id}>✓ Approve</Button>
                          <Button variant="danger" onClick={() => rejectEntry(entry.id)} loading={saving === entry.id}>✗ Request Correction</Button>
                        </>
                      )}
                      {isAdmin && entry.status === "approved" && (
                        <Button onClick={() => markBilled(entry.id)} loading={saving === entry.id}>Mark as Billed</Button>
                      )}
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