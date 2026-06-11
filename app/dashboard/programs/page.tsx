"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

type Client = { id: string; full_name: string };
type Program = {
  id: string;
  client_id: string;
  staff_member: string;
  program_name: string;
  goal: string;
  targets: string;
  prompt_level: string;
  mastery_criteria: string;
  trial_data: string;
  notes: string;
  created_at: string;
};

const PROGRAM_NAMES = [
  "Mand Training", "Tact Training", "Imitation", "Matching", "Receptive ID",
  "Expressive ID", "LRFFC", "Intraverbal", "Social Skills", "Daily Living Skills",
  "Gross Motor", "Fine Motor", "Academic Skills", "Toilet Training", "Other"
];

const PROMPT_LEVELS = [
  "Full Physical (FP)", "Partial Physical (PP)", "Model (M)",
  "Gesture (G)", "Positional (P)", "Vocal (V)", "Independent (I)"
];

const PROMPT_ORDER: Record<string, number> = {
  "Full Physical (FP)": 1,
  "Partial Physical (PP)": 2,
  "Model (M)": 3,
  "Gesture (G)": 4,
  "Positional (P)": 5,
  "Vocal (V)": 6,
  "Independent (I)": 7,
};

const MASTERY_CRITERIA = [
  "80% over 3 consecutive sessions",
  "90% over 3 consecutive sessions",
  "80% over 2 consecutive sessions",
  "90% over 2 consecutive sessions",
  "100% over 3 consecutive sessions",
  "Custom"
];

const TARGETS_OPTIONS = [
  "Colors", "Shapes", "Numbers", "Letters", "Animals", "Body parts",
  "Common objects", "Actions", "Emotions", "Community helpers",
  "Food items", "Clothing", "Furniture", "Transportation", "Custom"
];

