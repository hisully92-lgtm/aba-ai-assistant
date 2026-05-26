"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };

const METHODS = [
  { key: "frequency", label: "Frequency", icon: "🔢", desc: "Count every instance of a behavior", category: "continuous" },
  { key: "rate", label: "Rate", icon: "📈", desc: "Frequency divided by observation time", category: "continuous" },
  { key: "duration", label: "Duration", icon: "⏱", desc: "Total time engaged in a behavior", category: "continuous" },
  { key: "latency", label: "Latency", icon: "⏳", desc: "Time between instruction and behavior start", category: "continuous" },
  { key: "irt", label: "IRT", icon: "↔️", desc: "Time between end of one behavior and start of next", category: "continuous" },
  { key: "partial", label: "Partial Interval", icon: "◑", desc: "Behavior occurs at any point in interval", category: "discontinuous" },
  { key: "whole", label: "Whole Interval", icon: "⬤", desc: "Behavior persists entire interval", category: "discontinuous" },
  { key: "momentary", label: "Momentary Time Sampling", icon: "📍", desc: "Behavior occurring at end of interval", category: "discontinuous" },
  { key: "permanent", label: "Permanent Product", icon: "📋", desc: "Tangible results or outcomes of behavior", category: "other" },
  { key: "abc", label: "ABC Data", icon: "🔤", desc: "Antecedent, Behavior, Consequence recording", category: "other" },
];

const BEHAVIOR_NAMES = ["Aggression", "Self-Injurious Behavior", "Elopement", "On-task behavior", "Stereotypy", "Vocal Disruption", "Engagement", "Compliance", "Manding", "Other"];

