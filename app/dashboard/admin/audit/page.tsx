"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";

type Session = {
  id: string;
  client_id: string;
  client_name?: string;
  date: string;
  status: string;
  staff_member: string | null;
  cpt_code: string | null;
  behaviors_observed: string | null;
  interventions_used: string | null;
  programs_targeted: string | null;
  notes: string | null;
  soap_subjective: string | null;
  soap_objective: string | null;
  soap_assessment: string | null;
  soap_plan: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  insurance_submitted: boolean;
  insurance_submitted_at: string | null;
  created_at: string;
};

export default function AuditPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: sessionData } = await supabase
      .from("sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    const clientIds = [...new Set((sessionData ?? []).map((s: Session) => s.client_id))];
    let clientNames: Record<string, string> = {};
    if (clientIds.length > 0) {
      const { data: clients } = await supabase.from("clients").select("id, full_name").in("id", clientIds);
      clientNames = Object.fromEntries((clients ?? []).map((c: any) => [c.id, c.full_name]));
    }

    setSessions((sessionData ?? []).map((s: Session) => ({ ...s, client_name: clientNames[s.client_id] })));
    setLoading(false);
  }

  async function exportCSV() {
    const headers = ["Date", "Client", "Staff", "CPT Code", "Status", "Behaviors", "Interventions", "Programs", "Notes", "Reviewed By", "Reviewed At", "Insurance Submitted", "Created At"];
    const rows = filtered.map(s => [
      s.date,
      s.client_name ?? "",
      s.staff_member ?? "",
      s.cpt_code ?? "",
      s.status,
      s.behaviors_observed ?? "",
      s.interventions_used ?? "",
      s.programs_targeted ?? "",
      s.notes ?? "",
      s.reviewed_by ?? "",
      s.reviewed_at ? new Date(s.reviewed_at).toLocaleDateString() : "",
      s.insurance_submitted ? "Yes" : "No",
      new Date(s.created_at).toLocaleDateString(),
    ]);

    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-audit-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = sessions.filter(s => {
    const matchSearch = !search || (s.client_name ?? "").toLowerCase().includes(search.toLowerCase()) || (s.staff_member ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || s.status === filterStatus;
    const matchDate = !filterDate || s.date === filterDate;
    return matchSearch && matchStatus && matchDate;
  });

  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-gray-100 text-gray-500",
    changes_requested: "bg-red-100 text-red-700",
  };

  if (loading) return <div className="p-8 text-gray-400">Loading audit log...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Session Note Audit Log">
        <button onClick={exportCSV}
          className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors">
          📥 Export CSV
        </button>
      </PageHeader>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
        🔒 This audit log shows all session notes across your clinic. All data is stored securely and can be exported for insurance audits or compliance reviews.
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Sessions", value: sessions.length, color: "text-blue-600" },
          { label: "Pending Review", value: sessions.filter(s => s.status === "pending").length, color: "text-yellow-600" },
          { label: "Completed", value: sessions.filter(s => s.status === "completed").length, color: "text-green-600" },
          { label: "Insurance Submitted", value: sessions.filter(s => s.insurance_submitted).length, color: "text-purple-600" },
        ].map(stat => (
          <div key={stat.label} className="border rounded-xl p-4 text-center bg-white">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* FILTERS */}
      <div className="flex gap-3 flex-wrap">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by client or staff..."
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 flex-1 min-w-[200px]" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="changes_requested">Changes Requested</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        {(search || filterStatus || filterDate) && (
          <button onClick={() => { setSearch(""); setFilterStatus(""); setFilterDate(""); }}
            className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700 border rounded-lg">
            Clear
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400">{filtered.length} of {sessions.length} sessions</p>

      {/* SESSION DETAIL */}
      {selectedSession && (
        <Section title={`Session Detail — ${selectedSession.client_name} — ${selectedSession.date}`}>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Status", value: selectedSession.status.replace("_", " ") },
                { label: "Staff", value: selectedSession.staff_member ?? "—" },
                { label: "CPT Code", value: selectedSession.cpt_code ?? "—" },
                { label: "Created", value: new Date(selectedSession.created_at).toLocaleString() },
                { label: "Reviewed At", value: selectedSession.reviewed_at ? new Date(selectedSession.reviewed_at).toLocaleString() : "—" },
                { label: "Insurance Submitted", value: selectedSession.insurance_submitted ? `Yes — ${selectedSession.insurance_submitted_at ? new Date(selectedSession.insurance_submitted_at).toLocaleDateString() : ""}` : "No" },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">{item.label}</p>
                  <p className="font-medium text-gray-800 capitalize">{item.value}</p>
                </div>
              ))}
            </div>
            {selectedSession.behaviors_observed && <div><p className="text-xs text-gray-400 mb-1">Behaviors</p><p className="bg-red-50 rounded-lg p-2 text-gray-700">{selectedSession.behaviors_observed}</p></div>}
            {selectedSession.interventions_used && <div><p className="text-xs text-gray-400 mb-1">Interventions</p><p className="bg-blue-50 rounded-lg p-2 text-gray-700">{selectedSession.interventions_used}</p></div>}
            {selectedSession.programs_targeted && <div><p className="text-xs text-gray-400 mb-1">Programs</p><p className="bg-purple-50 rounded-lg p-2 text-gray-700">{selectedSession.programs_targeted}</p></div>}
            {selectedSession.notes && <div><p className="text-xs text-gray-400 mb-1">Notes</p><p className="bg-gray-50 rounded-lg p-2 text-gray-700">{selectedSession.notes}</p></div>}
            {selectedSession.soap_subjective && (
              <div className="border border-blue-100 rounded-xl p-4 bg-blue-50 space-y-2">
                <p className="text-xs font-bold text-blue-700">SOAP Notes</p>
                {selectedSession.soap_subjective && <div><p className="text-xs text-blue-600">S</p><p className="text-sm text-gray-700">{selectedSession.soap_subjective}</p></div>}
                {selectedSession.soap_objective && <div><p className="text-xs text-blue-600">O</p><p className="text-sm text-gray-700">{selectedSession.soap_objective}</p></div>}
                {selectedSession.soap_assessment && <div><p className="text-xs text-blue-600">A</p><p className="text-sm text-gray-700">{selectedSession.soap_assessment}</p></div>}
                {selectedSession.soap_plan && <div><p className="text-xs text-blue-600">P</p><p className="text-sm text-gray-700">{selectedSession.soap_plan}</p></div>}
              </div>
            )}
            {selectedSession.review_notes && <div><p className="text-xs text-gray-400 mb-1">Review Notes</p><p className="bg-orange-50 rounded-lg p-2 text-gray-700">{selectedSession.review_notes}</p></div>}
            <button onClick={() => setSelectedSession(null)}
              className="text-sm text-blue-600 hover:underline">← Back to list</button>
          </div>
        </Section>
      )}

      {/* SESSION LIST */}
      {!selectedSession && (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-sm">No sessions found.</p>
            </div>
          )}
          {filtered.map(session => (
            <div key={session.id}
              onClick={() => setSelectedSession(session)}
              className="border border-gray-100 rounded-xl p-4 bg-white hover:border-blue-200 cursor-pointer transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-medium text-gray-800">{session.client_name ?? "Unknown"}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[session.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {session.status.replace("_", " ")}
                    </span>
                    {session.insurance_submitted && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">🏦 Submitted</span>}
                    {session.reviewed_at && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">✓ Reviewed</span>}
                  </div>
                  <p className="text-xs text-gray-400">
                    {session.date} · {session.staff_member ?? "No staff"} {session.cpt_code ? `· CPT: ${session.cpt_code}` : ""}
                  </p>
                  {session.behaviors_observed && (
                    <p className="text-xs text-gray-500 mt-1 truncate max-w-lg">Behaviors: {session.behaviors_observed}</p>
                  )}
                </div>
                <span className="text-gray-300">→</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}