"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend, ScatterChart, Scatter, ZAxis,
} from "recharts";

type Client = { id: string; full_name: string; diagnosis: string | null };
type Phase = {
  id: string;
  phase_name: string;
  phase_color: string;
  start_date: string;
  end_date: string | null;
  notes: string | null;
};
type GoalLine = {
  id: string;
  target_name: string;
  goal_value: number;
  goal_type: string;
  color: string;
};

const GRAPH_TYPES = [
  { key: "line", label: "Line Graph", icon: "📈", desc: "Track progress across sessions — industry standard" },
  { key: "bar", label: "Bar Graph", icon: "📊", desc: "Compare frequencies across settings or therapists" },
  { key: "cumulative", label: "Cumulative Record", icon: "📉", desc: "Show total growth over time" },
  { key: "scatterplot", label: "Scatterplot", icon: "🔵", desc: "Visualize behavior patterns by time of day" },
  { key: "phase", label: "Phase Change Graph", icon: "📋", desc: "Baseline, intervention, and maintenance phases" },
  { key: "multi", label: "Multi-Behavior", icon: "🔀", desc: "Compare multiple behaviors on one graph" },
];

const PHASE_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#f97316", "#8b5cf6", "#ec4899"];
const PHASE_NAMES = ["Baseline", "Intervention", "Maintenance", "Generalization", "Follow-Up", "Probe"];

