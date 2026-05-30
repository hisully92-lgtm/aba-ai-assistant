/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type Client = { id: string; full_name: string };
type Goal = {
  id: string;
  client_id: string;
  goal_name: string;
  domain: string;
  baseline: number;
  current_performance: number;
  target: number;
  mastery_criteria: string;
  status: string;
  setting: string;
  generalized: boolean;
  notes: string | null;
  created_at: string;
  updated_at?: string;
};
type GeneralizationEntry = {
  id: string;
  goal_id: string;
  skill_name: string;
  setting: string;
  person: string;
  accuracy: number;
  session_date: string;
};

const DOMAINS = ["Communication", "Social Skills", "Behavior Reduction", "Daily Living", "Academic", "Motor Skills", "Feeding", "Vocational"];
const SETTINGS = ["clinic", "home", "school", "community", "telehealth"];
const STATUSES = ["active", "mastered", "on_hold", "discontinued"];

const emptyGoalForm = {
  client_id: "",
  goal_name: "",
  domain: "",
  baseline: 0,
  current_performance: 0,
  target: 80,
  mastery_criteria: "80% over 3 consecutive sessions",
  status: "active",
  setting: "clinic",
  notes: "",
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [generalizationData, setGeneralizationData] = useState<Record<string, GeneralizationEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterClient, setFilterClient] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");
  const [filterDomain, setFilterDomain] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingGen, setAddingGen] = useState<string | null>(null);
  const [form, setForm] = useState(emptyGoalForm);

  const [genSetting, setGenSetting] = useState("home");
  const [genPerson, setGenPerson] = useState("");
  const [genAccuracy, setGenAccuracy] = useState(0);
  const [savingGen, setSavingGen] = useState(false);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: goalData }] = await Promise.all([
      supabase.from("clients").select("id, full_name"),
      supabase.from("client_goals").select("*").eq("created_by", user.id).order("created_at", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setGoals(goalData ?? []);
    setLoading(false);
  }

  useEffect(() => { void init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadGeneralization(goalId: string) {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("generalization_data")
      .select("*").eq("goal_id", goalId).order("session_date", { ascending: true });

    setGeneralizationData((prev) => ({ ...prev, [goalId]: data ?? [] }));
  }

  async function handleSave() {
    if (!form.client_id || !form.goal_name) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("client_goals").insert([{
      ...form,
      notes: form.notes || null,
      created_by: user.id,
    }]).select().single();

    if (data) setGoals((prev) => [data, ...prev]);
    setForm(emptyGoalForm);
    setShowForm(false);
    setSaving(false);
  }

  async function updateGoalStatus(id: string, status: string) {
    await supabase.from("client_goals").update({ status }).eq("id", id);
    setGoals((prev) => prev.map((g) => g.id === id ? { ...g, status } : g));

    if (status === "mastered") {
      const goal = goals.find((g) => g.id === id);
      console.log(`Goal mastered: ${goal?.goal_name}`);
    }
  }

  async function updatePerformance(id: string, performance: number) {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;

    const updates: Record<string, any> = { current_performance: performance };

    if (performance >= goal.target && goal.status === "active") {
      updates.status = "mastered";
      updates.updated_at = new Date().toISOString();
    }

    await supabase.from("client_goals").update(updates).eq("id", id);
    setGoals(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));

    if (updates.status === "mastered") {
      alert(`Goal mastered: ${goal.goal_name}`);
    }
  }

  async function saveGeneralization(goalId: string, skillName: string) {
    setSavingGen(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("generalization_data").insert([{
      goal_id: goalId,
      client_id: goals.find((g) => g.id === goalId)?.client_id,
      skill_name: skillName,
      setting: genSetting,
      person: genPerson,
      accuracy: genAccuracy,
      session_date: new Date().toISOString().split("T")[0],
      created_by: user.id,
    }]).select().single();

    if (data) {
      setGeneralizationData((prev) => ({ ...prev, [goalId]: [...(prev[goalId] ?? []), data] }));
      await supabase.from("client_goals").update({ generalized: true }).eq("id", goalId);
      setGoals((prev) => prev.map((g) => g.id === goalId ? { ...g, generalized: true } : g));
    }

    setAddingGen(null);
    setGenSetting("home");
    setGenPerson("");
    setGenAccuracy(0);
    setSavingGen(false);
  }

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  let filtered = goals;
  if (filterClient) filtered = filtered.filter((g) => g.client_id === filterClient);
  if (filterStatus) filtered = filtered.filter((g) => g.status === filterStatus);
  if (filterDomain) filtered = filtered.filter((g) => g.domain === filterDomain);

  function progressPct(goal: Goal) {
    if (goal.target === goal.baseline) return 0;
    return Math.min(100, Math.round(((goal.current_performance - goal.baseline) / (goal.target - goal.baseline)) * 100));
  }

  function statusColor(status: string) {
    if (status === "mastered") return "bg-green-100 text-green-700";
    if (status === "active") return "bg-blue-100 text-blue-700";
    if (status === "on_hold") return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-700";
  }

  const byClient = filtered.reduce((acc, goal) => {
    const client = clientMap.get(goal.client_id) ?? "Unknown";
    acc[client] = acc[client] ?? [];
    acc[client].push(goal);
    return acc;
  }, {} as Record<string, Goal[]>);

  return (
    <div className="space-y-6">
      <PageHeader title="Client Goals Dashboard">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add Goal"}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Active", value: goals.filter((g) => g.status === "active").length, color: "text-blue-600" },
          { label: "Mastered", value: goals.filter((g) => g.status === "mastered").length, color: "text-green-600" },
          { label: "Generalized", value: goals.filter((g) => g.generalized).length, color: "text-purple-600" },
          { label: "On Hold", value: goals.filter((g) => g.status === "on_hold").length, color: "text-yellow-600" },
        ].map((stat) => (
          <div key={stat.label} className="border rounded-xl p-4 text-center bg-white">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <Section title="Add Goal">
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
              <label className="text-sm font-medium text-gray-700 mb-1 block">Domain</label>
              <select value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select domain...</option>
                {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Goal Name *</label>
              <input type="text" value={form.goal_name} onChange={(e) => setForm({ ...form, goal_name: e.target.value })}
                placeholder="e.g. Client will independently wash hands..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Baseline (%)</label>
              <input type="number" min={0} max={100} value={form.baseline}
                onChange={(e) => setForm({ ...form, baseline: parseInt(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Target (%)</label>
              <input type="number" min={0} max={100} value={form.target}
                onChange={(e) => setForm({ ...form, target: parseInt(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Mastery Criteria</label>
              <input type="text" value={form.mastery_criteria}
                onChange={(e) => setForm({ ...form, mastery_criteria: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Primary Setting</label>
              <select value={form.setting} onChange={(e) => setForm({ ...form, setting: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                {SETTINGS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
              <input type="text" value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>Add Goal</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">All Clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterDomain} onChange={(e) => setFilterDomain(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">All Domains</option>
          {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <p className="text-sm text-gray-400">{filtered.length} goals</p>
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}

      {Object.entries(byClient).map(([clientName, clientGoals]) => (
        <Section key={clientName} title={clientName}>
          <div className="space-y-3">
            {clientGoals.map((goal) => {
              const isExpanded = expandedId === goal.id;
              const pct = progressPct(goal);
              const genData = generalizationData[goal.id] ?? [];

              return (
                <div key={goal.id} className={`border rounded-xl p-4 bg-white ${goal.status === "mastered" ? "border-green-200" : "border-gray-100"}`}>
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800">{goal.goal_name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(goal.status)}`}>
                          {goal.status}
                        </span>
                        {goal.domain && (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{goal.domain}</span>
                        )}
                        {goal.generalized && (
                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">Generalized</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Baseline: {goal.baseline}% → Current: {goal.current_performance}% → Target: {goal.target}%
                        · {goal.mastery_criteria}
                      </p>
                    </div>
                    <div className="flex gap-2 items-center">
                      <select value={goal.status} onChange={(e) => updateGoalStatus(goal.id, e.target.value)}
                        className="text-xs border rounded-lg px-2 py-1 focus:outline-none">
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button
                        onClick={() => {
                          setExpandedId(isExpanded ? null : goal.id);
                          if (!isExpanded) void loadGeneralization(goal.id);
                        }}
                        className="text-xs text-gray-400 hover:text-gray-600">
                        {isExpanded ? "▲" : "▼"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>{goal.baseline}%</span>
                      <span className="font-medium text-blue-600">{goal.current_performance}% current</span>
                      <span>{goal.target}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${pct >= 100 ? "bg-green-500" : pct >= 50 ? "bg-blue-500" : "bg-yellow-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{pct}% progress toward goal</p>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 border-t border-gray-100 pt-4 space-y-4">
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Update Current Performance</label>
                        <div className="flex items-center gap-3">
                          <input type="range" min={0} max={100} value={goal.current_performance}
                            onChange={(e) => void updatePerformance(goal.id, parseInt(e.target.value))}
                            className="flex-1" />
                          <span className="text-sm font-bold text-blue-600 w-12">{goal.current_performance}%</span>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-xs font-semibold text-gray-600">Generalization Tracking</p>
                          <Button variant="outline" onClick={() => setAddingGen(addingGen === goal.id ? null : goal.id)}>
                            {addingGen === goal.id ? "Cancel" : "+ Log Generalization"}
                          </Button>
                        </div>

                        {addingGen === goal.id && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 border border-gray-100 rounded-lg p-3 bg-gray-50">
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">Setting</label>
                              <select value={genSetting} onChange={(e) => setGenSetting(e.target.value)}
                                className="w-full border rounded px-2 py-1 text-xs focus:outline-none">
                                {SETTINGS.map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">Person</label>
                              <input type="text" value={genPerson} onChange={(e) => setGenPerson(e.target.value)}
                                placeholder="Parent, teacher..."
                                className="w-full border rounded px-2 py-1 text-xs focus:outline-none" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">Accuracy %</label>
                              <input type="number" min={0} max={100} value={genAccuracy}
                                onChange={(e) => setGenAccuracy(parseInt(e.target.value) || 0)}
                                className="w-full border rounded px-2 py-1 text-xs focus:outline-none" />
                            </div>
                            <div className="flex items-end">
                              <Button onClick={() => void saveGeneralization(goal.id, goal.goal_name)} loading={savingGen}>
                                Save
                              </Button>
                            </div>
                          </div>
                        )}

                        {genData.length > 0 && (
                          <>
                            <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mb-3">
                              {genData.map((entry) => (
                                <div key={entry.id}
                                  className={`border rounded-lg p-2 text-center text-xs ${entry.accuracy >= 80 ? "border-green-200 bg-green-50" : "border-gray-100 bg-white"}`}>
                                  <p className={`font-bold text-sm ${entry.accuracy >= 80 ? "text-green-600" : "text-gray-700"}`}>
                                    {entry.accuracy}%
                                  </p>
                                  <p className="text-gray-500 capitalize">{entry.setting}</p>
                                  {entry.person && <p className="text-gray-400">{entry.person}</p>}
                                  <p className="text-gray-400">{entry.session_date}</p>
                                </div>
                              ))}
                            </div>
                            <ResponsiveContainer width="100%" height={120}>
                              <LineChart data={genData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="session_date" tick={{ fontSize: 9 }} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}%`} />
                                <Tooltip formatter={(v) => [`${v}%`, "Accuracy"]} />
                                <Line type="monotone" dataKey="accuracy" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </>
                        )}
                      </div>

                      {goal.notes && <p className="text-sm text-gray-600 italic">{goal.notes}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      ))}
    </div>
  );
}