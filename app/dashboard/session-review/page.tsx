"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Link from "next/link";

type TimeEntry = {
  id: string; user_id: string; client_id: string; date: string;
  start_time: string; end_time: string; duration_minutes: number;
  session_type: string; cpt_code: string | null;
  drive_time_minutes: number; drive_time_billable: boolean;
  notes: string | null; status: string;
  submitted_at: string | null; reviewer_notes: string | null;
  location_name: string | null; geofence_verified: boolean;
  evv_record_id: string | null;
  session_location: string | null; session_participants: string | null;
  who_was_present: string[] | null; client_readiness: string | null;
  evidence_of_readiness: string | null; antecedents: string | null;
  behaviors_worked_on: string[] | null; maladaptive_behaviors: string[] | null;
  progress_ratings: Record<string, string> | null;
  intervention_techniques: string[] | null;
  client_response_to_interventions: string | null;
  evidence_of_response: string | null; reinforcements_used: string | null;
  reinforcements_worked: boolean | null; reinforcement_timing: string | null;
  effect_of_reinforcement: string | null; treatment_progress: string | null;
  goal_mastery_status: string | null; skill_generalization: string | null;
  client_disposition: string | null; additional_information: string | null;
  clients?: { full_name: string };
  profiles?: { full_name: string; role: string };
};