export default function DataCollectionPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [behaviorName, setBehaviorName] = useState("");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  // Frequency state
  const [freqCount, setFreqCount] = useState(0);

  // Rate state
  const [rateCount, setRateCount] = useState(0);
  const [rateRunning, setRateRunning] = useState(false);
  const [rateElapsed, setRateElapsed] = useState(0);
  const rateRef = useRef<NodeJS.Timeout | null>(null);

  // Duration state
  const [durRunning, setDurRunning] = useState(false);
  const [durElapsed, setDurElapsed] = useState(0);
  const [durSessions, setDurSessions] = useState<number[]>([]);
  const durRef = useRef<NodeJS.Timeout | null>(null);

  // Latency state
  const [latRunning, setLatRunning] = useState(false);
  const [latElapsed, setLatElapsed] = useState(0);
  const [latInstruction, setLatInstruction] = useState("");
  const latRef = useRef<NodeJS.Timeout | null>(null);

  // IRT state
  const [irtRunning, setIrtRunning] = useState(false);
  const [irtElapsed, setIrtElapsed] = useState(0);
  const [irtIntervals, setIrtIntervals] = useState<number[]>([]);
  const irtRef = useRef<NodeJS.Timeout | null>(null);

  // Permanent product state
  const [permCount, setPermCount] = useState(0);
  const [permDesc, setPermDesc] = useState("");

  // ABC state
  const [abcAntecedent, setAbcAntecedent] = useState("");
  const [abcBehavior, setAbcBehavior] = useState("");
  const [abcConsequence, setAbcConsequence] = useState("");

  useEffect(() => { init(); }, []);

  useEffect(() => {
    if (rateRunning) {
      rateRef.current = setInterval(() => setRateElapsed((s) => s + 1), 1000);
    } else clearInterval(rateRef.current!);
    return () => clearInterval(rateRef.current!);
  }, [rateRunning]);

  useEffect(() => {
    if (durRunning) {
      durRef.current = setInterval(() => setDurElapsed((s) => s + 1), 1000);
    } else clearInterval(durRef.current!);
    return () => clearInterval(durRef.current!);
  }, [durRunning]);

  useEffect(() => {
    if (latRunning) {
      latRef.current = setInterval(() => setLatElapsed((s) => s + 1), 1000);
    } else clearInterval(latRef.current!);
    return () => clearInterval(latRef.current!);
  }, [latRunning]);

  useEffect(() => {
    if (irtRunning) {
      irtRef.current = setInterval(() => setIrtElapsed((s) => s + 1), 1000);
    } else clearInterval(irtRef.current!);
    return () => clearInterval(irtRef.current!);
  }, [irtRunning]);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const { data } = await supabase.from("clients").select("id, full_name").eq("created_by", user.id);
    setClients(data ?? []);
    setLoading(false);
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function stopDuration() {
    setDurRunning(false);
    setDurSessions((prev) => [...prev, durElapsed]);
    setDurElapsed(0);
  }

  function recordIRT() {
    setIrtIntervals((prev) => [...prev, irtElapsed]);
    setIrtElapsed(0);
  }

  async function handleSave() {
    if (!clientId || !behaviorName || !selectedMethod) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    try {
      if (selectedMethod === "frequency") {
        await supabase.from("behaviors").insert([{
          client_id: clientId,
          behavior_name: behaviorName,
          frequency: freqCount,
          recording_method: "frequency",
          notes,
          created_by: user.id,
        }]);
      } else if (selectedMethod === "rate") {
        await supabase.from("rate_data").insert([{
          client_id: clientId,
          behavior_name: behaviorName,
          count: rateCount,
          observation_minutes: Math.ceil(rateElapsed / 60),
          session_date: sessionDate,
          notes,
          created_by: user.id,
        }]);
      } else if (selectedMethod === "duration") {
        const totalDuration = durSessions.reduce((a, b) => a + b, 0);
        await supabase.from("behaviors").insert([{
          client_id: clientId,
          behavior_name: behaviorName,
          duration_minutes: Math.ceil(totalDuration / 60),
          recording_method: "duration",
          notes: `Sessions: ${durSessions.map((s) => formatTime(s)).join(", ")}. ${notes}`,
          created_by: user.id,
        }]);
      } else if (selectedMethod === "latency") {
        await supabase.from("latency_recordings").insert([{
          client_id: clientId,
          behavior_name: behaviorName,
          instruction_given: latInstruction,
          latency_seconds: latElapsed,
          recording_type: "latency",
          session_date: sessionDate,
          notes,
          created_by: user.id,
        }]);
      } else if (selectedMethod === "irt") {
        const avgIRT = irtIntervals.length ? irtIntervals.reduce((a, b) => a + b, 0) / irtIntervals.length : 0;
        await supabase.from("irt_recordings").insert([{
          client_id: clientId,
          behavior_name: behaviorName,
          intervals: JSON.stringify(irtIntervals),
          avg_irt_seconds: avgIRT,
          session_date: sessionDate,
          notes,
          created_by: user.id,
        }]);
      } else if (selectedMethod === "permanent") {
        await supabase.from("permanent_product").insert([{
          client_id: clientId,
          behavior_name: behaviorName,
          product_description: permDesc,
          count: permCount,
          session_date: sessionDate,
          notes,
          created_by: user.id,
        }]);
      } else if (selectedMethod === "abc") {
        await supabase.from("behaviors").insert([{
          client_id: clientId,
          behavior_name: behaviorName,
          antecedent: abcAntecedent,
          consequence: abcConsequence,
          recording_method: "abc",
          notes: abcBehavior,
          created_by: user.id,
        }]);
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      resetForm();
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  }

  function resetForm() {
    setFreqCount(0);
    setRateCount(0); setRateElapsed(0); setRateRunning(false);
    setDurElapsed(0); setDurRunning(false); setDurSessions([]);
    setLatElapsed(0); setLatRunning(false); setLatInstruction("");
    setIrtElapsed(0); setIrtRunning(false); setIrtIntervals([]);
    setPermCount(0); setPermDesc("");
    setAbcAntecedent(""); setAbcBehavior(""); setAbcConsequence("");
    setNotes("");
  }

  const continuous = METHODS.filter((m) => m.category === "continuous");
  const discontinuous = METHODS.filter((m) => m.category === "discontinuous");
  const other = METHODS.filter((m) => m.category === "other");

  return (
    <div className="space-y-6">
      <PageHeader title="ABA Data Collection">
        <p className="text-gray-500 text-sm">All recording methods in one place.</p>
      </PageHeader>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          ✓ Data saved successfully.
        </div>
      )}

      {/* METHOD SELECTOR */}
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Continuous Recording
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {continuous.map((m) => (
              <button key={m.key} onClick={() => { setSelectedMethod(m.key); resetForm(); }}
                className={`border-2 rounded-xl p-3 text-left transition-all ${selectedMethod === m.key ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300 bg-white"}`}>
                <p className="text-xl mb-1">{m.icon}</p>
                <p className="text-xs font-bold text-gray-800">{m.label}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-tight">{m.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Discontinuous / Interval Recording
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {discontinuous.map((m) => (
              <button key={m.key} onClick={() => { setSelectedMethod(m.key); resetForm(); }}
                className={`border-2 rounded-xl p-3 text-left transition-all ${selectedMethod === m.key ? "border-purple-500 bg-purple-50" : "border-gray-200 hover:border-purple-300 bg-white"}`}>
                <p className="text-xl mb-1">{m.icon}</p>
                <p className="text-xs font-bold text-gray-800">{m.label}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-tight">{m.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Other Methods
          </p>
          <div className="grid grid-cols-2 gap-2">
            {other.map((m) => (
              <button key={m.key} onClick={() => { setSelectedMethod(m.key); resetForm(); }}
                className={`border-2 rounded-xl p-3 text-left transition-all ${selectedMethod === m.key ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-green-300 bg-white"}`}>
                <p className="text-xl mb-1">{m.icon}</p>
                <p className="text-xs font-bold text-gray-800">{m.label}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-tight">{m.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SESSION SETUP — shared across all methods */}
      {selectedMethod && (
        <Section title={`${METHODS.find((m) => m.key === selectedMethod)?.icon} ${METHODS.find((m) => m.key === selectedMethod)?.label} Recording`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
          </div>

          {/* FREQUENCY */}
          {selectedMethod === "frequency" && (
            <div className="text-center space-y-4 py-4">
              <p className="text-7xl font-bold text-blue-600">{freqCount}</p>
              <p className="text-gray-400 text-sm">Total occurrences</p>
              <div className="flex gap-4 justify-center">
                <button onClick={() => setFreqCount((c) => c + 1)}
                  className="w-32 h-20 bg-blue-600 hover:bg-blue-700 text-white text-2xl font-bold rounded-2xl shadow-lg active:scale-95 transition-transform">
                  + Count
                </button>
                <button onClick={() => setFreqCount((c) => Math.max(0, c - 1))}
                  className="w-20 h-20 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xl font-bold rounded-2xl active:scale-95 transition-transform">
                  −
                </button>
              </div>
              <Button variant="outline" onClick={() => setFreqCount(0)}>Reset</Button>
            </div>
          )}

          {/* RATE */}
          {selectedMethod === "rate" && (
            <div className="text-center space-y-4 py-4">
              <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
                <div>
                  <p className="text-4xl font-bold text-blue-600">{rateCount}</p>
                  <p className="text-xs text-gray-400">Count</p>
                </div>
                <div>
                  <p className="text-4xl font-bold text-gray-700">{formatTime(rateElapsed)}</p>
                  <p className="text-xs text-gray-400">Elapsed</p>
                </div>
                <div>
                  <p className="text-4xl font-bold text-green-600">
                    {rateElapsed > 0 ? (rateCount / (rateElapsed / 60)).toFixed(2) : "0"}
                  </p>
                  <p className="text-xs text-gray-400">Per Min</p>
                </div>
              </div>
              <button onClick={() => { if (rateRunning) setRateCount((c) => c + 1); }}
                disabled={!rateRunning}
                className="w-40 h-24 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-2xl font-bold rounded-2xl shadow-lg active:scale-95 transition-transform">
                + Count
              </button>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => setRateRunning(!rateRunning)} variant={rateRunning ? "danger" : "secondary"}>
                  {rateRunning ? "⏸ Pause" : "▶ Start"}
                </Button>
                <Button variant="outline" onClick={() => { setRateCount(0); setRateElapsed(0); setRateRunning(false); }}>Reset</Button>
              </div>
            </div>
          )}

          {/* DURATION */}
          {selectedMethod === "duration" && (
            <div className="text-center space-y-4 py-4">
              <p className="text-7xl font-bold text-purple-600">{formatTime(durElapsed)}</p>
              <p className="text-gray-400 text-sm">
                Current episode · Total: {formatTime(durSessions.reduce((a, b) => a + b, 0))} across {durSessions.length} episodes
              </p>
              <div className="flex gap-4 justify-center">
                <button onClick={() => setDurRunning(!durRunning)}
                  className={`w-36 h-20 text-white text-xl font-bold rounded-2xl shadow-lg active:scale-95 transition-all ${durRunning ? "bg-red-500 hover:bg-red-600" : "bg-purple-600 hover:bg-purple-700"}`}>
                  {durRunning ? "⏹ Stop" : "▶ Start"}
                </button>
                {durRunning && (
                  <button onClick={stopDuration}
                    className="w-36 h-20 bg-orange-500 hover:bg-orange-600 text-white text-xl font-bold rounded-2xl shadow-lg active:scale-95 transition-transform">
                    Mark End
                  </button>
                )}
              </div>
              {durSessions.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {durSessions.map((s, i) => (
                    <span key={i} className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                      Episode {i + 1}: {formatTime(s)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* LATENCY */}
          {selectedMethod === "latency" && (
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Instruction Given</label>
                <input type="text" value={latInstruction} onChange={(e) => setLatInstruction(e.target.value)}
                  placeholder="e.g. Sit down, Touch red, Come here"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div className="text-center space-y-4">
                <p className="text-7xl font-bold text-orange-500">{formatTime(latElapsed)}</p>
                <p className="text-gray-400 text-sm">Time since instruction given</p>
                <div className="flex gap-4 justify-center">
                  <button onClick={() => setLatRunning(true)} disabled={latRunning}
                    className="w-36 h-20 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white text-lg font-bold rounded-2xl shadow-lg active:scale-95 transition-transform">
                    Give Instruction
                  </button>
                  <button onClick={() => setLatRunning(false)} disabled={!latRunning}
                    className="w-36 h-20 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white text-lg font-bold rounded-2xl shadow-lg active:scale-95 transition-transform">
                    Behavior Started
                  </button>
                </div>
                <Button variant="outline" onClick={() => { setLatElapsed(0); setLatRunning(false); }}>Reset</Button>
              </div>
            </div>
          )}

          {/* IRT */}
          {selectedMethod === "irt" && (
            <div className="text-center space-y-4 py-4">
              <p className="text-7xl font-bold text-teal-600">{formatTime(irtElapsed)}</p>
              <p className="text-gray-400 text-sm">
                Time since last behavior ended · {irtIntervals.length} intervals recorded
                {irtIntervals.length > 0 && ` · Avg: ${formatTime(Math.round(irtIntervals.reduce((a, b) => a + b, 0) / irtIntervals.length))}`}
              </p>
              <div className="flex gap-4 justify-center">
                <button onClick={() => { if (!irtRunning) setIrtRunning(true); else { recordIRT(); } }}
                  className={`w-40 h-24 text-white text-lg font-bold rounded-2xl shadow-lg active:scale-95 transition-all ${irtRunning ? "bg-teal-500 hover:bg-teal-600" : "bg-blue-600 hover:bg-blue-700"}`}>
                  {irtRunning ? "Behavior Ended (Record IRT)" : "▶ Start"}
                </button>
              </div>
              {irtIntervals.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {irtIntervals.map((s, i) => (
                    <span key={i} className="text-xs px-2 py-1 bg-teal-100 text-teal-700 rounded-full">
                      IRT {i + 1}: {formatTime(s)}
                    </span>
                  ))}
                </div>
              )}
              <Button variant="outline" onClick={() => { setIrtElapsed(0); setIrtRunning(false); setIrtIntervals([]); }}>Reset</Button>
            </div>
          )}

          {/* INTERVAL METHODS — redirect */}
          {(selectedMethod === "partial" || selectedMethod === "whole" || selectedMethod === "momentary") && (
            <div className="text-center py-8 space-y-4">
              <p className="text-4xl">
                {selectedMethod === "partial" ? "◑" : selectedMethod === "whole" ? "⬤" : "📍"}
              </p>
              <p className="text-gray-700 font-medium">
                {selectedMethod === "partial" ? "Partial Interval Recording" : selectedMethod === "whole" ? "Whole Interval Recording" : "Momentary Time Sampling"}
              </p>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                {selectedMethod === "partial" && "Behavior is scored if it occurs at any point during the interval. Tends to overestimate."}
                {selectedMethod === "whole" && "Behavior is scored only if it persists the entire interval. Tends to underestimate."}
                {selectedMethod === "momentary" && "Behavior is scored only if occurring at the exact end of the interval."}
              </p>
              <Button onClick={() => window.location.href = "/dashboard/interval-recording"}>
                Open Interval Recording Tool →
              </Button>
            </div>
          )}

          {/* PERMANENT PRODUCT */}
          {selectedMethod === "permanent" && (
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Product Description</label>
                <input type="text" value={permDesc} onChange={(e) => setPermDesc(e.target.value)}
                  placeholder="e.g. Completed math problems, cleaned bedroom items"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div className="text-center space-y-4">
                <p className="text-7xl font-bold text-indigo-600">{permCount}</p>
                <p className="text-gray-400 text-sm">Products counted</p>
                <div className="flex gap-4 justify-center">
                  <button onClick={() => setPermCount((c) => c + 1)}
                    className="w-32 h-20 bg-indigo-600 hover:bg-indigo-700 text-white text-2xl font-bold rounded-2xl shadow-lg active:scale-95 transition-transform">
                    + Count
                  </button>
                  <button onClick={() => setPermCount((c) => Math.max(0, c - 1))}
                    className="w-20 h-20 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xl font-bold rounded-2xl active:scale-95 transition-transform">
                    −
                  </button>
                </div>
                <Button variant="outline" onClick={() => setPermCount(0)}>Reset</Button>
              </div>
            </div>
          )}

          {/* ABC */}
          {selectedMethod === "abc" && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border-2 border-blue-200 rounded-xl p-4 bg-blue-50">
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">A — Antecedent</p>
                  <p className="text-xs text-blue-500 mb-2">What happened right before?</p>
                  <textarea value={abcAntecedent} onChange={(e) => setAbcAntecedent(e.target.value)}
                    placeholder="Describe what triggered the behavior..." rows={4}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div className="border-2 border-red-200 rounded-xl p-4 bg-red-50">
                  <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2">B — Behavior</p>
                  <p className="text-xs text-red-500 mb-2">Exact behavior observed?</p>
                  <textarea value={abcBehavior} onChange={(e) => setAbcBehavior(e.target.value)}
                    placeholder="Describe the behavior exactly as observed..." rows={4}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div className="border-2 border-green-200 rounded-xl p-4 bg-green-50">
                  <p className="text-xs font-bold text-green-600 uppercase tracking-wide mb-2">C — Consequence</p>
                  <p className="text-xs text-green-500 mb-2">What happened after?</p>
                  <textarea value={abcConsequence} onChange={(e) => setAbcConsequence(e.target.value)}
                    placeholder="Describe the response/consequence..." rows={4}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>
            </div>
          )}

          {/* NOTES + SAVE */}
          {selectedMethod && !["partial", "whole", "momentary"].includes(selectedMethod) && (
            <div className="mt-6 space-y-3 border-t border-gray-100 pt-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional observations..." rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <Button onClick={handleSave} loading={saving} disabled={!clientId || !behaviorName}>
                💾 Save Data
              </Button>
            </div>
          )}
        </Section>
      )}

      {/* REFERENCE GUIDE */}
      {!selectedMethod && (
        <Section title="Recording Method Reference">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="border border-blue-100 rounded-xl p-4 bg-blue-50">
              <p className="font-bold text-blue-800 mb-3">Continuous Recording</p>
              <div className="space-y-2">
                {continuous.map((m) => (
                  <div key={m.key}>
                    <p className="font-medium text-gray-700">{m.icon} {m.label}</p>
                    <p className="text-xs text-gray-500">{m.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="border border-purple-100 rounded-xl p-4 bg-purple-50">
              <p className="font-bold text-purple-800 mb-3">Discontinuous / Interval Recording</p>
              <div className="space-y-2">
                {discontinuous.map((m) => (
                  <div key={m.key}>
                    <p className="font-medium text-gray-700">{m.icon} {m.label}</p>
                    <p className="text-xs text-gray-500">{m.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="border border-green-100 rounded-xl p-4 bg-green-50 md:col-span-2">
              <p className="font-bold text-green-800 mb-3">Other Methods</p>
              <div className="grid grid-cols-2 gap-2">
                {other.map((m) => (
                  <div key={m.key}>
                    <p className="font-medium text-gray-700">{m.icon} {m.label}</p>
                    <p className="text-xs text-gray-500">{m.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}