"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";

type Session = {
  id: string;
  client_id: string;
  client_name?: string;
  date: string;
  status: string;
  behaviors_observed: string | null;
  interventions_used: string | null;
  programs_targeted: string | null;
  client_response: string | null;
  notes: string | null;
  staff_member: string | null;
  cpt_code: string | null;
  soap_subjective: string | null;
  soap_objective: string | null;
  soap_assessment: string | null;
  soap_plan: string | null;
  start_time: string | null;
  end_time: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  insurance_submitted: boolean;
  insurance_submitted_at: string | null;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
  changes_requested: "bg-red-100 text-red-700",
};

export default function SessionReviewPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [filterStatus, setFilterStatus] = useState("pending");
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [saving, setSaving] = useState("");

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    setUserName(profile?.full_name ?? "");

    const { data: sessionData } = await supabase
      .from("sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    // Get client names
    const clientIds = [...new Set((sessionData ?? []).map((s: Session) => s.client_id))];
    let clientNames: Record<string, string> = {};
    if (clientIds.length > 0) {
      const { data: clients } = await supabase.from("clients").select("id, full_name").in("id", clientIds);
      clientNames = Object.fromEntries((clients ?? []).map((c: any) => [c.id, c.full_name]));
    }

    setSessions((sessionData ?? []).map((s: Session) => ({ ...s, client_name: clientNames[s.client_id] })));
    setLoading(false);
  }

  async function approveSession(id: string) {
    setSaving(id);
    await supabase.from("sessions").update({
      status: "completed",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes.trim() || null,
    }).eq("id", id);
    setSessions(prev => prev.map(s => s.id === id ? { ...s, status: "completed", reviewed_by: userId, reviewed_at: new Date().toISOString() } : s));
    setSelectedSession(null);
    setReviewNotes("");
    setSaving("");
  }

  async function requestChanges(id: string) {
    if (!reviewNotes.trim()) { alert("Please add notes explaining what changes are needed."); return; }
    setSaving(id);
    await supabase.from("sessions").update({
      status: "changes_requested",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes.trim(),
    }).eq("id", id);
    setSessions(prev => prev.map(s => s.id === id ? { ...s, status: "changes_requested" } : s));
    setSelectedSession(null);
    setReviewNotes("");
    setSaving("");
  }

  async function submitToInsurance(id: string) {
    setSaving(id + "_insurance");
    await supabase.from("sessions").update({
      insurance_submitted: true,
      insurance_submitted_at: new Date().toISOString(),
    }).eq("id", id);
    setSessions(prev => prev.map(s => s.id === id ? { ...s, insurance_submitted: true, insurance_submitted_at: new Date().toISOString() } : s));
    setSaving("");
    alert("Session marked as submitted to insurance. Make sure to also submit through your clearinghouse (Availity).");
  }

  const filtered = sessions.filter(s => filterStatus ? s.status === filterStatus : true);
  const pendingCount = sessions.filter(s => s.status === "pending").length;
  const changesCount = sessions.filter(s => s.status === "changes_requested").length;

  if (loading) return <div className="p-8 text-gray-400">Loading sessions...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Session Note Review">
        <p className="text-sm text-gray-500">Review, approve, and submit session notes to insurance</p>
      </PageHeader>

      {/* STATS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Pending Review", value: pendingCount, color: "text-yellow-600", icon: "⏳" },
          { label: "Changes Requested", value: changesCount, color: "text-red-500", icon: "✏️" },
          { label: "Completed", value: sessions.filter(s => s.status === "completed").length, color: "text-green-600", icon: "✅" },
          { label: "Submitted to Insurance", value: sessions.filter(s => s.insurance_submitted).length, color: "text-blue-600", icon: "🏦" },
        ].map(stat => (
          <div key={stat.label} className="border rounded-xl p-4 text-center bg-white">
            <div className="text-xl mb-1">{stat.icon}</div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {pendingCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
          ⏳ <strong>{pendingCount}</strong> session note{pendingCount > 1 ? "s" : ""} waiting for your review.
        </div>
      )}

      {/* FILTER */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: "pending", label: `Pending (${pendingCount})` },
          { value: "completed", label: "Completed" },
          { value: "changes_requested", label: `Changes Requested (${changesCount})` },
          { value: "", label: "All" },
        ].map(f => (
          <button key={f.value} onClick={() => setFilterStatus(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterStatus === f.value ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* SESSION DETAIL VIEW */}
      {selectedSession && (
        <Section title={`Reviewing: ${selectedSession.client_name ?? "Unknown Client"} — ${selectedSession.date}`}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {selectedSession.staff_member && (
                <div><p className="text-xs text-gray-400">Staff</p><p className="font-medium">{selectedSession.staff_member}</p></div>
              )}
              {selectedSession.cpt_code && (
                <div><p className="text-xs text-gray-400">CPT Code</p><p className="font-medium">{selectedSession.cpt_code}</p></div>
              )}
              {selectedSession.client_response && (
                <div><p className="text-xs text-gray-400">Client Response</p><p className="font-medium">{selectedSession.client_response}</p></div>
              )}
              {selectedSession.start_time && (
                <div>
                  <p className="text-xs text-gray-400">Session Time</p>
                  <p className="font-medium">
                    {new Date(selectedSession.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {selectedSession.end_time && ` → ${new Date(selectedSession.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                  </p>
                </div>
              )}
            </div>

            {selectedSession.behaviors_observed && (
              <div><p className="text-xs text-gray-400 mb-1">Behaviors Observed</p>
              <p className="text-sm text-gray-700 bg-red-50 rounded-lg p-2">{selectedSession.behaviors_observed}</p></div>
            )}
            {selectedSession.interventions_used && (
              <div><p className="text-xs text-gray-400 mb-1">Interventions Used</p>
              <p className="text-sm text-gray-700 bg-blue-50 rounded-lg p-2">{selectedSession.interventions_used}</p></div>
            )}
            {selectedSession.programs_targeted && (
              <div><p className="text-xs text-gray-400 mb-1">Programs Targeted</p>
              <p className="text-sm text-gray-700 bg-purple-50 rounded-lg p-2">{selectedSession.programs_targeted}</p></div>
            )}
            {selectedSession.notes && (
              <div><p className="text-xs text-gray-400 mb-1">Notes</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-2">{selectedSession.notes}</p></div>
            )}

            {(selectedSession.soap_subjective || selectedSession.soap_objective) && (
              <div className="border border-blue-100 rounded-xl p-4 bg-blue-50 space-y-2">
                <p className="text-xs font-bold text-blue-700 uppercase">SOAP Notes</p>
                {selectedSession.soap_subjective && <div><p className="text-xs text-blue-600 font-medium">S — Subjective</p><p className="text-sm text-gray-700">{selectedSession.soap_subjective}</p></div>}
                {selectedSession.soap_objective && <div><p className="text-xs text-blue-600 font-medium">O — Objective</p><p className="text-sm text-gray-700">{selectedSession.soap_objective}</p></div>}
                {selectedSession.soap_assessment && <div><p className="text-xs text-blue-600 font-medium">A — Assessment</p><p className="text-sm text-gray-700">{selectedSession.soap_assessment}</p></div>}
                {selectedSession.soap_plan && <div><p className="text-xs text-blue-600 font-medium">P — Plan</p><p className="text-sm text-gray-700">{selectedSession.soap_plan}</p></div>}
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Review Notes</label>
              <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)}
                placeholder="Add approval notes or explain what changes are needed..."
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => approveSession(selectedSession.id)} loading={saving === selectedSession.id}>
                ✅ Approve Note
              </Button>
              <button onClick={() => requestChanges(selectedSession.id)}
                className="px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">
                ✏️ Request Changes
              </button>
              {selectedSession.status === "completed" && !selectedSession.insurance_submitted && (
                <button onClick={() => submitToInsurance(selectedSession.id)}
                  disabled={saving === selectedSession.id + "_insurance"}
                  className="px-4 py-2 border border-blue-200 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-50 transition-colors disabled:opacity-50">
                  🏦 Submit to Insurance
                </button>
              )}
              {selectedSession.insurance_submitted && (
                <span className="px-4 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-medium border border-green-200">
                  ✓ Submitted to Insurance {selectedSession.insurance_submitted_at ? new Date(selectedSession.insurance_submitted_at).toLocaleDateString() : ""}
                </span>
              )}
              <button onClick={() => { setSelectedSession(null); setReviewNotes(""); }}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                ← Back
              </button>
            </div>
          </div>
        </Section>
      )}

      {/* SESSION LIST */}
      {!selectedSession && (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-sm">No sessions in this category.</p>
            </div>
          )}
          {filtered.map(session => (
            <div key={session.id}
              onClick={() => setSelectedSession(session)}
              className="border border-gray-100 rounded-xl p-4 bg-white hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-800">{session.client_name ?? "Unknown Client"}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[session.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {session.status.replace("_", " ")}
                    </span>
                    {session.insurance_submitted && (
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">🏦 Insurance</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{session.date} {session.staff_member ? `· ${session.staff_member}` : ""}</p>
                  {session.cpt_code && <p className="text-xs text-blue-600 mt-0.5">CPT: {session.cpt_code}</p>}
                  {session.behaviors_observed && (
                    <p className="text-xs text-gray-500 mt-1 truncate max-w-md">Behaviors: {session.behaviors_observed}</p>
                  )}
                  {session.review_notes && (
                    <p className="text-xs text-orange-600 mt-1">📝 {session.review_notes}</p>
                  )}
                </div>
                <span className="text-gray-300 text-sm">→</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}