export default function SessionReviewPage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("pending");

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

    await loadEntries(companyUser?.company_id);
  }

  async function loadEntries(cId?: string) {
    const { data } = await supabase
      .from("time_entry_logs")
      .select("*, clients(full_name), profiles(full_name, role)")
      .eq("company_id", cId ?? companyId)
      .in("status", ["pending", "needs_correction", "approved", "billed"])
      .order("submitted_at", { ascending: false })
      .limit(100);
    setEntries(data ?? []);
    setLoading(false);
  }

  async function approveEntry(id: string) {
    setSaving(id);
    await supabase.from("time_entry_logs").update({
      status: "approved",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: reviewNotes[id] || null,
    }).eq("id", id);
    await loadEntries();
    setSaving(null);
  }

  async function rejectEntry(id: string) {
    if (!reviewNotes[id]?.trim()) { alert("Please add correction notes before rejecting."); return; }
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

  const fmt = (m: number) => { const h = Math.floor(m / 60); const min = m % 60; return h > 0 ? `${h}h ${min}m` : `${min}m`; };
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    needs_correction: "bg-red-100 text-red-700",
    approved: "bg-green-100 text-green-700",
    billed: "bg-blue-100 text-blue-700",
  };
  const STATUS_LABELS: Record<string, string> = {
    pending: "Pending Review", needs_correction: "Needs Correction",
    approved: "Approved", billed: "Billed",
  };

  const filtered = filterStatus === "all" ? entries : entries.filter(e => e.status === filterStatus);
  const pendingCount = entries.filter(e => e.status === "pending").length;
  const approvedCount = entries.filter(e => e.status === "approved").length;
  const correctionCount = entries.filter(e => e.status === "needs_correction").length;
  const billedCount = entries.filter(e => e.status === "billed").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Session Review Queue">
        <Link href="/dashboard/time-entries">
          <Button variant="outline">‹ Time Entries</Button>
        </Link>
      </PageHeader>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Pending Review", val: pendingCount, color: "bg-yellow-50 border-yellow-100 text-yellow-700", key: "pending" },
          { label: "Needs Correction", val: correctionCount, color: "bg-red-50 border-red-100 text-red-700", key: "needs_correction" },
          { label: "Approved", val: approvedCount, color: "bg-green-50 border-green-100 text-green-700", key: "approved" },
          { label: "Billed", val: billedCount, color: "bg-blue-50 border-blue-100 text-blue-700", key: "billed" },
        ].map(s => (
          <button key={s.key} onClick={() => setFilterStatus(s.key)}
            className={`border rounded-xl p-4 text-left transition-all ${s.color} ${filterStatus === s.key ? "ring-2 ring-offset-1 ring-blue-400" : ""}`}>
            <p className="text-xs font-semibold uppercase">{s.label}</p>
            <p className="text-3xl font-bold mt-1">{s.val}</p>
          </button>
        ))}
      </div>

      {/* FILTER TABS */}
      <div className="flex gap-2 flex-wrap">
        {["all", "pending", "needs_correction", "approved", "billed"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-all ${filterStatus === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-300"}`}>
            {s === "all" ? "All" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-semibold text-gray-700">No entries in this category</p>
          <p className="text-sm text-gray-400 mt-1">All caught up!</p>
        </div>
      )}

      <div className="space-y-4">
        {filtered.map(entry => (
          <div key={entry.id} className={`border rounded-2xl bg-white overflow-hidden ${entry.status === "pending" ? "border-yellow-200" : entry.status === "needs_correction" ? "border-red-200" : entry.status === "approved" ? "border-green-200" : "border-gray-100"}`}>
            {/* HEADER */}
            <button type="button" className="w-full text-left p-5" onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-bold text-gray-900">{entry.clients?.full_name ?? "Unknown Client"}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[entry.status]}`}>
                      {STATUS_LABELS[entry.status]}
                    </span>
                    {entry.evv_record_id && <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-medium">EVV</span>}
                  </div>
                  {entry.profiles && <p className="text-sm text-gray-500">RBT: {entry.profiles.full_name}</p>}
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                    <span>📅 {entry.date}</span>
                    <span>⏱️ {fmt(entry.duration_minutes)}</span>
                    <span>{entry.session_type}</span>
                    {entry.cpt_code && <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{entry.cpt_code}</span>}
                    {entry.location_name && <span>📍 {entry.location_name}</span>}
                    {entry.submitted_at && <span className="text-gray-400">Submitted {fmtDate(entry.submitted_at)}</span>}
                  </div>
                </div>
                <span className="text-gray-400 text-sm">{expandedId === entry.id ? "▼" : "▶"}</span>
              </div>
            </button>

            {/* EXPANDED CLINICAL NOTE */}
            {expandedId === entry.id && (
              <div className="border-t border-gray-100 p-5 space-y-4">

                {/* Full clinical note display */}
                <div className="bg-gray-50 rounded-xl p-5 space-y-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Clinical Note</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { label: "Session Location", value: entry.session_location },
                      { label: "Session Participants", value: entry.session_participants },
                      { label: "Who Was Present", value: entry.who_was_present?.join(", ") },
                      { label: "Client Readiness", value: entry.client_readiness },
                      { label: "Evidence of Readiness", value: entry.evidence_of_readiness },
                      { label: "Antecedents / Barriers", value: entry.antecedents },
                      { label: "Client Response", value: entry.client_response_to_interventions },
                      { label: "Evidence of Response", value: entry.evidence_of_response },
                      { label: "Reinforcement Timing", value: entry.reinforcement_timing },
                      { label: "Effect of Reinforcement", value: entry.effect_of_reinforcement },
                      { label: "Reinforcements Used", value: entry.reinforcements_used },
                      { label: "Treatment Progress", value: entry.treatment_progress },
                      { label: "Goal Mastery Status", value: entry.goal_mastery_status },
                      { label: "Skill Generalization", value: entry.skill_generalization },
                      { label: "Client Transition", value: entry.client_disposition },
                      { label: "Additional Information", value: entry.additional_information },
                    ].filter(f => f.value).map(field => (
                      <div key={field.label} className="bg-white rounded-lg p-3">
                        <p className="text-xs font-bold text-gray-400 uppercase mb-1">{field.label}</p>
                        <p className="text-sm text-gray-700">{field.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Skill targets */}
                  {entry.behaviors_worked_on && entry.behaviors_worked_on.length > 0 && (
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs font-bold text-green-700 uppercase mb-2">Skill Targets</p>
                      {entry.behaviors_worked_on.map(b => (
                        <div key={b} className="flex items-center justify-between text-sm py-1 border-b border-green-100 last:border-0">
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

                  {/* Maladaptive behaviors */}
                  {entry.maladaptive_behaviors && entry.maladaptive_behaviors.length > 0 && (
                    <div className="bg-red-50 rounded-lg p-3">
                      <p className="text-xs font-bold text-red-700 uppercase mb-1">Maladaptive Behaviors</p>
                      <p className="text-sm text-red-800">{entry.maladaptive_behaviors.join(", ")}</p>
                    </div>
                  )}

                  {/* Intervention techniques */}
                  {entry.intervention_techniques && entry.intervention_techniques.length > 0 && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs font-bold text-blue-700 uppercase mb-1">Intervention Techniques</p>
                      <p className="text-sm text-blue-800">{entry.intervention_techniques.join(", ")}</p>
                    </div>
                  )}
                </div>

                {/* Previous correction notes */}
                {entry.status === "needs_correction" && entry.reviewer_notes && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-red-600 uppercase mb-1">⚠️ Previous Correction Request</p>
                    <p className="text-sm text-red-800">{entry.reviewer_notes}</p>
                  </div>
                )}

                {/* REVIEW ACTIONS */}
                {entry.status === "pending" && (
                  <div className="space-y-3 border-t border-gray-100 pt-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Review Notes</label>
                      <textarea
                        value={reviewNotes[entry.id] ?? ""}
                        onChange={e => setReviewNotes(prev => ({ ...prev, [entry.id]: e.target.value }))}
                        placeholder="Add notes for the RBT (required for rejection, optional for approval)..."
                        rows={2}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={() => approveEntry(entry.id)} loading={saving === entry.id}>
                        ✓ Approve
                      </Button>
                      <Button variant="danger" onClick={() => rejectEntry(entry.id)} loading={saving === entry.id}>
                        ✗ Request Correction
                      </Button>
                    </div>
                  </div>
                )}

                {entry.status === "needs_correction" && (
                  <div className="space-y-3 border-t border-gray-100 pt-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Updated Review Notes</label>
                      <textarea
                        value={reviewNotes[entry.id] ?? ""}
                        onChange={e => setReviewNotes(prev => ({ ...prev, [entry.id]: e.target.value }))}
                        placeholder="Add updated notes..."
                        rows={2}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={() => approveEntry(entry.id)} loading={saving === entry.id}>✓ Approve Resubmission</Button>
                      <Button variant="danger" onClick={() => rejectEntry(entry.id)} loading={saving === entry.id}>✗ Reject Again</Button>
                    </div>
                  </div>
                )}

                {entry.status === "approved" && (
                  <div className="flex gap-3 border-t border-gray-100 pt-4">
                    <Button onClick={() => markBilled(entry.id)} loading={saving === entry.id}>
                      💰 Mark as Billed
                    </Button>
                    <Link href={`/dashboard/billing/approved`}>
                      <Button variant="outline">View in Billing →</Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}