export default function GraphsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedGraphType, setSelectedGraphType] = useState("line");
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  // Data
  const [behaviorData, setBehaviorData] = useState<any[]>([]);
  const [programData, setProgramData] = useState<any[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [goals, setGoals] = useState<GoalLine[]>([]);
  const [behaviorNames, setBehaviorNames] = useState<string[]>([]);
  const [programNames, setProgramNames] = useState<string[]>([]);
  const [selectedBehavior, setSelectedBehavior] = useState("all");
  const [selectedProgram, setSelectedProgram] = useState("all");
  const [dataSource, setDataSource] = useState<"behavior" | "program">("behavior");
  const [dateRange, setDateRange] = useState("3m");

  // Phase editor
  const [showPhaseEditor, setShowPhaseEditor] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState("Baseline");
  const [newPhaseColor, setNewPhaseColor] = useState("#2563eb");
  const [newPhaseStart, setNewPhaseStart] = useState(new Date().toISOString().split("T")[0]);
  const [newPhaseEnd, setNewPhaseEnd] = useState("");
  const [newPhaseNotes, setNewPhaseNotes] = useState("");

  // Goal editor
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalValue, setNewGoalValue] = useState(80);
  const [newGoalColor, setNewGoalColor] = useState("#16a34a");
  const [newGoalType, setNewGoalType] = useState("minimum");

  const [savingPhase, setSavingPhase] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);

  useEffect(() => { init(); }, []);
  useEffect(() => { if (selectedClientId) loadClientData(); }, [selectedClientId, dateRange, dataSource]);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const { data } = await supabase.from("clients").select("id, full_name, diagnosis").eq("created_by", user.id);
    setClients(data ?? []);
    setLoading(false);
  }

  async function loadClientData() {
    setDataLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const monthsBack = dateRange === "1m" ? 1 : dateRange === "3m" ? 3 : dateRange === "6m" ? 6 : 12;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);
    const startStr = startDate.toISOString().split("T")[0];

    const [
      { data: bData },
      { data: pData },
      { data: phaseData },
      { data: goalData },
    ] = await Promise.all([
      supabase.from("behaviors").select("behavior_name, frequency, duration_minutes, created_at").eq("client_id", selectedClientId).gte("created_at", startStr).order("created_at"),
      supabase.from("programs").select("program_name, trial_data, mastery_criteria, created_at").eq("client_id", selectedClientId).gte("created_at", startStr).order("created_at"),
      supabase.from("graph_phases").select("*").eq("client_id", selectedClientId).eq("created_by", user.id).order("start_date"),
      supabase.from("graph_goals").select("*").eq("client_id", selectedClientId).eq("created_by", user.id),
    ]);

    // Process behavior data
    const bNames = Array.from(new Set((bData ?? []).map((b: any) => b.behavior_name)));
    setBehaviorNames(bNames);

    const bProcessed = (bData ?? []).map((b: any) => ({
      date: b.created_at.slice(0, 10),
      behavior: b.behavior_name,
      frequency: b.frequency ?? 1,
      duration: b.duration_minutes ?? 0,
      hour: new Date(b.created_at).getHours(),
      day: new Date(b.created_at).getDay(),
    }));
    setBehaviorData(bProcessed);

    // Process program data
    const pNames = Array.from(new Set((pData ?? []).map((p: any) => p.program_name)));
    setProgramNames(pNames);

    const pProcessed = (pData ?? []).map((p: any) => {
      const match = p.trial_data?.match(/(\d+\.?\d*)/);
      const pct = match ? parseFloat(match[1]) : 0;
      return { date: p.created_at.slice(0, 10), program: p.program_name, accuracy: pct };
    });
    setProgramData(pProcessed);

    setPhases(phaseData ?? []);
    setGoals(goalData ?? []);
    setDataLoading(false);
  }

  async function addPhase() {
    if (!newPhaseName || !newPhaseStart || !selectedClientId) return;
    setSavingPhase(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("graph_phases").insert([{
      client_id: selectedClientId,
      phase_name: newPhaseName,
      phase_color: newPhaseColor,
      start_date: newPhaseStart,
      end_date: newPhaseEnd || null,
      notes: newPhaseNotes || null,
      created_by: user.id,
    }]).select().single();

    if (data) setPhases((prev) => [...prev, data].sort((a, b) => a.start_date.localeCompare(b.start_date)));
    setNewPhaseName("Baseline"); setNewPhaseStart(new Date().toISOString().split("T")[0]); setNewPhaseEnd(""); setNewPhaseNotes("");
    setShowPhaseEditor(false);
    setSavingPhase(false);
  }

  async function addGoal() {
    if (!newGoalName || !selectedClientId) return;
    setSavingGoal(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("graph_goals").insert([{
      client_id: selectedClientId,
      target_name: newGoalName,
      goal_value: newGoalValue,
      goal_type: newGoalType,
      color: newGoalColor,
      created_by: user.id,
    }]).select().single();

    if (data) setGoals((prev) => [...prev, data]);
    setNewGoalName(""); setNewGoalValue(80);
    setShowGoalEditor(false);
    setSavingGoal(false);
  }

  async function deletePhase(id: string) {
    await supabase.from("graph_phases").delete().eq("id", id);
    setPhases((prev) => prev.filter((p) => p.id !== id));
  }

  async function deleteGoal(id: string) {
    await supabase.from("graph_goals").delete().eq("id", id);
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }

  // Build chart data
  function buildLineData() {
    if (dataSource === "behavior") {
      const filtered = selectedBehavior === "all" ? behaviorData : behaviorData.filter((b) => b.behavior === selectedBehavior);
      const byDate = new Map<string, number>();
      filtered.forEach((b) => byDate.set(b.date, (byDate.get(b.date) ?? 0) + b.frequency));
      return Array.from(byDate.entries()).map(([date, value]) => ({ date, value }));
    } else {
      const filtered = selectedProgram === "all" ? programData : programData.filter((p) => p.program === selectedProgram);
      const byDate = new Map<string, number[]>();
      filtered.forEach((p) => {
        const arr = byDate.get(p.date) ?? [];
        arr.push(p.accuracy);
        byDate.set(p.date, arr);
      });
      return Array.from(byDate.entries()).map(([date, values]) => ({
        date,
        value: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      }));
    }
  }

  function buildBarData() {
    if (dataSource === "behavior") {
      const byBehavior = new Map<string, number>();
      behaviorData.forEach((b) => byBehavior.set(b.behavior, (byBehavior.get(b.behavior) ?? 0) + b.frequency));
      return Array.from(byBehavior.entries()).map(([name, count]) => ({ name, count }));
    } else {
      const byProgram = new Map<string, number[]>();
      programData.forEach((p) => {
        const arr = byProgram.get(p.program) ?? [];
        arr.push(p.accuracy);
        byProgram.set(p.program, arr);
      });
      return Array.from(byProgram.entries()).map(([name, values]) => ({
        name: name.length > 15 ? name.slice(0, 15) + "..." : name,
        accuracy: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      }));
    }
  }

  function buildCumulativeData() {
    const lineData = buildLineData();
    let cumulative = 0;
    return lineData.map((d) => {
      cumulative += d.value;
      return { ...d, cumulative };
    });
  }

  function buildScatterData() {
    const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const filtered = selectedBehavior === "all" ? behaviorData : behaviorData.filter((b) => b.behavior === selectedBehavior);
    return filtered.map((b) => ({
      x: b.hour,
      y: b.day,
      z: b.frequency,
      day: DAYS[b.day],
      hour: `${b.hour}:00`,
    }));
  }

  function buildMultiBehaviorData() {
    const allDates = Array.from(new Set(behaviorData.map((b) => b.date))).sort();
    return allDates.map((date) => {
      const entry: any = { date };
      behaviorNames.forEach((name) => {
        const dayData = behaviorData.filter((b) => b.date === date && b.behavior === name);
        entry[name] = dayData.reduce((a, b) => a + b.frequency, 0);
      });
      return entry;
    });
  }

  const lineData = buildLineData();
  const barData = buildBarData();
  const cumulativeData = buildCumulativeData();
  const scatterData = buildScatterData();
  const multiData = buildMultiBehaviorData();

  const BEHAVIOR_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#f97316", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b"];

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  function exportCSV() {
    const data = dataSource === "behavior" ? behaviorData : programData;
    const headers = Object.keys(data[0] ?? {}).join(",");
    const rows = data.map((d) => Object.values(d).join(",")).join("\n");
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aba-graph-data-${selectedClient?.full_name?.replace(/\s/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="ABA Visual Analytics">
        <p className="text-gray-500 text-sm">Clinical graphs with phase lines, trendlines, and CSV export.</p>
      </PageHeader>

      {/* CONTROLS */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={selectedClientId} onChange={(e) => { setSelectedClientId(e.target.value); }}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">Select client...</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>

        <div className="flex gap-1 border border-gray-200 rounded-lg p-1">
          {["behavior", "program"].map((s) => (
            <button key={s} onClick={() => setDataSource(s as any)}
              className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${dataSource === s ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700"}`}>
              {s === "behavior" ? "Behaviors" : "Programs"}
            </button>
          ))}
        </div>

        <div className="flex gap-1 border border-gray-200 rounded-lg p-1">
          {["1m", "3m", "6m", "12m"].map((r) => (
            <button key={r} onClick={() => setDateRange(r)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${dateRange === r ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700"}`}>
              {r}
            </button>
          ))}
        </div>

        {dataSource === "behavior" && behaviorNames.length > 0 && (
          <select value={selectedBehavior} onChange={(e) => setSelectedBehavior(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="all">All Behaviors</option>
            {behaviorNames.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        )}

        {dataSource === "program" && programNames.length > 0 && (
          <select value={selectedProgram} onChange={(e) => setSelectedProgram(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="all">All Programs</option>
            {programNames.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}

        {selectedClientId && (
          <Button variant="outline" onClick={exportCSV}>📥 Export CSV</Button>
        )}
      </div>

      {!selectedClientId && (
        <Section title="Select a Client">
          <p className="text-gray-400 text-sm">Choose a client above to view their clinical graphs.</p>
        </Section>
      )}

      {selectedClientId && dataLoading && (
        <div className="flex items-center gap-3 py-8">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading graph data...</p>
        </div>
      )}

      {selectedClientId && !dataLoading && (
        <>
          {/* GRAPH TYPE SELECTOR */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            {GRAPH_TYPES.map((g) => (
              <button key={g.key} onClick={() => setSelectedGraphType(g.key)}
                className={`border-2 rounded-xl p-3 text-left transition-all ${selectedGraphType === g.key ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300 bg-white"}`}>
                <p className="text-xl mb-1">{g.icon}</p>
                <p className="text-xs font-bold text-gray-800">{g.label}</p>
              </button>
            ))}
          </div>

          {/* PHASE + GOAL CONTROLS */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowPhaseEditor(!showPhaseEditor)}>
              {showPhaseEditor ? "Cancel" : "+ Add Phase Line"}
            </Button>
            <Button variant="outline" onClick={() => setShowGoalEditor(!showGoalEditor)}>
              {showGoalEditor ? "Cancel" : "+ Add Goal Line"}
            </Button>
          </div>

          {/* PHASE EDITOR */}
          {showPhaseEditor && (
            <Section title="Add Phase Line">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Phase Name</label>
                  <select value={newPhaseName} onChange={(e) => setNewPhaseName(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    {PHASE_NAMES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Start Date</label>
                  <input type="date" value={newPhaseStart} onChange={(e) => setNewPhaseStart(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">End Date (optional)</label>
                  <input type="date" value={newPhaseEnd} onChange={(e) => setNewPhaseEnd(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Color</label>
                  <div className="flex gap-2">
                    {PHASE_COLORS.map((c) => (
                      <button key={c} onClick={() => setNewPhaseColor(c)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${newPhaseColor === c ? "border-gray-800 scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
                  <input type="text" value={newPhaseNotes} onChange={(e) => setNewPhaseNotes(e.target.value)}
                    placeholder="Optional notes..." className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={addPhase} loading={savingPhase}>Add Phase</Button>
                <Button variant="outline" onClick={() => setShowPhaseEditor(false)}>Cancel</Button>
              </div>
            </Section>
          )}

          {/* GOAL EDITOR */}
          {showGoalEditor && (
            <Section title="Add Goal Line">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Goal Name</label>
                  <input type="text" value={newGoalName} onChange={(e) => setNewGoalName(e.target.value)}
                    placeholder="e.g. Mastery Criterion"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Goal Value</label>
                  <input type="number" value={newGoalValue} onChange={(e) => setNewGoalValue(parseFloat(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Type</label>
                  <select value={newGoalType} onChange={(e) => setNewGoalType(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="minimum">Minimum (must reach)</option>
                    <option value="maximum">Maximum (must stay below)</option>
                    <option value="target">Target</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Color</label>
                  <div className="flex gap-2">
                    {["#16a34a", "#dc2626", "#2563eb", "#f97316", "#8b5cf6"].map((c) => (
                      <button key={c} onClick={() => setNewGoalColor(c)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${newGoalColor === c ? "border-gray-800 scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={addGoal} loading={savingGoal}>Add Goal Line</Button>
                <Button variant="outline" onClick={() => setShowGoalEditor(false)}>Cancel</Button>
              </div>
            </Section>
          )}

          {/* ACTIVE PHASES + GOALS */}
          {(phases.length > 0 || goals.length > 0) && (
            <div className="flex flex-wrap gap-2 items-center">
              {phases.map((p) => (
                <div key={p.id} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium"
                  style={{ borderColor: p.phase_color, color: p.phase_color, backgroundColor: p.phase_color + "15" }}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.phase_color }} />
                  {p.phase_name} ({p.start_date})
                  <button onClick={() => deletePhase(p.id)} className="ml-1 opacity-60 hover:opacity-100">✕</button>
                </div>
              ))}
              {goals.map((g) => (
                <div key={g.id} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium"
                  style={{ borderColor: g.color, color: g.color, backgroundColor: g.color + "15" }}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                  {g.target_name}: {g.goal_value}
                  <button onClick={() => deleteGoal(g.id)} className="ml-1 opacity-60 hover:opacity-100">✕</button>
                </div>
              ))}
            </div>
          )}

          {/* NO DATA STATE */}
          {lineData.length === 0 && (
            <Section title="No Data">
              <p className="text-gray-400 text-sm">
                No {dataSource === "behavior" ? "behavior" : "program"} data found for this client in the selected time range.
                Log some {dataSource === "behavior" ? "behaviors" : "programs"} to see graphs.
              </p>
            </Section>
          )}

          {/* LINE GRAPH */}
          {selectedGraphType === "line" && lineData.length > 0 && (
            <Section title={`Line Graph — ${selectedClient?.full_name} — ${dataSource === "behavior" ? selectedBehavior === "all" ? "All Behaviors" : selectedBehavior : selectedProgram === "all" ? "All Programs" : selectedProgram}`}>
              <p className="text-xs text-gray-400 mb-4">Sessions on X-axis · {dataSource === "behavior" ? "Frequency" : "Accuracy %"} on Y-axis · Industry standard for ABA progress tracking</p>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={lineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  {/* PHASE LINES */}
                  {phases.map((phase) => (
                    <ReferenceLine key={phase.id} x={phase.start_date}
                      stroke={phase.phase_color} strokeWidth={2} strokeDasharray="5 5"
                      label={{ value: phase.phase_name, position: "top", fontSize: 10, fill: phase.phase_color }} />
                  ))}
                  {/* GOAL LINES */}
                  {goals.map((goal) => (
                    <ReferenceLine key={goal.id} y={goal.goal_value}
                      stroke={goal.color} strokeWidth={2} strokeDasharray="8 4"
                      label={{ value: `${goal.target_name}: ${goal.goal_value}`, position: "right", fontSize: 10, fill: goal.color }} />
                  ))}
                  <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2.5}
                    dot={{ r: 4, fill: "#2563eb" }} activeDot={{ r: 6 }}
                    name={dataSource === "behavior" ? "Frequency" : "Accuracy %"} />
                </LineChart>
              </ResponsiveContainer>
            </Section>
          )}

          {/* BAR GRAPH */}
          {selectedGraphType === "bar" && barData.length > 0 && (
            <Section title={`Bar Graph — ${selectedClient?.full_name}`}>
              <p className="text-xs text-gray-400 mb-4">Compare {dataSource === "behavior" ? "behavior frequencies" : "program accuracy"} side by side</p>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={barData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  {goals.map((goal) => (
                    <ReferenceLine key={goal.id} y={goal.goal_value}
                      stroke={goal.color} strokeWidth={2} strokeDasharray="8 4"
                      label={{ value: goal.target_name, position: "right", fontSize: 10, fill: goal.color }} />
                  ))}
                  <Bar dataKey={dataSource === "behavior" ? "count" : "accuracy"}
                    fill="#2563eb" radius={[4, 4, 0, 0]}
                    name={dataSource === "behavior" ? "Frequency" : "Accuracy %"} />
                </BarChart>
              </ResponsiveContainer>
            </Section>
          )}

          {/* CUMULATIVE RECORD */}
          {selectedGraphType === "cumulative" && cumulativeData.length > 0 && (
            <Section title={`Cumulative Record — ${selectedClient?.full_name}`}>
              <p className="text-xs text-gray-400 mb-4">Always slopes upward — steeper incline = faster rate of learning/change</p>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={cumulativeData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  {phases.map((phase) => (
                    <ReferenceLine key={phase.id} x={phase.start_date}
                      stroke={phase.phase_color} strokeWidth={2} strokeDasharray="5 5"
                      label={{ value: phase.phase_name, position: "top", fontSize: 10, fill: phase.phase_color }} />
                  ))}
                  <Area type="monotone" dataKey="cumulative" stroke="#8b5cf6" fill="#ede9fe"
                    strokeWidth={2.5} name="Cumulative Total" />
                  <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={1.5}
                    strokeDasharray="4 4" dot={false} name="Per Session" />
                </AreaChart>
              </ResponsiveContainer>
            </Section>
          )}

          {/* SCATTERPLOT */}
          {selectedGraphType === "scatterplot" && scatterData.length > 0 && (
            <Section title={`Behavior Scatterplot — ${selectedClient?.full_name}`}>
              <p className="text-xs text-gray-400 mb-4">Visualize when behaviors cluster by hour of day and day of week</p>
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="x" name="Hour" type="number" domain={[0, 23]}
                    tickFormatter={(v) => `${v}:00`} tick={{ fontSize: 10 }}
                    label={{ value: "Hour of Day", position: "insideBottom", offset: -5, fontSize: 11 }} />
                  <YAxis dataKey="y" name="Day" type="number" domain={[0, 6]}
                    tickFormatter={(v) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][v] ?? v}
                    tick={{ fontSize: 10 }} />
                  <ZAxis dataKey="z" range={[30, 200]} name="Frequency" />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }}
                    content={({ payload }) => {
                      if (!payload?.length) return null;
                      const d = payload[0]?.payload;
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg p-2 text-xs shadow">
                          <p className="font-medium">{d?.day} at {d?.hour}</p>
                          <p>Frequency: {d?.z}</p>
                        </div>
                      );
                    }} />
                  <Scatter data={scatterData} fill="#dc2626" fillOpacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-400 mt-2">Circle size = frequency · Larger = more occurrences at that time</p>
            </Section>
          )}

          {/* PHASE CHANGE GRAPH */}
          {selectedGraphType === "phase" && lineData.length > 0 && (
            <Section title={`Phase Change Graph — ${selectedClient?.full_name}`}>
              <p className="text-xs text-gray-400 mb-4">Baseline → Intervention → Maintenance phases with condition change lines</p>
              {phases.length === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700 mb-4">
                  ⚠️ No phase lines added yet. Click "+ Add Phase Line" above to mark Baseline, Intervention, and Maintenance phases.
                </div>
              )}
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={lineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  {phases.map((phase) => (
                    <ReferenceLine key={phase.id} x={phase.start_date}
                      stroke={phase.phase_color} strokeWidth={3}
                      label={{ value: phase.phase_name, position: "top", fontSize: 11, fontWeight: "bold", fill: phase.phase_color }} />
                  ))}
                  {goals.map((goal) => (
                    <ReferenceLine key={goal.id} y={goal.goal_value}
                      stroke={goal.color} strokeWidth={2} strokeDasharray="8 4"
                      label={{ value: `${goal.target_name}: ${goal.goal_value}`, position: "right", fontSize: 10, fill: goal.color }} />
                  ))}
                  <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2.5}
                    dot={{ r: 4, fill: "#2563eb" }} activeDot={{ r: 6 }} name="Value" />
                </LineChart>
              </ResponsiveContainer>
            </Section>
          )}

          {/* MULTI-BEHAVIOR */}
          {selectedGraphType === "multi" && multiData.length > 0 && behaviorNames.length > 0 && (
            <Section title={`Multi-Behavior Graph — ${selectedClient?.full_name}`}>
              <p className="text-xs text-gray-400 mb-4">Compare multiple behaviors simultaneously on one graph</p>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={multiData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  {phases.map((phase) => (
                    <ReferenceLine key={phase.id} x={phase.start_date}
                      stroke={phase.phase_color} strokeWidth={2} strokeDasharray="5 5"
                      label={{ value: phase.phase_name, position: "top", fontSize: 10, fill: phase.phase_color }} />
                  ))}
                  {behaviorNames.slice(0, 6).map((name, i) => (
                    <Line key={name} type="monotone" dataKey={name}
                      stroke={BEHAVIOR_COLORS[i]} strokeWidth={2}
                      dot={{ r: 3 }} activeDot={{ r: 5 }} name={name} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Section>
          )}

          {/* TRENDLINE ANALYSIS */}
          {lineData.length >= 3 && (
            <Section title="Trendline Analysis">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(() => {
                  const values = lineData.map((d) => d.value);
                  const avg = values.reduce((a, b) => a + b, 0) / values.length;
                  const first3 = values.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
                  const last3 = values.slice(-3).reduce((a, b) => a + b, 0) / 3;
                  const trend = last3 - first3;
                  const max = Math.max(...values);
                  const min = Math.min(...values);
                  return (
                    <>
                      <div className="border rounded-lg p-3 text-center bg-white">
                        <p className="text-xl font-bold text-blue-600">{avg.toFixed(1)}</p>
                        <p className="text-xs text-gray-500">Average</p>
                      </div>
                      <div className="border rounded-lg p-3 text-center bg-white">
                        <p className={`text-xl font-bold ${trend > 0 ? dataSource === "behavior" ? "text-red-500" : "text-green-600" : dataSource === "behavior" ? "text-green-600" : "text-red-500"}`}>
                          {trend > 0 ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}
                        </p>
                        <p className="text-xs text-gray-500">Trend (first vs last 3)</p>
                      </div>
                      <div className="border rounded-lg p-3 text-center bg-white">
                        <p className="text-xl font-bold text-gray-700">{max}</p>
                        <p className="text-xs text-gray-500">Peak</p>
                      </div>
                      <div className="border rounded-lg p-3 text-center bg-white">
                        <p className="text-xl font-bold text-gray-700">{min}</p>
                        <p className="text-xs text-gray-500">Lowest</p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}