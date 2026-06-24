"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type IntervalResult = { interval: number; occurred: boolean | null };
type Recording = {
  id: string;
  client_id: string;
  behavior_name: string;
  interval_type: string;
  interval_duration_seconds: number;
  intervals: IntervalResult[];
  session_date: string;
  notes: string;
  created_at: string;
};

const INTERVAL_TYPES = [
  { value: "whole", label: "Whole Interval", desc: "Behavior must occur for entire interval" },
  { value: "partial", label: "Partial Interval", desc: "Behavior occurs at any point during interval" },
  { value: "momentary", label: "Momentary Time Sampling", desc: "Behavior occurring at end of interval" },
];

const BEHAVIOR_NAMES = ["Aggression", "Self-Injurious Behavior", "Elopement", "On-task behavior", "Stereotypy", "Vocal Disruption", "Engagement", "Other"];
const DURATIONS = [5, 10, 15, 20, 30, 60];

export default function IntervalRecordingPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState("");

  // Session setup
  const [clientId, setClientId] = useState("");
  const [behaviorName, setBehaviorName] = useState("");
  const [intervalType, setIntervalType] = useState("partial");
  const [intervalDuration, setIntervalDuration] = useState(10);
  const [totalIntervals, setTotalIntervals] = useState(20);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [showSetup, setShowSetup] = useState(false);

  // Live recording state
  const [recording, setRecording] = useState(false);
  const [intervals, setIntervals] = useState<IntervalResult[]>([]);
  const [currentInterval, setCurrentInterval] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<any>(null);

  useEffect(() => { init(); }, []);

  useEffect(() => {
    if (!recording) return;
    if (currentInterval >= totalIntervals) { setRecording(false); setDone(true); return; }
    setTimeLeft(intervalDuration);

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current!);
  }, [recording, currentInterval]);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: recData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
      supabase.from("interval_recordings").select("*").eq("created_by", user.id).order("created_at", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setRecordings((recData ?? []).map((r: any) => ({ ...r, intervals: Array.isArray(r.intervals) ? r.intervals : JSON.parse(r.intervals || "[]") })));
    setLoading(false);
  }

  function startRecording() {
    if (!clientId || !behaviorName) return;
    const init: IntervalResult[] = Array.from({ length: totalIntervals }, (_, i) => ({ interval: i + 1, occurred: null }));
    setIntervals(init);
    setCurrentInterval(0);
    setDone(false);
    setRecording(true);
    setShowSetup(false);
  }

  function markInterval(occurred: boolean) {
    setIntervals((prev) => prev.map((iv) => iv.interval === currentInterval + 1 ? { ...iv, occurred } : iv));
    clearInterval(timerRef.current!);
    setCurrentInterval((i) => i + 1);
  }

  async function saveRecording() {
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error } = await supabase.from("interval_recordings").insert([{
      client_id: clientId,
      behavior_name: behaviorName,
      interval_type: intervalType,
      interval_duration_seconds: intervalDuration,
      intervals: JSON.stringify(intervals),
      session_date: sessionDate,
      notes,
      created_by: user.id,
    }]).select().single();

    if (!error && data) {
      setRecordings((prev) => [{ ...data, intervals }, ...prev]);
      setDone(false);
      setIntervals([]);
      setCurrentInterval(0);
    }
    setSaving(false);
  }

  function occurrenceRate(intervals: IntervalResult[]) {
    const scored = intervals.filter((i) => i.occurred !== null);
    if (!scored.length) return 0;
    return Math.round((scored.filter((i) => i.occurred).length / scored.length) * 100);
  }

  const filtered = filterClient ? recordings.filter((r) => r.client_id === filterClient) : recordings;
  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  return (
    <div className="space-y-6">
      <PageHeader title="Interval Recording">
        <Button onClick={() => setShowSetup(!showSetup)}>
          {showSetup ? "Cancel" : "+ New Recording Session"}
        </Button>
      </PageHeader>

      {/* SETUP */}
      {showSetup && (
        <Section title="Session Setup">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Behavior *</label>
              <select value={behaviorName} onChange={(e) => setBehaviorName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select behavior...</option>
                {BEHAVIOR_NAMES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Interval Type</label>
              <div className="space-y-2">
                {INTERVAL_TYPES.map((t) => (
                  <button key={t.value} onClick={() => setIntervalType(t.value)}
                    className={`w-full text-left border rounded-lg p-3 transition-all ${intervalType === t.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}>
                    <p className="text-sm font-medium text-gray-800">{t.label}</p>
                    <p className="text-xs text-gray-500">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Interval Duration (seconds)</label>
                <div className="flex gap-2 flex-wrap">
                  {DURATIONS.map((d) => (
                    <button key={d} onClick={() => setIntervalDuration(d)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${intervalDuration === d ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:border-blue-300"}`}>
                      {d}s
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Total Intervals: {totalIntervals}</label>
                <input type="range" min={5} max={60} value={totalIntervals} onChange={(e) => setTotalIntervals(parseInt(e.target.value))} className="w-full" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Session Date</label>
                <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={startRecording} disabled={!clientId || !behaviorName}>
              â–¶ Start Recording
            </Button>
          </div>
        </Section>
      )}

      {/* LIVE RECORDING */}
      {recording && (
        <Section title={`Recording "” Interval ${currentInterval + 1} of ${totalIntervals}`}>
          <div className="text-center space-y-6 py-4">
            <div className="text-7xl font-bold text-blue-600">{timeLeft}</div>
            <p className="text-gray-500">seconds remaining in interval</p>
            <p className="text-sm font-medium text-gray-700">
              {INTERVAL_TYPES.find((t) => t.value === intervalType)?.label} "” {behaviorName}
            </p>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div className="bg-blue-500 h-3 rounded-full transition-all"
                style={{ width: `${((intervalDuration - timeLeft) / intervalDuration) * 100}%` }} />
            </div>
            <div className="flex gap-4 justify-center">
              <button onClick={() => markInterval(true)}
                className="w-36 h-20 bg-green-500 hover:bg-green-600 text-white text-lg font-bold rounded-2xl shadow-lg transition-transform active:scale-95">
                âœ“ Occurred
              </button>
              <button onClick={() => markInterval(false)}
                className="w-36 h-20 bg-red-500 hover:bg-red-600 text-white text-lg font-bold rounded-2xl shadow-lg transition-transform active:scale-95">
                âœ— Did Not
              </button>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {intervals.map((iv) => (
                <div key={iv.interval}
                  className={`w-8 h-8 rounded text-xs flex items-center justify-center font-medium ${iv.occurred === true ? "bg-green-500 text-white" : iv.occurred === false ? "bg-red-500 text-white" : iv.interval === currentInterval + 1 ? "bg-blue-500 text-white animate-pulse" : "bg-gray-200 text-gray-500"}`}>
                  {iv.interval}
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* RESULTS */}
      {done && (
        <Section title="Session Complete">
          <div className="text-center space-y-4 py-4">
            <p className="text-5xl font-bold text-blue-600">{occurrenceRate(intervals)}%</p>
            <p className="text-gray-500">Occurrence Rate</p>
            <div className="flex justify-center gap-8">
              <div>
                <p className="text-2xl font-bold text-green-600">{intervals.filter((i) => i.occurred).length}</p>
                <p className="text-xs text-gray-500">Occurred</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-500">{intervals.filter((i) => !i.occurred && i.occurred !== null).length}</p>
                <p className="text-xs text-gray-500">Did Not Occur</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-700">{totalIntervals}</p>
                <p className="text-xs text-gray-500">Total Intervals</p>
              </div>
            </div>
            <div className="flex gap-2 justify-center">
              <Button onClick={saveRecording} loading={saving}>Save Recording</Button>
              <Button variant="outline" onClick={() => { setDone(false); setIntervals([]); }}>Discard</Button>
            </div>
          </div>
        </Section>
      )}

      {/* FILTER */}
      {!loading && recordings.length > 0 && (
        <div className="flex gap-3 items-center">
          <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <p className="text-sm text-gray-400">{filtered.length} recordings</p>
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <Section title="Recordings">
          <p className="text-gray-400 text-sm">No interval recordings yet.</p>
        </Section>
      )}

      <div className="space-y-3">
        {filtered.map((r) => {
          const rate = occurrenceRate(r.intervals);
          return (
            <div key={r.id} className="border border-gray-100 rounded-xl p-4 bg-white">
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <p className="font-semibold text-gray-800">{r.behavior_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {clientMap.get(r.client_id) ?? "Unknown"} Â· {r.session_date} Â· {INTERVAL_TYPES.find((t) => t.value === r.interval_type)?.label} Â· {r.interval_duration_seconds}s intervals
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${rate >= 80 ? "bg-red-100 text-red-700" : rate >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                  {rate}% occurrence
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {r.intervals.map((iv) => (
                  <div key={iv.interval}
                    className={`w-6 h-6 rounded text-xs flex items-center justify-center ${iv.occurred ? "bg-red-400 text-white" : "bg-green-200 text-green-800"}`}>
                    {iv.interval}
                  </div>
                ))}
              </div>
              {r.notes && <p className="text-xs text-gray-500 mt-2">{r.notes}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
