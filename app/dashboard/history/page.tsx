"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };

type HistoryItem = {
  id: string;
  type: "session" | "behavior" | "program";
  title: string;
  client_id: string | null;
  staff_member: string | null;
  date: string;
  status?: string;
  notes?: string;
  created_at: string;
};

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterStaff, setFilterStaff] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [
      { data: clientData },
      { data: sessionData },
      { data: behaviorData },
      { data: programData },
    ] = await Promise.all([
      supabase.from("clients").select("id, full_name"),
      supabase.from("sessions")
        .select("id, client_id, date, status, notes, staff_member, behaviors_observed, programs_targeted, created_at")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("behaviors")
        .select("id, client_id, behavior_name, staff_member, intensity, created_at")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("programs")
        .select("id, client_id, program_name, staff_member, prompt_level, created_at")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    setClients(clientData ?? []);

    const sessions: HistoryItem[] = (sessionData ?? []).map((s: any) => ({
      id: s.id,
      type: "session",
      title: `Session Note${s.behaviors_observed ? ` — ${s.behaviors_observed.split(", ")[0]}` : ""}`,
      client_id: s.client_id,
      staff_member: s.staff_member,
      date: s.date ?? new Date(s.created_at).toISOString().split("T")[0],
      status: s.status,
      notes: s.notes,
      created_at: s.created_at,
    }));

    const behaviors: HistoryItem[] = (behaviorData ?? []).map((b: any) => ({
      id: b.id,
      type: "behavior",
      title: b.behavior_name,
      client_id: b.client_id,
      staff_member: b.staff_member,
      date: new Date(b.created_at).toISOString().split("T")[0],
      notes: b.intensity ? `Intensity: ${b.intensity}` : undefined,
      created_at: b.created_at,
    }));

    const programs: HistoryItem[] = (programData ?? []).map((p: any) => ({
      id: p.id,
      type: "program",
      title: p.program_name,
      client_id: p.client_id,
      staff_member: p.staff_member,
      date: new Date(p.created_at).toISOString().split("T")[0],
      notes: p.prompt_level ? `Prompt: ${p.prompt_level}` : undefined,
      created_at: p.created_at,
    }));

    const all = [...sessions, ...behaviors, ...programs]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setHistory(all);
    setLoading(false);
  }

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));
  const staffList = [...new Set(history.map((h) => h.staff_member).filter(Boolean))];

  let filtered = history;
  if (filterType) filtered = filtered.filter((h) => h.type === filterType);
  if (filterClient) filtered = filtered.filter((h) => h.client_id === filterClient);
  if (filterDate) filtered = filtered.filter((h) => h.date === filterDate);
  if (filterStaff) filtered = filtered.filter((h) => h.staff_member === filterStaff);
  if (search.trim()) {
    filtered = filtered.filter((h) =>
      h.title.toLowerCase().includes(search.toLowerCase()) ||
      (h.notes ?? "").toLowerCase().includes(search.toLowerCase())
    );
  }

  const filtersActive = filterType || filterClient || filterDate || filterStaff || search;

  function typeColor(type: string) {
    if (type === "session") return "bg-blue-100 text-blue-700";
    if (type === "behavior") return "bg-red-100 text-red-700";
    if (type === "program") return "bg-purple-100 text-purple-700";
    return "bg-gray-100 text-gray-600";
  }

  function typeIcon(type: string) {
    if (type === "session") return "📋";
    if (type === "behavior") return "🧠";
    if (type === "program") return "🎯";
    return "📁";
  }

  function statusColor(status?: string) {
    if (status === "completed") return "bg-green-100 text-green-700";
    if (status === "pending") return "bg-yellow-100 text-yellow-700";
    if (status === "cancelled") return "bg-red-100 text-red-700";
    return "";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="History">
        <p className="text-gray-500 text-sm">All clinical records across sessions, behaviors, and programs.</p>
      </PageHeader>

      {/* FILTERS */}
      <Section title="Filters">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">All Types</option>
              <option value="session">Sessions</option>
              <option value="behavior">Behaviors</option>
              <option value="program">Programs</option>
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
            <label className="text-xs text-gray-500 mb-1 block">Date</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Staff Member</label>
            <select
              value={filterStaff}
              onChange={(e) => setFilterStaff(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">All Staff</option>
              {staffList.map((s) => <option key={s} value={s ?? ""}>{s}</option>)}
            </select>
          </div>
        </div>
        {filtersActive && (
          <button
            onClick={() => { setFilterType(""); setFilterClient(""); setFilterDate(""); setFilterStaff(""); setSearch(""); }}
            className="text-sm text-gray-400 hover:text-gray-600 underline mt-2"
          >
            Clear all filters
          </button>
        )}
      </Section>

      {/* RESULTS */}
      <Section title={`${filtered.length} record${filtered.length !== 1 ? "s" : ""}`}>
        {loading && <p className="text-gray-400 text-sm">Loading...</p>}
        {!loading && filtered.length === 0 && (
          <p className="text-gray-400 text-sm">No records found.</p>
        )}
        <div className="space-y-2">
          {filtered.map((item) => (
            <div
              key={item.type + item.id}
              className="border border-gray-100 rounded-xl p-4 bg-white hover:shadow-sm transition-shadow cursor-pointer"
              onClick={() => {
                if (item.client_id) window.location.href = `/dashboard/clients/${item.client_id}/case`;
              }}
            >
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div className="flex items-start gap-3">
                  <span className="text-lg">{typeIcon(item.type)}</span>
                  <div>
                    <p className="font-medium text-gray-800">{item.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {clientMap.get(item.client_id ?? "") ?? "Unknown client"}
                      {item.staff_member && ` · ${item.staff_member}`}
                      {` · ${item.date}`}
                    </p>
                    {item.notes && (
                      <p className="text-xs text-gray-500 mt-1">{item.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${typeColor(item.type)}`}>
                    {item.type}
                  </span>
                  {item.status && (
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor(item.status)}`}>
                      {item.status}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length > 0 && (
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => window.location.href = "/dashboard/history/exports"}
            >
              Export History →
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.href = "/dashboard/history/ai"}
            >
              AI Request History →
            </Button>
          </div>
        )}
      </Section>
    </div>
  );
}