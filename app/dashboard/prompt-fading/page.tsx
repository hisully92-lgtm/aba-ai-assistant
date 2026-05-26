"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type Client = { id: string; full_name: string };
type FadingLog = {
  id: string;
  client_id: string;
  program_name: string;
  target: string;
  current_prompt_level: string;
  previous_prompt_level: string;
  fading_direction: string;
  session_date: string;
  notes: string | null;
  created_at: string;
};

const PROMPT_HIERARCHY = [
  "Full Physical (FP)",
  "Partial Physical (PP)",
  "Model (M)",
  "Gesture (G)",
  "Positional (P)",
  "Vocal (V)",
  "Independent (I)",
];

const PROMPT_LEVELS_SHORT: Record<string, number> = {
  "Full Physical (FP)": 1,
  "Partial Physical (PP)": 2,
  "Model (M)": 3,
  "Gesture (G)": 4,
  "Positional (P)": 5,
  "Vocal (V)": 6,
  "Independent (I)": 7,
};

const FADING_STRATEGIES = [
  { value: "most_to_least", label: "Most-to-Least (MTL)", desc: "Start with most intrusive, fade toward independence" },
  { value: "least_to_most", label: "Least-to-Most (LTM)", desc: "Start with least intrusive, increase if needed" },
  { value: "graduated_guidance", label: "Graduated Guidance", desc: "Fade physical guidance based on response" },
  { value: "time_delay", label: "Time Delay", desc: "Insert delay between SD and prompt" },
];

const emptyForm = {
  client_id: "",
  program_name: "",
  target: "",
  current_prompt_level: "",
  previous_prompt_level: "",
  fading_direction: "fading",
  session_date: new Date().toISOString().split("T")[0],
  notes: "",
};

