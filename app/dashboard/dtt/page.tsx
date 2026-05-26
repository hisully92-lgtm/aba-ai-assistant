"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type DTTSession = {
  id: string;
  client_id: string;
  program_name: string;
  target: string;
  trials_correct: number;
  trials_total: number;
  prompt_level: string;
  session_date: string;
  notes: string;
  created_at: string;
};

const PROMPT_LEVELS = ["Full Physical (FP)", "Partial Physical (PP)", "Model (M)", "Gesture (G)", "Positional (P)", "Vocal (V)", "Independent (I)"];
const PROGRAM_NAMES = ["Mand Training", "Tact Training", "Imitation", "Matching", "Receptive ID", "Expressive ID", "LRFFC", "Intraverbal", "Social Skills", "Daily Living Skills", "Gross Motor", "Fine Motor", "Other"];

const emptyForm = {
  client_id: "",
  program_name: "",
  target: "",
  trials_correct: 0,
  trials_total: 10,
  prompt_level: "",
  session_date: new Date().toISOString().split("T")[0],
  notes: "",
};

export default function DTTPage() {
  const [sessions, setSessions] = useState<DTTSession[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Live trial counter
  const [liveMode, setLiveMode] = useState(false);
  const [liveCorrect, setLiveCorrect] = useState(0);
  const [liveTotal, setLiveTotal] = useState(0);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: sessionData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
      supabase.from("dtt_sessions").select("*").eq("created_by", user.id).order("created_at", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setSessions(sessionData ?? []);
    setLoading(false);
  }

  function recordTrial(correct: boolean) {
    setLiveTotal((t) => t + 1);
    if (correct) setLiveCorrect((c) => c + 1);
  }

  async function saveLiveSession() {
    if (!form.client_id || !form.program_name || !form.target) {
      setError("Client, program, and target are required.");
      return;
    }
    setForm((f) => ({ ...f, trials_correct: liveCorrect, trials_total: liveTotal }));
    await handleSave(liveCorrect, liveTotal);
    setLiveMode(false);
    setLiveCorrect(0);
    setLiveTotal(0);
  }

  async function handleSave(correct?: number, total?: number) {
    if (!form.client_id || !form.program_name || !form.target) {
      setError("Client, program, and target are required.");
      return;
    }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error: saveError } = await supabase
      .from("dtt_sessions")
      .insert([{
        ...form,
        trials_correct: correct ?? form.trials_correct,
        trials_total: total ?? form.trials_total,
        created_by: user.id,
      }])
      .select()
      .single();

    if (saveError) { setError(saveError.message); setSaving(false); return; }

    setSessions((prev) => [data, ...prev]);
    setForm(emptyForm);
    setShowForm(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
    setSaving(false);
  }

  const filtered = filterClient ? sessions.filter((s) => s.client_id === filterClient) : sessions;
  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  function accuracy(correct: number, total: number) {
    if (!total) return 0;
    return Math.round((correct / total) * 100);
  }

  function accuracyColor(pct: number) {
    if (pct >= 80) return "bg-green-100 text-green-700";
    if (pct >= 60) return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-700";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Discrete Trial Training (DTT)">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setLiveMode(!liveMode); setLiveCorrect(0); setLiveTotal(0); }}>
            {liveMode ? "Exit Live Mode" : "⚡ Live Trial Mode"}
          </Button>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Log DTT Session"}
          </Button>
        </div>
      </PageHeader>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          ✓ DTT session saved.
        </div>
      )}

      {/* LIVE TRIAL MODE */}
      {liveMode && (
        <Section title="⚡ Live Trial Counter">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
              <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Program *</label>
              <select value={form.program_name} onChange={(e) => setForm({ ...form, program_name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select program...</option>
                {PROGRAM_NAMES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Target *</label>
              <input type="text" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })}
                placeholder="e.g. Colors — Red" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <div className="text-center space-y-4 py-4">
            <div className="text-6xl font-bold text-blue-600">{liveTotal}</div>
            <p className="text-gray-500">Total Trials</p>
            <div className="flex justify-center gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{liveCorrect}</p>
                <p className="text-xs text-gray-500">Correct</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-red-500">{liveTotal - liveCorrect}</p>
                <p className="text-xs text-gray-500">Incorrect</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">{accuracy(liveCorrect, liveTotal)}%</p>
                <p className="text-xs text-gray-500">Accuracy</p>
              </div>
            </div>
            <div className="flex gap-4 justify-center mt-4">
              <button onClick={() => recordTrial(true)}
                className="w-32 h-20 bg-green-500 hover:bg-green-600 text-white text-xl font-bold rounded-2xl shadow-lg transition-transform active:scale-95">
                ✓ Correct
              </button>
              <button onClick={() => recordTrial(false)}
                className="w-32 h-20 bg-red-500 hover:bg-red-600 text-white text-xl font-bold rounded-2xl shadow-lg transition-transform active:scale-95">
                ✗ Error
              </button>
            </div>
            <div className="flex gap-2 justify-center mt-4">
              <Button onClick={saveLiveSession} loading={saving}>Save Session</Button>
              <Button variant="outline" onClick={() => { setLiveCorrect(0); setLiveTotal(0); }}>Reset</Button>
            </div>
          </div>
        </Section>
      )}

      {/* MANUAL FORM */}
      {showForm && (
        <Section title="Log DTT Session">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
              <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Session Date</label>
              <input type="date" value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Program *</label>
              <select value={form.program_name} onChange={(e) => setForm({ ...form, program_name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select program...</option>
                {PROGRAM_NAMES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Target *</label>
              <input type="text" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })}
                placeholder="e.g. Colors — Red" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Trials Correct</label>
              <input type="number" min={0} value={form.trials_correct} onChange={(e) => setForm({ ...form, trials_correct: parseInt(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Total Trials</label>
              <input type="number" min={0} value={form.trials_total} onChange={(e) => setForm({ ...form, trials_total: parseInt(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Prompt Level</label>
              <select value={form.prompt_level} onChange={(e) => setForm({ ...form, prompt_level: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select prompt level...</option>
                {PROMPT_LEVELS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Additional notes..." rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => handleSave()} loading={saving}>Save Session</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setForm(emptyForm); }}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* FILTER */}
      {!loading && sessions.length > 0 && (
        <div className="flex gap-3 items-center">
          <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <p className="text-sm text-gray-400">{filtered.length} sessions</p>
        </div>
      )}

      {/* LIST */}
      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <Section title="DTT Sessions">
          <p className="text-gray-400 text-sm">No DTT sessions yet. Click "+ Log DTT Session" or use Live Trial Mode.</p>
        </Section>
      )}

      <div className="space-y-3">
        {filtered.map((s) => {
          const pct = accuracy(s.trials_correct, s.trials_total);
          return (
            <div key={s.id} className="border border-gray-100 rounded-xl p-4 bg-white">
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <p className="font-semibold text-gray-800">{s.program_name} — {s.target}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {clientMap.get(s.client_id) ?? "Unknown"} · {s.session_date}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${accuracyColor(pct)}`}>
                    {pct}% ({s.trials_correct}/{s.trials_total})
                  </span>
                  {s.prompt_level && (
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                      {s.prompt_level}
                    </span>
                  )}
                </div>
              </div>
              {/* PROGRESS BAR */}
              <div className="mt-3">
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all ${pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${pct}%` }} />
                </div>
              </div>
              {s.notes && <p className="text-xs text-gray-500 mt-2">{s.notes}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}