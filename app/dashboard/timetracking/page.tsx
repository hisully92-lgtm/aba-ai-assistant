"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type TimeEntry = {
  id: string;
  client_id: string | null;
  clock_in: string;
  clock_out: string | null;
  duration_minutes: number | null;
  session_type: string;
  notes: string | null;
  created_at: string;
};

const SESSION_TYPES = [
  "Direct Therapy",
  "Supervision",
  "Parent Training",
  "Assessment",
  "Documentation",
  "Team Meeting",
  "Telehealth",
  "Other",
];

export default function TimeTrackingPage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [clockedIn, setClockedIn] = useState<TimeEntry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split("T")[0]);
  const [clientId, setClientId] = useState("");
  const [sessionType, setSessionType] = useState("Direct Therapy");
  const [notes, setNotes] = useState("");

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: entryData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
      supabase.from("time_entries").select("*").eq("created_by", user.id)
        .order("clock_in", { ascending: false }).limit(100),
    ]);

    setClients(clientData ?? []);
    const allEntries = entryData ?? [];
    setEntries(allEntries);

    const active = allEntries.find((e: TimeEntry) => !e.clock_out);
    if (active) {
      setClockedIn(active);
      setElapsed(Math.floor((Date.now() - new Date(active.clock_in).getTime()) / 1000));
    }

    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void init(); }, []);

  useEffect(() => {
    if (!clockedIn) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(clockedIn.clock_in).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [clockedIn]);

  async function handleClockIn() {
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("time_entries").insert([{
      client_id: clientId || null,
      clock_in: new Date().toISOString(),
      session_type: sessionType,
      notes: notes || null,
      created_by: user.id,
    }]).select().single();

    if (data) {
      setClockedIn(data);
      setElapsed(0);
      setEntries(prev => [data, ...prev]);
    }
    setSaving(false);
  }

  async function handleClockOut() {
    if (!clockedIn) return;
    setSaving(true);

    const clockOut = new Date().toISOString();
    const duration = Math.floor((Date.now() - new Date(clockedIn.clock_in).getTime()) / 60000);

    const { data } = await supabase.from("time_entries").update({
      clock_out: clockOut,
      duration_minutes: duration,
    }).eq("id", clockedIn.id).select().single();

    if (data) {
      setEntries(prev => prev.map(e => e.id === data.id ? data : e));
      setClockedIn(null);
      setElapsed(0);
      setClientId("");
      setNotes("");
    }
    setSaving(false);
  }

  function formatElapsed(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function formatDuration(minutes: number | null) {
    if (!minutes) return "—";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  }

  const clientMap = new Map(clients.map(c => [c.id, c.full_name]));
  const filteredEntries = entries.filter(e => e.clock_in.startsWith(filterDate));
  const todayMinutes = filteredEntries.reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);
  const weekEntries = entries.filter(e => {
    const d = new Date(e.clock_in);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  });
  const weekMinutes = weekEntries.reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);
  const byType = filteredEntries.reduce((acc, e) => {
    acc[e.session_type] = (acc[e.session_type] ?? 0) + (e.duration_minutes ?? 0);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <PageHeader title="Time Tracking">
        <p className="text-gray-500 text-sm">Clock in and out of sessions to track billable hours.</p>
      </PageHeader>

      <Section title={clockedIn ? "Currently Clocked In" : "Clock In"}>
        {clockedIn ? (
          <div className="text-center space-y-4 py-4">
            <div className={`text-5xl font-mono font-bold ${elapsed > 3600 ? "text-blue-600" : "text-green-600"}`}>
              {formatElapsed(elapsed)}
            </div>
            <div className="text-sm text-gray-500 space-y-1">
              <p>Session Type: <span className="font-medium text-gray-700">{clockedIn.session_type}</span></p>
              {clockedIn.client_id && (
                <p>Client: <span className="font-medium text-gray-700">{clientMap.get(clockedIn.client_id) ?? "Unknown"}</span></p>
              )}
              <p>Clocked in: <span className="font-medium text-gray-700">{new Date(clockedIn.clock_in).toLocaleTimeString()}</span></p>
            </div>
            <Button variant="danger" onClick={handleClockOut} loading={saving}>Clock Out</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Session Type</label>
              <select value={sessionType} onChange={e => setSessionType(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                {SESSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client (optional)</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">No client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notes (optional)</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Brief description..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="md:col-span-3">
              <Button onClick={handleClockIn} loading={saving}>Clock In</Button>
            </div>
          </div>
        )}
      </Section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Today", value: formatDuration(todayMinutes), color: "text-blue-600" },
          { label: "This Week", value: formatDuration(weekMinutes), color: "text-purple-600" },
          { label: "Today Sessions", value: filteredEntries.length, color: "text-green-600" },
          { label: "Week Sessions", value: weekEntries.length, color: "text-orange-500" },
        ].map(stat => (
          <div key={stat.label} className="border rounded-xl p-4 text-center bg-white">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {Object.keys(byType).length > 0 && (
        <Section title="Today by Session Type">
          <div className="space-y-2">
            {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, mins]) => (
              <div key={type} className="flex items-center gap-3">
                <p className="text-sm text-gray-600 w-40 truncate">{type}</p>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.min(100, (mins / todayMinutes) * 100)}%` }} />
                </div>
                <p className="text-sm font-medium text-gray-700 w-16 text-right">{formatDuration(mins)}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Time Log">
        <div className="flex items-center gap-3 mb-4">
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          <p className="text-sm text-gray-400">{filteredEntries.length} entries · {formatDuration(todayMinutes)} total</p>
        </div>

        {loading && <p className="text-gray-400 text-sm">Loading...</p>}
        {!loading && filteredEntries.length === 0 && <p className="text-gray-400 text-sm">No entries for this date.</p>}

        <div className="space-y-2">
          {filteredEntries.map(entry => (
            <div key={entry.id} className={`border rounded-xl p-4 bg-white flex justify-between items-center flex-wrap gap-2 ${!entry.clock_out ? "border-green-300 bg-green-50" : "border-gray-100"}`}>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-800 text-sm">{entry.session_type}</p>
                  {!entry.clock_out && (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full animate-pulse">Live</span>
                  )}
                </div>
                {entry.client_id && <p className="text-xs text-gray-400 mt-0.5">{clientMap.get(entry.client_id) ?? "Unknown"}</p>}
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(entry.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {entry.clock_out && ` → ${new Date(entry.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                </p>
                {entry.notes && <p className="text-xs text-gray-500 mt-1 italic">{entry.notes}</p>}
              </div>
              <span className={`text-sm font-bold ${entry.clock_out ? "text-blue-600" : "text-green-600"}`}>
                {entry.clock_out ? formatDuration(entry.duration_minutes) : formatElapsed(elapsed)}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}