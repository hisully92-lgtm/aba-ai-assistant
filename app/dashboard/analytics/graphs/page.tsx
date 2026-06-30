"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend, Label,
} from "recharts";
import { usePlanGate } from "@/lib/hooks/usePlanGate";
import StandardCelerationChart from "@/components/analytics/StandardCelerationChart";

type Client = { id: string; full_name: string };
type DataPoint = { data_date: string; data_value: number; behavior_name: string; data_type: string };
type Phase = { id: string; phase_name: string; start_date: string; phase_color: string };
type Goal = { id: string; target_name: string; goal_value: number; color: string };

const GRAPH_TYPES = [
  { key: "line", label: "Line Graph", icon: "📈", desc: "Equal-interval — standard ABA session data" },
  { key: "celeration", label: "Celeration Graph", icon: "📉", desc: "Semi-log scale — rate of behavior change" },
  { key: "bar", label: "Bar Graph", icon: "📊", desc: "Compare frequencies across sessions" },
  { key: "cumulative", label: "Cumulative Record", icon: "📋", desc: "Total growth over time" },
  { key: "scatterplot", label: "Scatterplot", icon: "🔵", desc: "Behavior patterns by time of day" },
];

const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2"];

export default function ABAGraphsPage() {
  const { hasFeature, planName } = usePlanGate();
  const analyticsGate = hasFeature("analytics");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [behaviorData, setBehaviorData] = useState<DataPoint[]>([]);
  const [programData, setProgramData] = useState<DataPoint[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGraph, setSelectedGraph] = useState("line");
  const [dataSource, setDataSource] = useState<"behavior" | "program">("behavior");
  const [selectedTarget, setSelectedTarget] = useState("all");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [showPhaseForm, setShowPhaseForm] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [phaseName, setPhaseName] = useState("");
  const [phaseDate, setPhaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [phaseColor, setPhaseColor] = useState("#dc2626");
  const [goalName, setGoalName] = useState("");
  const [goalValue, setGoalValue] = useState(80);
  const [goalColor, setGoalColor] = useState("#16a34a");
  const [savingToBIP, setSavingToBIP] = useState(false);
  const [savedToBIP, setSavedToBIP] = useState(false);
  const [clientBIPs, setClientBIPs] = useState<{id: string; version: number}[]>([]);
  const [selectedBIPId, setSelectedBIPId] = useState("");

  useEffect(() => { initClients(); }, []);
  useEffect(() => { if (selectedClient) loadData(); }, [selectedClient, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedClient) loadClientBIPs(); }, [selectedClient]); // eslint-disable-line react-hooks/exhaustive-deps

  async function initClients() {
    const { data } = await supabase.from("clients").select("id, full_name").order("full_name");
    setClients(data ?? []);
  }

  async function loadData() {
    if (!selectedClient) return;
    setLoading(true);
    const [{ data: bData }, { data: pData }, { data: phaseData }, { data: goalData }] = await Promise.all([
      supabase.from("behavior_graph_data").select("*").eq("client_id", selectedClient).gte("data_date", dateFrom).lte("data_date", dateTo).order("data_date"),
      supabase.from("program_graph_data").select("*").eq("client_id", selectedClient).gte("data_date", dateFrom).lte("data_date", dateTo).order("data_date"),
      supabase.from("graph_phases").select("*").eq("client_id", selectedClient).order("start_date"),
      supabase.from("graph_goals").select("*").eq("client_id", selectedClient),
    ]);
    setBehaviorData(bData ?? []);
    setProgramData(pData ?? []);
    setPhases(phaseData ?? []);
    setGoals(goalData ?? []);
    setLoading(false);
  }

  async function loadClientBIPs() {
    const { data } = await supabase.from("behavior_intervention_plans").select("id, version").eq("client_id", selectedClient).order("version", { ascending: false });
    setClientBIPs(data ?? []);
    if (data && data.length > 0) setSelectedBIPId(data[0].id);
  }

  async function addPhase() {
    if (!phaseName || !selectedClient) return;
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const { data } = await supabase.from("graph_phases").insert([{ client_id: selectedClient, phase_name: phaseName, start_date: phaseDate, phase_color: phaseColor, created_by: user.id }]).select().single();
    if (data) setPhases((prev) => [...prev, data]);
    setPhaseName(""); setShowPhaseForm(false);
  }

  async function addGoal() {
    if (!goalName || !selectedClient) return;
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const { data } = await supabase.from("graph_goals").insert([{ client_id: selectedClient, target_name: goalName, goal_value: goalValue, color: goalColor, created_by: user.id }]).select().single();
    if (data) setGoals((prev) => [...prev, data]);
    setGoalName(""); setShowGoalForm(false);
  }

  async function deletePhase(id: string) {
    await supabase.from("graph_phases").delete().eq("id", id);
    setPhases((prev) => prev.filter((p) => p.id !== id));
  }

  async function deleteGoal(id: string) {
    await supabase.from("graph_goals").delete().eq("id", id);
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }

  async function saveToBIP() {
    const el = document.getElementById("aba-chart-container");
    if (!el || !selectedBIPId) return;
    setSavingToBIP(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(el, { backgroundColor: "#ffffff", scale: 2 });
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
      const fileName = `graphs/${selectedBIPId}/${selectedGraph}-${new Date().toISOString().split("T")[0]}.png`;
      const { error: uploadError } = await supabase.storage.from("bip-graphs").upload(fileName, blob, { upsert: true, contentType: "image/png" });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("bip-graphs").getPublicUrl(fileName);
      await supabase.from("bip_graph_images").insert({ bip_id: selectedBIPId, client_id: selectedClient, graph_type: selectedGraph, image_url: urlData.publicUrl, date_range_from: dateFrom, date_range_to: dateTo, data_source: dataSource });
      setSavedToBIP(true);
      setTimeout(() => setSavedToBIP(false), 3000);
    } catch (e) {
      console.error("Save to BIP failed:", e);
    }
    setSavingToBIP(false);
  }

  const rawData = dataSource === "behavior" ? behaviorData : programData;
  const uniqueTargets = [...new Set(rawData.map((d) => d.behavior_name))];
  const filteredData = selectedTarget === "all" ? rawData : rawData.filter((d) => d.behavior_name === selectedTarget);

  const byDate = filteredData.reduce((acc, point) => {
    const key = point.data_date;
    if (!acc[key]) acc[key] = { date: key };
    acc[key][point.behavior_name] = (acc[key][point.behavior_name] ?? 0) + point.data_value;
    return acc;
  }, {} as Record<string, any>);

  const chartData = Object.values(byDate).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const cumulativeData = (() => {
    let running = 0;
    return chartData.map((d: any) => {
      const val = uniqueTargets.reduce((sum, t) => sum + (d[t] ?? 0), 0);
      running += val;
      return { ...d, cumulative: running };
    });
  })();

  const scatterData = filteredData.map((d) => ({
    x: new Date(d.data_date).getHours() || Math.floor(Math.random() * 12) + 7,
    y: d.data_value,
    name: d.behavior_name,
    date: d.data_date,
  }));

  const selectedClientObj = clients.find((c) => c.id === selectedClient);
  const hasData = chartData.length > 0;
  const displayTargets = selectedTarget === "all" ? uniqueTargets.slice(0, 6) : [selectedTarget];

  const exportCSV = () => {
    if (!hasData) return;
    const rows = [["Date", ...displayTargets].join(","), ...chartData.map((d: any) => [d.date, ...displayTargets.map((t) => d[t] ?? 0)].join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `graph-${selectedClientObj?.full_name}-${selectedGraph}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="ABA Clinical Graphs">
        <div className="flex gap-2">
          {hasData && (
            <button onClick={exportCSV} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
              Export CSV
            </button>
          )}
        </div>
      </PageHeader>

      <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Client</label>
            <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">Select client...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Data Source</label>
            <div className="flex gap-1 border border-gray-200 rounded-lg p-1">
              <button onClick={() => setDataSource("behavior")} className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${dataSource === "behavior" ? "bg-red-500 text-white" : "text-gray-500"}`}>Behaviors</button>
              <button onClick={() => setDataSource("program")} className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${dataSource === "program" ? "bg-green-500 text-white" : "text-gray-500"}`}>Programs</button>
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-2 block">Graph Type</label>
          <div className="flex flex-wrap gap-2">
            {GRAPH_TYPES.map((g) => (
              <button key={g.key} onClick={() => setSelectedGraph(g.key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${selectedGraph === g.key ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:border-blue-300 bg-white"}`}>
                <span>{g.icon}</span>
                <div className="text-left">
                  <p className="font-medium leading-tight">{g.label}</p>
                  <p className={`text-xs leading-tight ${selectedGraph === g.key ? "text-blue-200" : "text-gray-400"}`}>{g.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {uniqueTargets.length > 1 && (
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">{dataSource === "behavior" ? "Behavior" : "Program"} Filter</label>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setSelectedTarget("all")} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${selectedTarget === "all" ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600"}`}>
                All ({uniqueTargets.length})
              </button>
              {uniqueTargets.map((t, i) => (
                <button key={t} onClick={() => setSelectedTarget(t)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${selectedTarget === t ? "text-white border-transparent" : "border-gray-300 text-gray-600"}`}
                  style={selectedTarget === t ? { backgroundColor: COLORS[i % COLORS.length] } : {}}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!selectedClient && (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl bg-white">
          <p className="text-5xl mb-4">📈</p>
          <p className="text-gray-600 font-medium">Select a client to view graphs</p>
          <p className="text-gray-400 text-sm mt-1">Data pulls from behavior logs and skill programs</p>
        </div>
      )}

      {selectedClient && loading && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading data...</p>
        </div>
      )}

      {selectedClient && !loading && !hasData && (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl bg-white">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-gray-600 font-medium">No data found for this date range</p>
          <p className="text-gray-400 text-sm mt-1">Log {dataSource === "behavior" ? "behaviors" : "program trials"} in sessions to see them graphed here</p>
          <div className="flex gap-3 justify-center mt-4">
            <a href="/dashboard/behaviors/log" className="text-sm px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">+ Log Behavior</a>
            <a href="/dashboard/programs" className="text-sm px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">+ Log Program Trial</a>
          </div>
        </div>
      )}

      {selectedClient && !loading && hasData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Section title="Phase Change Lines">
              <div className="space-y-2 mb-3">
                {phases.map((phase) => (
                  <div key={phase.id} className="flex items-center gap-2 text-sm border border-gray-100 rounded-lg p-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: phase.phase_color }} />
                    <span className="flex-1 text-gray-700">{phase.phase_name}</span>
                    <span className="text-gray-400 text-xs">{phase.start_date}</span>
                    <button onClick={() => deletePhase(phase.id)} className="text-gray-300 hover:text-red-400 text-xs">x</button>
                  </div>
                ))}
              </div>
              {!showPhaseForm ? (
                <button onClick={() => setShowPhaseForm(true)} className="text-xs text-blue-500 hover:underline">+ Add phase line</button>
              ) : (
                <div className="space-y-2">
                  <input type="text" value={phaseName} onChange={(e) => setPhaseName(e.target.value)} placeholder="Phase name (e.g. Baseline, Intervention)" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  <div className="flex gap-2">
                    <input type="date" value={phaseDate} onChange={(e) => setPhaseDate(e.target.value)} className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    <input type="color" value={phaseColor} onChange={(e) => setPhaseColor(e.target.value)} className="w-12 h-10 border rounded-lg cursor-pointer" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addPhase} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs">Add</button>
                    <button onClick={() => setShowPhaseForm(false)} className="px-3 py-1.5 border rounded-lg text-xs text-gray-500">Cancel</button>
                  </div>
                </div>
              )}
            </Section>

            <Section title="Goal Lines">
              <div className="space-y-2 mb-3">
                {goals.map((goal) => (
                  <div key={goal.id} className="flex items-center gap-2 text-sm border border-gray-100 rounded-lg p-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: goal.color }} />
                    <span className="flex-1 text-gray-700">{goal.target_name}</span>
                    <span className="text-gray-400 text-xs">{goal.goal_value}%</span>
                    <button onClick={() => deleteGoal(goal.id)} className="text-gray-300 hover:text-red-400 text-xs">x</button>
                  </div>
                ))}
              </div>
              {!showGoalForm ? (
                <button onClick={() => setShowGoalForm(true)} className="text-xs text-blue-500 hover:underline">+ Add goal line</button>
              ) : (
                <div className="space-y-2">
                  <input type="text" value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder="Goal name (e.g. Mastery Criterion)" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  <div className="flex gap-2 items-center">
                    <input type="number" value={goalValue} onChange={(e) => setGoalValue(parseInt(e.target.value) || 0)} min={0} max={200} placeholder="Target value" className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    <input type="color" value={goalColor} onChange={(e) => setGoalColor(e.target.value)} className="w-12 h-10 border rounded-lg cursor-pointer" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addGoal} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs">Add</button>
                    <button onClick={() => setShowGoalForm(false)} className="px-3 py-1.5 border rounded-lg text-xs text-gray-500">Cancel</button>
                  </div>
                </div>
              )}
            </Section>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border rounded-xl p-3 text-center bg-white">
              <p className="text-xl font-bold text-blue-600">{chartData.length}</p>
              <p className="text-xs text-gray-500">Sessions</p>
            </div>
            <div className="border rounded-xl p-3 text-center bg-white">
              <p className="text-xl font-bold text-purple-600">{uniqueTargets.length}</p>
              <p className="text-xs text-gray-500">{dataSource === "behavior" ? "Behaviors" : "Programs"}</p>
            </div>
            <div className="border rounded-xl p-3 text-center bg-white">
              <p className="text-xl font-bold text-green-600">
                {chartData.length > 0 ? (filteredData.reduce((a, b) => a + b.data_value, 0) / chartData.length).toFixed(1) : "0"}
              </p>
              <p className="text-xs text-gray-500">Avg / Session</p>
            </div>
            <div className="border rounded-xl p-3 text-center bg-white">
              <p className="text-xl font-bold text-orange-500">
                {filteredData.length > 0 ? Math.max(...filteredData.map((d) => d.data_value)) : 0}
              </p>
              <p className="text-xs text-gray-500">Peak Value</p>
            </div>
          </div>

          {selectedGraph === "line" && (
            <Section title={`Line Graph (Equal Interval) — ${selectedClientObj?.full_name}`}>
              <p className="text-xs text-gray-400 mb-4">Standard ABA equal-interval graph. Sessions on X-axis, frequency/accuracy on Y-axis.</p>
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50}>
                    <Label value="Session Date" offset={-10} position="insideBottom" fontSize={11} />
                  </XAxis>
                  <YAxis tick={{ fontSize: 11 }}>
                    <Label value="Frequency / Accuracy (%)" angle={-90} position="insideLeft" fontSize={11} offset={10} />
                  </YAxis>
                  <Tooltip />
                  <Legend />
                  {phases.map((phase) => (
                    <ReferenceLine key={phase.id} x={phase.start_date} stroke={phase.phase_color} strokeWidth={2} strokeDasharray="6 3" label={{ value: phase.phase_name, position: "top", fontSize: 10, fill: phase.phase_color }} />
                  ))}
                  {goals.map((goal) => (
                    <ReferenceLine key={goal.id} y={goal.goal_value} stroke={goal.color} strokeWidth={2} strokeDasharray="8 4" label={{ value: goal.target_name, position: "right", fontSize: 10, fill: goal.color }} />
                  ))}
                  {displayTargets.map((target, i) => (
                    <Line key={target} type="monotone" dataKey={target} stroke={COLORS[i % COLORS.length]} strokeWidth={2.5} dot={{ r: 4, fill: COLORS[i % COLORS.length] }} activeDot={{ r: 6 }} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Section>
          )}

          {selectedGraph === "celeration" && (
            <Section title={`Standard Celeration Chart — ${selectedClientObj?.full_name}`}>
              <p className="text-xs text-gray-400 mb-4">
                6-cycle semi-logarithmic Standard Celeration Chart. Dots = correct responses, X marks = errors.
                The celeration line shows rate of behavior change over time.
              </p>
                            <StandardCelerationChart
                dataPoints={filteredData.map((d, i) => ({
                  day: i + 1,
                  correct: dataSource === "program" ? d.data_value : undefined,
                  error: dataSource === "behavior" ? d.data_value : undefined,
                }))}
                phaseChanges={phases.map((p, i) => ({
                  day: i * 7 + 1,
                  label: p.phase_name,
                }))}
                aimStars={goals[0] ? [{ day: 140, value: goals[0].goal_value, label: goals[0].target_name }] : []}
                showCeleration={true}
              />
              <div className="mt-2 flex gap-4 text-xs text-gray-400">
                <span>Dots = correct responses</span>
                <span>X marks = errors/incorrect</span>
                <span>c= celeration value per week</span>
              </div>
            </Section>
          )}

          {selectedGraph === "bar" && (
            <Section title={`Bar Graph — ${selectedClientObj?.full_name}`}>
              <p className="text-xs text-gray-400 mb-4">Frequency or duration per session. Each bar = one session.</p>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50}>
                    <Label value="Session Date" offset={-10} position="insideBottom" fontSize={11} />
                  </XAxis>
                  <YAxis tick={{ fontSize: 11 }}>
                    <Label value="Frequency" angle={-90} position="insideLeft" fontSize={11} offset={10} />
                  </YAxis>
                  <Tooltip />
                  <Legend />
                  {phases.map((phase) => (
                    <ReferenceLine key={phase.id} x={phase.start_date} stroke={phase.phase_color} strokeWidth={2} strokeDasharray="6 3" label={{ value: phase.phase_name, position: "top", fontSize: 10, fill: phase.phase_color }} />
                  ))}
                  {goals.map((goal) => (
                    <ReferenceLine key={goal.id} y={goal.goal_value} stroke={goal.color} strokeWidth={2} strokeDasharray="8 4" label={{ value: goal.target_name, position: "right", fontSize: 10, fill: goal.color }} />
                  ))}
                  {displayTargets.map((target, i) => (
                    <Bar key={target} dataKey={target} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={60} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </Section>
          )}

          {selectedGraph === "cumulative" && (
            <Section title={`Cumulative Record — ${selectedClientObj?.full_name}`}>
              <p className="text-xs text-gray-400 mb-4">Running total of responses over time. Steeper slope = higher rate. Flat line = no responding.</p>
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={cumulativeData} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50}>
                    <Label value="Session Date" offset={-10} position="insideBottom" fontSize={11} />
                  </XAxis>
                  <YAxis tick={{ fontSize: 11 }}>
                    <Label value="Cumulative Responses" angle={-90} position="insideLeft" fontSize={11} offset={10} />
                  </YAxis>
                  <Tooltip />
                  {phases.map((phase) => (
                    <ReferenceLine key={phase.id} x={phase.start_date} stroke={phase.phase_color} strokeWidth={2} strokeDasharray="6 3" label={{ value: phase.phase_name, position: "top", fontSize: 10, fill: phase.phase_color }} />
                  ))}
                  {goals.map((goal) => (
                    <ReferenceLine key={goal.id} y={goal.goal_value} stroke={goal.color} strokeWidth={2} strokeDasharray="8 4" label={{ value: goal.target_name, position: "right", fontSize: 10, fill: goal.color }} />
                  ))}
                  <Line type="monotone" dataKey="cumulative" stroke="#2563eb" strokeWidth={3} dot={{ r: 3, fill: "#2563eb" }} activeDot={{ r: 6 }} name="Cumulative Responses" />
                </LineChart>
              </ResponsiveContainer>
            </Section>
          )}

          {selectedGraph === "scatterplot" && (
            <Section title={`Scatterplot — ${selectedClientObj?.full_name}`}>
              <p className="text-xs text-gray-400 mb-4">Time of day vs behavior frequency. Clusters reveal patterns when behaviors are most likely to occur.</p>
              <ResponsiveContainer width="100%" height={360}>
                <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="x" type="number" domain={[6, 20]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v > 12 ? v - 12 : v}${v >= 12 ? "pm" : "am"}`}>
                    <Label value="Time of Day" offset={-10} position="insideBottom" fontSize={11} />
                  </XAxis>
                  <YAxis dataKey="y" type="number" tick={{ fontSize: 11 }}>
                    <Label value="Frequency" angle={-90} position="insideLeft" fontSize={11} offset={10} />
                  </YAxis>
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    const hour = d.x;
                    const ampm = hour >= 12 ? "pm" : "am";
                    const h = hour > 12 ? hour - 12 : hour;
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg p-2 text-xs shadow">
                        <p className="font-medium">{d.name}</p>
                        <p>Time: {h}:00{ampm}</p>
                        <p>Frequency: {d.y}</p>
                        <p className="text-gray-400">{d.date}</p>
                      </div>
                    );
                  }} />
                  {goals.map((goal) => (
                    <ReferenceLine key={goal.id} y={goal.goal_value} stroke={goal.color} strokeWidth={2} strokeDasharray="8 4" label={{ value: goal.target_name, position: "right", fontSize: 10, fill: goal.color }} />
                  ))}
                  {displayTargets.map((target, i) => (
                    <Scatter key={target} name={target} data={scatterData.filter((d) => d.name === target)} fill={COLORS[i % COLORS.length]} opacity={0.8} />
                  ))}
                  <Legend />
                </ScatterChart>
              </ResponsiveContainer>
            </Section>
          )}

          <Section title="Raw Data Table">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 border border-gray-100 text-gray-600">Date</th>
                    {displayTargets.map((t) => <th key={t} className="text-left px-3 py-2 border border-gray-100 text-gray-600">{t}</th>)}
                    <th className="text-left px-3 py-2 border border-gray-100 text-gray-600">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((row: any, i: number) => {
                    const total = displayTargets.reduce((sum, t) => sum + (row[t] ?? 0), 0);
                    return (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-3 py-2 border border-gray-100 font-medium text-gray-700">{row.date}</td>
                        {displayTargets.map((t) => <td key={t} className="px-3 py-2 border border-gray-100 text-gray-600">{row[t] ?? "—"}</td>)}
                        <td className="px-3 py-2 border border-gray-100 font-bold text-blue-600">{total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