export default function PromptFadingPage() {
  const [logs, setLogs] = useState<FadingLog[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterClient, setFilterClient] = useState("");
  const [selectedStrategy, setSelectedStrategy] = useState("most_to_least");

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: logData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
      supabase.from("prompt_fading_logs").select("*").eq("created_by", user.id).order("session_date", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setLogs(logData ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.client_id || !form.program_name || !form.current_prompt_level) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const prevLevel = form.previous_prompt_level;
    const currLevel = form.current_prompt_level;
    const prevNum = PROMPT_LEVELS_SHORT[prevLevel] ?? 0;
    const currNum = PROMPT_LEVELS_SHORT[currLevel] ?? 0;
    const direction = currNum > prevNum ? "fading" : currNum < prevNum ? "increasing" : "maintaining";

    const { data } = await supabase.from("prompt_fading_logs").insert([{
      ...form,
      fading_direction: direction,
      notes: form.notes || null,
      created_by: user.id,
    }]).select().single();

    if (data) setLogs((prev) => [data, ...prev]);
    setForm(emptyForm);
    setShowForm(false);
    setSaving(false);
  }

  const filtered = filterClient ? logs.filter((l) => l.client_id === filterClient) : logs;
  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  // Build trend data per program
  function getTrendData(clientId: string, programName: string) {
    return logs
      .filter((l) => l.client_id === clientId && l.program_name === programName)
      .sort((a, b) => a.session_date.localeCompare(b.session_date))
      .slice(-10)
      .map((l) => ({
        date: l.session_date,
        level: PROMPT_LEVELS_SHORT[l.current_prompt_level] ?? 0,
        label: l.current_prompt_level,
      }));
  }

  // Get unique client+program combos
  const programCombos = Array.from(
    new Set(logs.map((l) => `${l.client_id}::${l.program_name}`))
  ).map((key) => {
    const [clientId, programName] = key.split("::");
    return { clientId, programName };
  });

  function directionColor(dir: string) {
    if (dir === "fading") return "bg-green-100 text-green-700";
    if (dir === "increasing") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-600";
  }

  function directionLabel(dir: string) {
    if (dir === "fading") return "↑ Fading (more independent)";
    if (dir === "increasing") return "↓ Increasing prompts";
    return "→ Maintaining";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Prompt Fading">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Log Prompt Level"}
        </Button>
      </PageHeader>

      {/* STRATEGY REFERENCE */}
      <Section title="Prompt Fading Strategies">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FADING_STRATEGIES.map((s) => (
            <button key={s.value} onClick={() => setSelectedStrategy(s.value)}
              className={`text-left border rounded-xl p-3 transition-all ${selectedStrategy === s.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}>
              <p className="text-sm font-semibold text-gray-800">{s.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
            </button>
          ))}
        </div>

        {/* PROMPT HIERARCHY VISUAL */}
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Prompt Hierarchy (Most → Least Intrusive)</p>
          <div className="flex flex-wrap gap-2">
            {PROMPT_HIERARCHY.map((level, i) => (
              <div key={level} className="flex items-center gap-1">
                <span className={`text-xs px-3 py-1.5 rounded-full border font-medium ${i === PROMPT_HIERARCHY.length - 1 ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                  {level}
                </span>
                {i < PROMPT_HIERARCHY.length - 1 && <span className="text-gray-300">→</span>}
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* FORM */}
      {showForm && (
        <Section title="Log Prompt Level">
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
              <input type="text" value={form.program_name} onChange={(e) => setForm({ ...form, program_name: e.target.value })}
                placeholder="e.g. Mand Training" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Target</label>
              <input type="text" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })}
                placeholder="e.g. Colors — Red" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Previous Prompt Level</label>
              <select value={form.previous_prompt_level} onChange={(e) => setForm({ ...form, previous_prompt_level: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select previous...</option>
                {PROMPT_HIERARCHY.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Current Prompt Level *</label>
              <select value={form.current_prompt_level} onChange={(e) => setForm({ ...form, current_prompt_level: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select current...</option>
                {PROMPT_HIERARCHY.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                placeholder="Clinical notes on prompt fading..." className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving} disabled={!form.client_id || !form.program_name || !form.current_prompt_level}>
              Save Log
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* TREND CHARTS */}
      {programCombos.length > 0 && (
        <Section title="Prompt Level Trends">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {programCombos.slice(0, 4).map(({ clientId, programName }) => {
              const trendData = getTrendData(clientId, programName);
              if (trendData.length < 2) return null;
              return (
                <div key={`${clientId}-${programName}`} className="border border-gray-100 rounded-xl p-4 bg-white">
                  <p className="text-sm font-semibold text-gray-800">{programName}</p>
                  <p className="text-xs text-gray-400 mb-3">{clientMap.get(clientId)}</p>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                      <YAxis domain={[1, 7]} ticks={[1, 2, 3, 4, 5, 6, 7]} tick={{ fontSize: 9 }}
                        tickFormatter={(v) => Object.entries(PROMPT_LEVELS_SHORT).find(([, val]) => val === v)?.[0]?.split(" ")[0] ?? v} />
                      <Tooltip formatter={(v, n, props) => [props.payload?.label ?? v, "Prompt Level"]} />
                      <Line type="monotone" dataKey="level" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* FILTER */}
      {!loading && logs.length > 0 && (
        <div className="flex gap-3 items-center">
          <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <p className="text-sm text-gray-400">{filtered.length} logs</p>
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <Section title="Prompt Fading Logs">
          <p className="text-gray-400 text-sm">No prompt fading logs yet.</p>
        </Section>
      )}

      <div className="space-y-2">
        {filtered.map((log) => (
          <div key={log.id} className="border border-gray-100 rounded-xl p-4 bg-white">
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <p className="font-semibold text-gray-800">{log.program_name}{log.target && ` — ${log.target}`}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {clientMap.get(log.client_id) ?? "Unknown"} · {log.session_date}
                </p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {log.previous_prompt_level && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                      Was: {log.previous_prompt_level}
                    </span>
                  )}
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                    Now: {log.current_prompt_level}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${directionColor(log.fading_direction)}`}>
                    {directionLabel(log.fading_direction)}
                  </span>
                </div>
              </div>
            </div>
            {log.notes && <p className="text-xs text-gray-500 mt-2">{log.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}