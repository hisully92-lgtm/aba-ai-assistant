"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Link from "next/link";

type HourEntry = {
  id: string; student_id: string; supervisor_id: string | null;
  hour_type: string; activity_type: string; hours: number;
  session_date: string; notes: string | null; status: string;
  student_signed: boolean; supervisor_signed: boolean;
  submitted_at: string | null; approved_at: string | null;
  billed_at: string | null; reviewer_notes: string | null;
  billing_code: string | null;
  clients?: { full_name: string };
  profiles?: { full_name: string };
};

type MVF = {
  id: string; month: number; year: number;
  total_hours: number; supervised_hours: number;
  independent_hours: number; experience_type: string | null;
  tasks_completed: string[] | null;
  student_signature: string | null; supervisor_signature: string | null;
  status: string; notes: string | null;
  student_user_id: string;
  student_profile?: { full_name: string };
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

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

export default function SupervisorHoursPage() {
  const [entries, setEntries] = useState<HourEntry[]>([]);
  const [mvfs, setMvfs] = useState<MVF[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"hours" | "mvf" | "billed">("hours");
  const [filterStatus, setFilterStatus] = useState("pending");

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const { data: cu } = await supabase.from("company_users").select("company_id")
      .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
    setCompanyId(cu?.company_id ?? "");

    const [{ data: hourData }, { data: mvfData }] = await Promise.all([
      supabase.from("student_analyst_hours")
        .select("*, clients(full_name)")
        .eq("supervisor_id", user.id)
        .in("status", ["pending", "approved", "needs_correction", "billed"])
        .order("submitted_at", { ascending: false }),
      supabase.from("student_mvf")
        .select("*")
        .eq("supervisor_user_id", user.id)
        .order("year", { ascending: false })
        .order("month", { ascending: false }),
    ]);

    setEntries(hourData ?? []);
    setMvfs(mvfData ?? []);
    setLoading(false);
  }

  async function approveEntry(id: string) {
    setSaving(id);
    await supabase.from("student_analyst_hours").update({
      status: "approved",
      approved: true,
      supervisor_signed: true,
      supervisor_signed_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
      reviewer_notes: reviewNotes[id] || null,
    }).eq("id", id);
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: "approved", approved_at: new Date().toISOString() } : e));
    setSaving(null);
  }

  async function rejectEntry(id: string) {
    if (!reviewNotes[id]?.trim()) { alert("Please add correction notes before rejecting."); return; }
    setSaving(id);
    await supabase.from("student_analyst_hours").update({
      status: "needs_correction",
      reviewer_notes: reviewNotes[id],
    }).eq("id", id);
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: "needs_correction", reviewer_notes: reviewNotes[id] } : e));
    setSaving(null);
  }

  async function markBilled(ids: string[]) {
    setSaving("billing");
    await Promise.all(ids.map(id =>
      supabase.from("student_analyst_hours").update({
        status: "billed", billed_at: new Date().toISOString(),
      }).eq("id", id)
    ));
    await init();
    setSaving(null);
  }

  async function approveMVF(id: string) {
    const sig = prompt("Enter your full name as electronic signature to approve this MVF:");
    if (!sig) return;
    setSaving(id);
    await supabase.from("student_mvf").update({
      supervisor_signature: sig,
      supervisor_signed_at: new Date().toISOString(),
      status: "approved",
    }).eq("id", id);
    setMvfs(prev => prev.map(m => m.id === id ? { ...m, status: "approved", supervisor_signature: sig } : m));
    setSaving(null);
  }

  async function rejectMVF(id: string) {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;
    setSaving(id);
    await supabase.from("student_mvf").update({
      status: "rejected",
      notes: reason,
    }).eq("id", id);
    setMvfs(prev => prev.map(m => m.id === id ? { ...m, status: "rejected" } : m));
    setSaving(null);
  }

  const fmt = (h: number) => `${h}h`;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

  const pendingEntries = entries.filter(e => e.status === "pending");
  const approvedEntries = entries.filter(e => e.status === "approved");
  const billedEntries = entries.filter(e => e.status === "billed");
  const correctionEntries = entries.filter(e => e.status === "needs_correction");
  const pendingMVFs = mvfs.filter(m => m.status === "student_signed");

  const filteredEntries = filterStatus === "all" ? entries : entries.filter(e => e.status === filterStatus);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  return (
    <div className="space-y-6">
      <PageHeader title="Supervisor Hours Review">
        <Link href="/dashboard/student-hub">
          <Button variant="outline">‹ Student Hub</Button>
        </Link>
      </PageHeader>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Pending Review", val: pendingEntries.length, color: "bg-yellow-50 border-yellow-100 text-yellow-700", key: "pending" },
          { label: "Needs Correction", val: correctionEntries.length, color: "bg-red-50 border-red-100 text-red-700", key: "needs_correction" },
          { label: "Approved", val: approvedEntries.length, color: "bg-green-50 border-green-100 text-green-700", key: "approved" },
          { label: "Billed", val: billedEntries.length, color: "bg-blue-50 border-blue-100 text-blue-700", key: "billed" },
        ].map(s => (
          <button key={s.key} onClick={() => setFilterStatus(s.key)}
            className={`border rounded-xl p-4 text-left transition-all ${s.color} ${filterStatus === s.key ? "ring-2 ring-offset-1 ring-blue-400" : ""}`}>
            <p className="text-xs font-semibold uppercase">{s.label}</p>
            <p className="text-3xl font-bold mt-1">{s.val}</p>
          </button>
        ))}
      </div>

      {/* PENDING MVF ALERT */}
      {pendingMVFs.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-blue-800">
            📋 {pendingMVFs.length} MVF{pendingMVFs.length > 1 ? "s" : ""} awaiting your signature
          </p>
          <button onClick={() => setActiveTab("mvf")} className="text-xs text-blue-600 hover:underline font-semibold">
            Review MVFs →
          </button>
        </div>
      )}

      {/* TABS */}
      <div className="flex border-b border-gray-200">
        {[
          { key: "hours", label: `Hour Entries (${entries.length})` },
          { key: "mvf", label: `MVFs (${mvfs.length})` },
          { key: "billed", label: `Billing (${approvedEntries.length} ready)` },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* HOURS TAB */}
      {activeTab === "hours" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {["all", "pending", "needs_correction", "approved", "billed"].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-all ${filterStatus === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-300"}`}>
                {s === "all" ? "All" : STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          {loading && <p className="text-gray-400 text-sm">Loading...</p>}
          {!loading && filteredEntries.length === 0 && (
            <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
              <p className="text-4xl mb-3">✅</p>
              <p className="font-semibold text-gray-700">No entries in this category</p>
              <p className="text-sm text-gray-400 mt-1">All caught up!</p>
            </div>
          )}

          <div className="space-y-3">
            {filteredEntries.map(entry => (
              <div key={entry.id} className={`border rounded-2xl bg-white overflow-hidden ${entry.status === "pending" ? "border-yellow-200" : entry.status === "needs_correction" ? "border-red-200" : entry.status === "approved" ? "border-green-200" : "border-gray-100"}`}>
                <button type="button" className="w-full text-left p-5"
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-bold text-gray-900">{entry.profiles?.full_name ?? "Student"}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[entry.status]}`}>
                          {STATUS_LABELS[entry.status]}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${entry.hour_type === "unrestricted" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                          {entry.hour_type}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{entry.activity_type}</p>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                        <span>📅 {entry.session_date}</span>
                        <span>⏱️ {fmt(entry.hours)}</span>
                        {entry.clients && <span>👤 {entry.clients.full_name}</span>}
                        {entry.submitted_at && <span>Submitted {fmtDate(entry.submitted_at)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-blue-600">{fmt(entry.hours)}</span>
                      <span className="text-gray-400 text-sm">{expandedId === entry.id ? "▼" : "▶"}</span>
                    </div>
                  </div>
                </button>

                {expandedId === entry.id && (
                  <div className="border-t border-gray-100 p-5 space-y-4">
                    {entry.notes && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs font-bold text-gray-400 uppercase mb-1">Student Notes</p>
                        <p className="text-sm text-gray-700">{entry.notes}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-400 mb-1">Student Signed</p>
                        <p className={`font-semibold ${entry.student_signed ? "text-green-600" : "text-red-500"}`}>
                          {entry.student_signed ? "✓ Yes" : "✗ No"}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-400 mb-1">Hours</p>
                        <p className="font-semibold text-gray-800">{fmt(entry.hours)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-400 mb-1">Type</p>
                        <p className="font-semibold text-gray-800 capitalize">{entry.hour_type}</p>
                      </div>
                    </div>

                    {entry.status === "pending" && (
                      <div className="space-y-3 border-t border-gray-100 pt-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block">Review Notes</label>
                          <textarea value={reviewNotes[entry.id] ?? ""}
                            onChange={e => setReviewNotes(prev => ({ ...prev, [entry.id]: e.target.value }))}
                            placeholder="Add notes for the student (required for rejection)..."
                            rows={2}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                        </div>
                        <div className="flex gap-3">
                          <Button onClick={() => approveEntry(entry.id)} loading={saving === entry.id}>
                            ✓ Approve Hours
                          </Button>
                          <Button variant="danger" onClick={() => rejectEntry(entry.id)} loading={saving === entry.id}>
                            ✗ Request Correction
                          </Button>
                        </div>
                      </div>
                    )}

                    {entry.reviewer_notes && (
                      <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                        <p className="text-xs font-bold text-red-600 uppercase mb-1">Correction Notes</p>
                        <p className="text-sm text-red-700">{entry.reviewer_notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MVF TAB */}
      {activeTab === "mvf" && (
        <div className="space-y-4">
          {loading && <p className="text-gray-400 text-sm">Loading...</p>}
          {!loading && mvfs.length === 0 && (
            <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-semibold text-gray-700">No MVFs to review</p>
            </div>
          )}
          {mvfs.map(mvf => (
            <div key={mvf.id} className="border border-gray-100 rounded-2xl p-5 bg-white">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-bold text-gray-900">{MONTHS[mvf.month - 1]} {mvf.year}</p>
                  <p className="text-xs text-gray-400">{mvf.experience_type} experience</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${mvf.status === "approved" ? "bg-green-100 text-green-700" : mvf.status === "student_signed" ? "bg-blue-100 text-blue-700" : mvf.status === "rejected" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                  {mvf.status.replace("_", " ")}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: "Total Hours", value: `${mvf.total_hours}h` },
                  { label: "Supervised", value: `${mvf.supervised_hours}h` },
                  { label: "Independent", value: `${mvf.independent_hours}h` },
                ].map(stat => (
                  <div key={stat.label} className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-sm font-bold text-gray-800">{stat.value}</p>
                    <p className="text-xs text-gray-400">{stat.label}</p>
                  </div>
                ))}
              </div>

              {mvf.tasks_completed && mvf.tasks_completed.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {mvf.tasks_completed.map(task => (
                    <span key={task} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{task}</span>
                  ))}
                </div>
              )}

              <div className="flex gap-4 text-xs border-t pt-3 mb-4">
                <span className={mvf.student_signature ? "text-green-600" : "text-gray-400"}>
                  {mvf.student_signature ? "✓ Student signed" : "⏳ Awaiting student signature"}
                </span>
                <span className={mvf.supervisor_signature ? "text-blue-600" : "text-gray-400"}>
                  {mvf.supervisor_signature ? "✓ You signed" : "⏳ Awaiting your signature"}
                </span>
              </div>

              {mvf.status === "student_signed" && !mvf.supervisor_signature && (
                <div className="flex gap-3 border-t border-gray-100 pt-4">
                  <Button onClick={() => approveMVF(mvf.id)} loading={saving === mvf.id}>
                    ✓ Sign & Approve MVF
                  </Button>
                  <Button variant="danger" onClick={() => rejectMVF(mvf.id)} loading={saving === mvf.id}>
                    ✗ Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* BILLING TAB */}
      {activeTab === "billed" && (
        <div className="space-y-4">
          {approvedEntries.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-green-800">
                  {approvedEntries.length} approved entr{approvedEntries.length > 1 ? "ies" : "y"} ready to bill
                </p>
                <p className="text-xs text-green-600 mt-0.5">
                  Total: {approvedEntries.reduce((sum, e) => sum + e.hours, 0).toFixed(1)}h
                </p>
              </div>
              <Button onClick={() => markBilled(approvedEntries.map(e => e.id))} loading={saving === "billing"}>
                💰 Mark All as Billed
              </Button>
            </div>
          )}

          <div className="space-y-3">
            {[...approvedEntries, ...billedEntries].map(entry => (
              <div key={entry.id} className={`border rounded-xl bg-white p-4 flex items-center gap-4 ${entry.status === "approved" ? "border-green-200" : "border-gray-100"}`}>
                {entry.status === "approved" && (
                  <input type="checkbox"
                    checked={selectedIds.includes(entry.id)}
                    onChange={e => setSelectedIds(prev => e.target.checked ? [...prev, entry.id] : prev.filter(id => id !== entry.id))}
                    className="w-4 h-4 rounded border-gray-300" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-800">{entry.profiles?.full_name ?? "Student"}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[entry.status]}`}>
                      {STATUS_LABELS[entry.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    <span>📅 {entry.session_date}</span>
                    <span>⏱️ {fmt(entry.hours)}</span>
                    <span className="capitalize">{entry.hour_type}</span>
                    <span>{entry.activity_type}</span>
                    {entry.billed_at && <span>Billed {fmtDate(entry.billed_at)}</span>}
                  </div>
                </div>
                <span className="text-lg font-bold text-blue-600">{fmt(entry.hours)}</span>
                {entry.status === "approved" && (
                  <Button onClick={() => markBilled([entry.id])} loading={saving === entry.id}>
                    Bill
                  </Button>
                )}
              </div>
            ))}
            {approvedEntries.length === 0 && billedEntries.length === 0 && (
              <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
                <p className="text-4xl mb-3">💰</p>
                <p className="font-semibold text-gray-700">No entries ready to bill</p>
                <p className="text-sm text-gray-400 mt-1">Approve hour entries first</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

