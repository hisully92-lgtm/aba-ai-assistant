"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type PayrollEntry = {
  id: string;
  client_id: string | null;
  start_time: string;
  end_time: string;
  staff_member: string | null;
  status: string;
  behaviors_observed: string | null;
  programs_targeted: string | null;
  notes: string | null;
  created_at: string;
};

type Client = { id: string; full_name: string };

export default function PayrollPage() {
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStaff, setFilterStaff] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: sessionData }, { data: clientData }] = await Promise.all([
      supabase
        .from("sessions")
        .select("id, client_id, start_time, end_time, staff_member, status, behaviors_observed, programs_targeted, notes, created_at")
        .not("end_time", "is", null)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("clients").select("id, full_name"),
    ]);

    setEntries(sessionData ?? []);
    setClients(clientData ?? []);
    setLoading(false);
  }

  function getDuration(start: string, end: string) {
    const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
    return { mins, hrs: (mins / 60).toFixed(2) };
  }

  function exportCSV() {
    const rows = [
      ["Staff", "Client", "Date", "Start", "End", "Duration (hrs)", "Status", "Behaviors", "Programs"],
      ...filtered.map((e) => {
        const dur = getDuration(e.start_time, e.end_time);
        return [
          e.staff_member ?? "",
          clientMap.get(e.client_id ?? "") ?? "",
          new Date(e.start_time).toLocaleDateString(),
          new Date(e.start_time).toLocaleTimeString(),
          new Date(e.end_time).toLocaleTimeString(),
          dur.hrs,
          e.status,
          e.behaviors_observed ?? "",
          e.programs_targeted ?? "",
        ];
      }),
    ];

    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));
  const staffList = [...new Set(entries.map((e) => e.staff_member).filter(Boolean))];

  let filtered = entries;
  if (filterStaff) filtered = filtered.filter((e) => e.staff_member === filterStaff);
  if (filterClient) filtered = filtered.filter((e) => e.client_id === filterClient);
  if (dateFrom) filtered = filtered.filter((e) => new Date(e.start_time) >= new Date(dateFrom));
  if (dateTo) filtered = filtered.filter((e) => new Date(e.start_time) <= new Date(dateTo + "T23:59:59"));

  const totalMins = filtered.reduce((sum, e) => sum + getDuration(e.start_time, e.end_time).mins, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Payroll Logs">
        <Button variant="outline" onClick={exportCSV}>Export CSV</Button>
      </PageHeader>

      {/* SUMMARY */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{filtered.length}</p>
          <p className="text-xs text-gray-500 mt-1">Sessions</p>
        </div>
        <div className="border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{(totalMins / 60).toFixed(1)}h</p>
          <p className="text-xs text-gray-500 mt-1">Total Hours</p>
        </div>
        <div className="border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-gray-700">
            {filtered.length ? (totalMins / filtered.length).toFixed(0) : 0} min
          </p>
          <p className="text-xs text-gray-500 mt-1">Avg Session</p>
        </div>
        <div className="border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{staffList.length}</p>
          <p className="text-xs text-gray-500 mt-1">Staff Members</p>
        </div>
      </div>

      {/* FILTERS */}
      <Section title="Filters">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Staff</label>
            <select
              value={filterStaff}
              onChange={(e) => setFilterStaff(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">All Staff</option>
              {staffList.map((s) => <option key={s} value={s ?? ""}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Client</label>
            <select
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">All Clients</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>
        {(filterStaff || filterClient || dateFrom || dateTo) && (
          <button
            onClick={() => { setFilterStaff(""); setFilterClient(""); setDateFrom(""); setDateTo(""); }}
            className="text-sm text-gray-400 hover:text-gray-600 underline mt-2"
          >
            Clear filters
          </button>
        )}
      </Section>

      {/* SESSION LIST */}
      <Section title={`Sessions (${filtered.length})`}>
        {loading && <p className="text-gray-400 text-sm">Loading...</p>}
        {!loading && filtered.length === 0 && (
          <p className="text-gray-400 text-sm">No sessions match your filters.</p>
        )}
        <div className="space-y-2">
          {filtered.map((entry) => {
            const dur = getDuration(entry.start_time, entry.end_time);
            const isExpanded = expandedId === entry.id;
            return (
              <div
                key={entry.id}
                className="border border-gray-100 rounded-lg bg-white overflow-hidden"
              >
                <div
                  className="p-3 flex justify-between items-center cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {entry.staff_member ?? "Unknown"} → {clientMap.get(entry.client_id ?? "") ?? "Unknown client"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(entry.start_time).toLocaleDateString()} · {new Date(entry.start_time).toLocaleTimeString()} – {new Date(entry.end_time).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                      {dur.hrs}h
                    </span>
                    <span className="text-gray-400 text-xs">{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-3 py-3 bg-gray-50 text-sm text-gray-600 space-y-1">
                    <p><span className="font-medium">Duration:</span> {dur.mins} minutes ({dur.hrs} hours)</p>
                    <p><span className="font-medium">Status:</span> {entry.status}</p>
                    {entry.behaviors_observed && (
                      <p><span className="font-medium">Behaviors:</span> {entry.behaviors_observed}</p>
                    )}
                    {entry.programs_targeted && (
                      <p><span className="font-medium">Programs:</span> {entry.programs_targeted}</p>
                    )}
                    {entry.notes && (
                      <p><span className="font-medium">Notes:</span> {entry.notes}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}