"use client";

import { useEffect, useState, useRef } from "react";
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

type SessionNote = {
  id: string;
  client_id: string;
  behaviors_observed: string | null;
  interventions_used: string | null;
  client_response: string | null;
  programs_targeted: string | null;
  date: string | null;
  created_at: string;
};

const SESSION_TYPES = [
  "Direct Therapy",
  "Drive Time",
  "Supervision",
  "Parent Training",
  "Assessment",
  "Documentation",
  "Team Meeting",
  "Telehealth",
  "Other",
];

const MAX_DRIVE_TIME_MINUTES = 120; // 2 hours max paid drive time

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
  const [lastSessionNote, setLastSessionNote] = useState<SessionNote | null>(null);
  const [driveTimeWarning, setDriveTimeWarning] = useState(false);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => { void init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Timer tick
  useEffect(() => {
    if (!clockedIn) return;
    const interval = setInterval(() => {
      const newElapsed = Math.floor((Date.now() - new Date(clockedIn.clock_in).getTime()) / 1000);
      setElapsed(newElapsed);

      // Drive time warning at 1h45m (15 min before 2hr cap)
      if (clockedIn.session_type === "Drive Time" && newElapsed >= 6300 && newElapsed < 6360) {
        setDriveTimeWarning(true);
      }

      // Auto clock-out drive time at 2 hours
      if (clockedIn.session_type === "Drive Time" && newElapsed >= MAX_DRIVE_TIME_MINUTES * 60) {
        handleClockOut(true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [clockedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save notes every 30 seconds when clocked in
  useEffect(() => {
    if (!clockedIn || !notes.trim()) return;
    autoSaveRef.current = setInterval(async () => {
      await supabase.from("time_entries").update({ notes }).eq("id", clockedIn.id);
    }, 30000);
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
  }, [clockedIn, notes]);

  // Load last session note when client changes
  useEffect(() => {
    if (!clientId) { setLastSessionNote(null); return; }
    async function loadLastNote() {
      const { data } = await supabase.from("sessions")
        .select("id, client_id, behaviors_observed, interventions_used, client_response, programs_targeted, date, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setLastSessionNote(data ?? null);
    }
    loadLastNote();
  }, [clientId]);

  function populateFromSessionNote() {
    if (!lastSessionNote) return;
    const parts = [];
    if (lastSessionNote.date) parts.push(`Session date: ${lastSessionNote.date}`);
    if (lastSessionNote.behaviors_observed) parts.push(`Behaviors: ${lastSessionNote.behaviors_observed}`);
    if (lastSessionNote.interventions_used) parts.push(`Interventions: ${lastSessionNote.interventions_used}`);
    if (lastSessionNote.client_response) parts.push(`Response: ${lastSessionNote.client_response}`);
    if (lastSessionNote.programs_targeted) parts.push(`Programs: ${lastSessionNote.programs_targeted}`);
    setNotes(parts.join(" | "));
  }

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
      setDriveTimeWarning(false);
    }
    setSaving(false);
  }

  async function handleClockOut(autoCapped = false) {
    if (!clockedIn) return;
    setSaving(true);

    const clockOutTime = new Date();
    let duration = Math.floor((clockOutTime.getTime() - new Date(clockedIn.clock_in).getTime()) / 60000);

    // Cap drive time at 2 hours
    if (clockedIn.session_type === "Drive Time") {
      duration = Math.min(duration, MAX_DRIVE_TIME_MINUTES);
    }

    const { data } = await supabase.from("time_entries").update({
      clock_out: clockOutTime.toISOString(),
      duration_minutes: duration,
      notes: notes || clockedIn.notes,
    }).eq("id", clockedIn.id).select().single();

    if (data) {
      setEntries(prev => prev.map(e => e.id === data.id ? data : e));
      setClockedIn(null);
      setElapsed(0);
      setClientId("");
      setNotes("");
      setDriveTimeWarning(false);
      if (autoCapped) {
        alert("Drive time has been automatically capped at 2 hours (maximum paid drive time).");
      }
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

  const isDriveTime = clockedIn?.session_type === "Drive Time" || sessionType === "Drive Time";
  const driveTimeRemaining = clockedIn?.session_type === "Drive Time"
    ? Math.max(0, MAX_DRIVE_TIME_MINUTES * 60 - elapsed)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Time Tracking">
        <p className="text-gray-500 text-sm">Clock in and out of sessions to track billable hours.</p>
      </PageHeader>

      {/* DRIVE TIME WARNING */}
      {driveTimeWarning && (
        <div className="bg-orange-50 border border-orange-300 rounded-xl p-3 text-sm text-orange-800">
          ⚠️ <strong>Drive time cap approaching!</strong> You have 15 minutes remaining before the 2-hour maximum paid drive time limit.
        </div>
      )}

      <Section title={clockedIn ? "Currently Clocked In" : "Clock In"}>
        {clockedIn ? (
          <div className="text-center space-y-4 py-4">
            <div className={`text-5xl font-mono font-bold ${
              clockedIn.session_type === "Drive Time" ? "text-orange-500" :
              elapsed > 3600 ? "text-blue-600" : "text-green-600"
            }`}>
              {formatElapsed(elapsed)}
            </div>

            {/* Drive time progress bar */}
            {clockedIn.session_type === "Drive Time" && (
              <div className="max-w-sm mx-auto">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Drive Time</span>
                  <span>{driveTimeRemaining !== null ? formatElapsed(driveTimeRemaining) : ""} remaining</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${elapsed >= MAX_DRIVE_TIME_MINUTES * 60 * 0.85 ? "bg-red-500" : "bg-orange-400"}`}
                    style={{ width: `${Math.min(100, (elapsed / (MAX_DRIVE_TIME_MINUTES * 60)) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1 text-center">Max 2 hours paid drive time per day</p>
              </div>
            )}

            <div className="text-sm text-gray-500 space-y-1">
              <p>Session Type: <span className="font-medium text-gray-700">{clockedIn.session_type}</span></p>
              {clockedIn.client_id && (
                <p>Client: <span className="font-medium text-gray-700">{clientMap.get(clockedIn.client_id) ?? "Unknown"}</span></p>
              )}
              <p>Clocked in: <span className="font-medium text-gray-700">{new Date(clockedIn.clock_in).toLocaleTimeString()}</span></p>
            </div>

            {/* Notes auto-save while clocked in */}
            <div className="max-w-sm mx-auto text-left">
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Notes <span className="text-xs text-gray-400 font-normal">(auto-saves every 30 seconds)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Add notes about this session..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            <Button variant="danger" onClick={() => handleClockOut(false)} loading={saving}>
              Clock Out {clockedIn.session_type === "Drive Time" ? `(${formatDuration(Math.min(Math.floor(elapsed / 60), MAX_DRIVE_TIME_MINUTES))} billable)` : ""}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Session Type</label>
                <select value={sessionType} onChange={e => setSessionType(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  {SESSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {isDriveTime && (
                  <p className="text-xs text-orange-600 mt-1">🚗 Max 2 hours paid drive time — auto-caps at limit</p>
                )}
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
                <div className="flex gap-2">
                  <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Brief description..."
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  {lastSessionNote && (
                    <button
                      type="button"
                      onClick={populateFromSessionNote}
                      title="Populate from last session note"
                      className="px-3 py-2 bg-blue-50 border border-blue-200 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors whitespace-nowrap">
                      📋 From Session
                    </button>
                  )}
                </div>
                {lastSessionNote && (
                  <p className="text-xs text-gray-400 mt-1">Last session: {lastSessionNote.date ?? new Date(lastSessionNote.created_at).toLocaleDateString()}</p>
                )}
              </div>
            </div>
            <Button onClick={handleClockIn} loading={saving}>
              {isDriveTime ? "🚗 Start Drive Time" : "Clock In"}
            </Button>
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
                  <div className={`h-2 rounded-full ${type === "Drive Time" ? "bg-orange-400" : "bg-blue-500"}`}
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
            <div key={entry.id} className={`border rounded-xl p-4 bg-white flex justify-between items-center flex-wrap gap-2 ${
              !entry.clock_out ? "border-green-300 bg-green-50" :
              entry.session_type === "Drive Time" ? "border-orange-100 bg-orange-50" :
              "border-gray-100"
            }`}>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-800 text-sm">
                    {entry.session_type === "Drive Time" ? "🚗 " : ""}{entry.session_type}
                  </p>
                  {!entry.clock_out && (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full animate-pulse">Live</span>
                  )}
                  {entry.session_type === "Drive Time" && entry.clock_out && (
                    <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">Capped at 2hr max</span>
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