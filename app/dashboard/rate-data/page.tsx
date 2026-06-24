"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type RateRecord = {
  id: string;
  client_id: string;
  behavior_name: string;
  count: number;
  observation_minutes: number;
  session_date: string;
  notes: string;
  created_at: string;
};

const BEHAVIOR_NAMES = ["Aggression", "Self-Injurious Behavior", "Elopement", "Vocal Disruption", "Stereotypy", "Hand Flapping", "Rocking", "Manding", "Appropriate Requests", "Other"];

export default function RateDataPage() {
  const [records, setRecords] = useState<RateRecord[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState("");
  const [saving, setSaving] = useState(false);

  // Live counter
  const [clientId, setClientId] = useState("");
  const [behaviorName, setBehaviorName] = useState("");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [count, setCount] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showSetup, setShowSetup] = useState(false);
  const timerRef = useRef<any>(null);

  useEffect(() => { init(); }, []);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    } else {
      clearInterval(timerRef.current!);
    }
    return () => clearInterval(timerRef.current!);
  }, [timerRunning]);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: recordData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
      supabase.from("rate_data").select("*").eq("created_by", user.id).order("created_at", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setRecords(recordData ?? []);
    setLoading(false);
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function ratePerMinute() {
    const mins = elapsedSeconds / 60;
    if (!mins) return 0;
    return (count / mins).toFixed(2);
  }

  async function handleSave() {
    if (!clientId || !behaviorName) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error } = await supabase.from("rate_data").insert([{
      client_id: clientId,
      behavior_name: behaviorName,
      count,
      observation_minutes: Math.ceil(elapsedSeconds / 60),
      session_date: sessionDate,
      notes,
      created_by: user.id,
    }]).select().single();

    if (!error && data) {
      setRecords((prev) => [data, ...prev]);
      setCount(0);
      setElapsedSeconds(0);
      setTimerRunning(false);
      setShowSetup(false);
    }
    setSaving(false);
  }

  const filtered = filterClient ? records.filter((r) => r.client_id === filterClient) : records;
  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  return (
    <div className="space-y-6">
      <PageHeader title="Rate Data Collection">
        <Button onClick={() => setShowSetup(!showSetup)}>
          {showSetup ? "Cancel" : "+ New Rate Session"}
        </Button>
      </PageHeader>

      {showSetup && (
        <Section title="Rate Data Session">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
              <label className="text-sm font-medium text-gray-700 mb-1 block">Session Date</label>
              <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          {/* LIVE COUNTER */}
          <div className="text-center space-y-6 py-4 border border-gray-100 rounded-xl bg-gray-50">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-4xl font-bold text-blue-600">{count}</p>
                <p className="text-xs text-gray-500 mt-1">Count</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-gray-700">{formatTime(elapsedSeconds)}</p>
                <p className="text-xs text-gray-500 mt-1">Elapsed</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-green-600">{ratePerMinute()}</p>
                <p className="text-xs text-gray-500 mt-1">Per Minute</p>
              </div>
            </div>

            <button
              onClick={() => setCount((c) => c + 1)}
              disabled={!timerRunning}
              className="w-48 h-24 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-2xl font-bold rounded-2xl shadow-lg transition-transform active:scale-95"
            >
              + Count
            </button>

            <div className="flex gap-3 justify-center">
              <Button onClick={() => setTimerRunning(!timerRunning)} variant={timerRunning ? "danger" : "secondary"}>
                {timerRunning ? "⏸ Pause" : "▶ Start Timer"}
              </Button>
              <Button variant="outline" onClick={() => { setCount(0); setElapsedSeconds(0); setTimerRunning(false); }}>
                Reset
              </Button>
              <Button onClick={handleSave} loading={saving} disabled={!clientId || !behaviorName || count === 0}>
                Save
              </Button>
            </div>
          </div>
        </Section>
      )}

      {/* FILTER */}
      {!loading && records.length > 0 && (
        <div className="flex gap-3 items-center">
          <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <p className="text-sm text-gray-400">{filtered.length} records</p>
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <Section title="Rate Data Records">
          <p className="text-gray-400 text-sm">No rate data recorded yet.</p>
        </Section>
      )}

      <div className="space-y-3">
        {filtered.map((r) => {
          const rate = r.observation_minutes ? (r.count / r.observation_minutes).toFixed(2) : "0";
          return (
            <div key={r.id} className="border border-gray-100 rounded-xl p-4 bg-white">
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <p className="font-semibold text-gray-800">{r.behavior_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {clientMap.get(r.client_id) ?? "Unknown"} · {r.session_date} · {r.observation_minutes} min observation
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                    {r.count} occurrences
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 font-medium">
                    {rate}/min
                  </span>
                </div>
              </div>
              {r.notes && <p className="text-xs text-gray-500 mt-2">{r.notes}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}