const emptyForm = {
  client_id: "",
  staff_member: "",
  program_name: "",
  goal: "",
  targets: [] as string[],
  prompt_level: "",
  mastery_criteria: "",
  trial_data: "",
  notes: "",
};

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState("");
  const [filterProgram, setFilterProgram] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [chartClientId, setChartClientId] = useState("");
  const [chartProgram, setChartProgram] = useState("");

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: programData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").order("full_name"),
      supabase.from("programs").select("*").order("created_at", { ascending: true }),
    ]);

    setClients(clientData ?? []);
    setPrograms(programData ?? []);
    setLoading(false);
  }

  function toggleTarget(target: string) {
    setForm((prev) => ({
      ...prev,
      targets: prev.targets.includes(target)
        ? prev.targets.filter((t) => t !== target)
        : [...prev.targets, target],
    }));
  }

  async function handleSave() {
    if (!form.client_id || !form.program_name) {
      setError("Client and program name are required.");
      return;
    }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error } = await supabase
      .from("programs")
      .insert([{
        ...form,
        targets: form.targets.join(", "),
        created_by: user.id,
      }])
      .select()
      .single();

    if (error) { setError(error.message); setSaving(false); return; }

    setPrograms((prev) => [...prev, data].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ));
    setForm(emptyForm);
    setSuccess(true);
    setShowForm(false);
    setTimeout(() => setSuccess(false), 3000);
    setSaving(false);
  }

  // PARSE TRIAL DATA — accepts "8/10", "80%", "80", "8 out of 10"
  function parseTrialData(raw: string): number | null {
    if (!raw) return null;
    const fracMatch = raw.match(/(\d+)\s*\/\s*(\d+)/);
    if (fracMatch) return Math.round((parseInt(fracMatch[1]) / parseInt(fracMatch[2])) * 100);
    const pctMatch = raw.match(/(\d+\.?\d*)\s*%/);
    if (pctMatch) return parseFloat(pctMatch[1]);
    const numMatch = raw.match(/^(\d+\.?\d*)$/);
    if (numMatch) return parseFloat(numMatch[1]);
    return null;
  }

  // CHART DATA — trial % over time for selected client + program
  const chartData = programs
    .filter((p) => {
      if (chartClientId && p.client_id !== chartClientId) return false;
      if (chartProgram && p.program_name !== chartProgram) return false;
      return parseTrialData(p.trial_data) !== null;
    })
    .map((p, i) => ({
      session: `S${i + 1}`,
      date: new Date(p.created_at).toLocaleDateString(),
      percent: parseTrialData(p.trial_data),
      prompt: PROMPT_ORDER[p.prompt_level] ?? 0,
      promptLabel: p.prompt_level,
    }));

  // MASTERY LINE — extract % from mastery criteria
  function getMasteryLine(): number {
    if (!chartProgram) return 80;
    const prog = programs.find((p) => p.program_name === chartProgram);
    if (!prog?.mastery_criteria) return 80;
    const match = prog.mastery_criteria.match(/(\d+)%/);
    return match ? parseInt(match[1]) : 80;
  }

  let filtered = programs;
  if (filterClient) filtered = filtered.filter((p) => p.client_id === filterClient);
  if (filterProgram) filtered = filtered.filter((p) => p.program_name === filterProgram);
  if (dateFrom) filtered = filtered.filter((p) => new Date(p.created_at) >= new Date(dateFrom));
  if (dateTo) filtered = filtered.filter((p) => new Date(p.created_at) <= new Date(dateTo + "T23:59:59"));

  // Sort filtered descending for display
  const filteredDesc = [...filtered].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const filtersActive = filterClient || filterProgram || dateFrom || dateTo;
  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  // Available program names for chart selector
  const programNames = [...new Set(programs.map((p) => p.program_name))];

  function promptColor(level: string) {
    if (level.includes("Full Physical")) return "bg-red-100 text-red-700";
    if (level.includes("Partial Physical")) return "bg-orange-100 text-orange-700";
    if (level.includes("Model")) return "bg-yellow-100 text-yellow-700";
    if (level.includes("Gesture")) return "bg-blue-100 text-blue-700";
    if (level.includes("Vocal")) return "bg-purple-100 text-purple-700";
    if (level.includes("Independent")) return "bg-green-100 text-green-700";
    return "bg-gray-100 text-gray-600";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Skill Programs">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add Program"}
        </Button>
      </PageHeader>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          ✓ Program saved successfully.
        </div>
      )}

      {/* FORM */}
      {showForm && (
        <Section title="New Skill Program">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
              <select
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Staff Member</label>
              <input
                type="text"
                value={form.staff_member}
                onChange={(e) => setForm({ ...form, staff_member: e.target.value })}
                placeholder="Your name"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Program Name *</label>
              <select
                value={form.program_name}
                onChange={(e) => setForm({ ...form, program_name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Select program...</option>
                {PROGRAM_NAMES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Prompt Level</label>
              <select
                value={form.prompt_level}
                onChange={(e) => setForm({ ...form, prompt_level: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Select prompt level...</option>
                {PROMPT_LEVELS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Mastery Criteria</label>
              <select
                value={form.mastery_criteria}
                onChange={(e) => setForm({ ...form, mastery_criteria: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Select criteria...</option>
                {MASTERY_CRITERIA.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Goal</label>
              <textarea
                value={form.goal}
                onChange={(e) => setForm({ ...form, goal: e.target.value })}
                placeholder="Describe the program goal..."
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Targets {form.targets.length > 0 && `(${form.targets.length} selected)`}
              </label>
              <div className="flex flex-wrap gap-2">
                {TARGETS_OPTIONS.map((target) => (
                  <button
                    key={target}
                    type="button"
                    onClick={() => toggleTarget(target)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      form.targets.includes(target)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-blue-300"
                    }`}
                  >
                    {target}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Trial Data</label>
              <input
                type="text"
                value={form.trial_data}
                onChange={(e) => setForm({ ...form, trial_data: e.target.value })}
                placeholder="e.g. 8/10 or 80%"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>Save Program</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setForm(emptyForm); }}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* PROGRESS CHART */}
      {programs.length > 0 && (
        <Section title="Progress Chart">
          <div className="flex flex-wrap gap-3 mb-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Client</label>
              <select
                value={chartClientId}
                onChange={(e) => setChartClientId(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">All Clients</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Program</label>
              <select
                value={chartProgram}
                onChange={(e) => setChartProgram(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">All Programs</option>
                {programNames.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {chartData.length < 2 ? (
            <p className="text-gray-400 text-sm">
              {chartData.length === 0
                ? "No trial data with percentages found. Add sessions with trial data like '8/10' or '80%' to see a chart."
                : "Need at least 2 data points to show a chart."}
            </p>
          ) : (
            <div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="session"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    formatter={(value) => [`${value}%`, "Accuracy"]}
                    labelFormatter={(label, payload) => {
                      const item = payload?.[0]?.payload;
                      return item ? `${label} — ${item.date}${item.promptLabel ? ` — ${item.promptLabel}` : ""}` : label;
                    }}
                  />
                  <ReferenceLine
                    y={getMasteryLine()}
                    stroke="#16a34a"
                    strokeDasharray="4 4"
                    label={{ value: `Mastery ${getMasteryLine()}%`, position: "insideTopRight", fontSize: 10, fill: "#16a34a" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="percent"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#2563eb" }}
                    activeDot={{ r: 6 }}
                    name="Accuracy"
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-400 mt-2 text-center">
                Green dashed line = mastery criterion · Blue line = session accuracy
              </p>
            </div>
          )}
        </Section>
      )}

      {/* FILTERS */}
      {!loading && programs.length > 0 && (
        <Section title="Filters">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
              <label className="text-xs text-gray-500 mb-1 block">Program</label>
              <select
                value={filterProgram}
                onChange={(e) => setFilterProgram(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">All Programs</option>
                {PROGRAM_NAMES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2">
            {filtersActive && (
              <button
                onClick={() => { setFilterClient(""); setFilterProgram(""); setDateFrom(""); setDateTo(""); }}
                className="text-sm text-gray-400 hover:text-gray-600 underline"
              >
                Clear filters
              </button>
            )}
            <p className="text-sm text-gray-400">{filteredDesc.length} programs</p>
          </div>
        </Section>
      )}

      {/* LIST */}
      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filteredDesc.length === 0 && (
        <Section title="Programs">
          <p className="text-gray-400 text-sm">No programs yet. Click "+ Add Program" to start.</p>
        </Section>
      )}

      <div className="space-y-3">
        {filteredDesc.map((p) => {
          const trialPct = parseTrialData(p.trial_data);
          const masteryPct = p.mastery_criteria.match(/(\d+)%/)?.[1];
          const isMastered = trialPct !== null && masteryPct && trialPct >= parseInt(masteryPct);

          return (
            <div key={p.id} className={`border rounded-xl p-4 bg-white ${isMastered ? "border-green-200" : "border-gray-100"}`}>
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-800">{p.program_name}</p>
                    {isMastered && (
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                        ✓ Mastered
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {clientMap.get(p.client_id) ?? "Unknown"} · {p.staff_member} · {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {p.prompt_level && (
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${promptColor(p.prompt_level)}`}>
                      {p.prompt_level}
                    </span>
                  )}
                  {trialPct !== null && (
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      trialPct >= 90 ? "bg-green-100 text-green-700"
                      : trialPct >= 70 ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                    }`}>
                      {trialPct}%
                    </span>
                  )}
                </div>
              </div>

              {/* PROGRESS BAR */}
              {trialPct !== null && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Progress</span>
                    <span>{trialPct}%{masteryPct && ` / ${masteryPct}% mastery`}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        isMastered ? "bg-green-500" : trialPct >= 70 ? "bg-yellow-500" : "bg-blue-500"
                      }`}
                      style={{ width: `${Math.min(100, trialPct)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-sm text-gray-600">
                {p.goal && <p className="md:col-span-2"><span className="font-medium">Goal:</span> {p.goal}</p>}
                {p.targets && (
                  <div className="md:col-span-2">
                    <span className="font-medium text-sm">Targets: </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {p.targets.split(", ").map((t) => (
                        <span key={t} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {p.mastery_criteria && <p><span className="font-medium">Mastery:</span> {p.mastery_criteria}</p>}
                {p.trial_data && <p><span className="font-medium">Trial Data:</span> {p.trial_data}</p>}
                {p.notes && <p className="md:col-span-2"><span className="font-medium">Notes:</span> {p.notes}</p>}
              </div>

              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.location.href = `/dashboard/clients/${p.client_id}/case`}
                >
                  View Case
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setChartClientId(p.client_id);
                    setChartProgram(p.program_name);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  View Chart
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}