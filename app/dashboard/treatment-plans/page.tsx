"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type Goal = { description: string; target: string; mastery_criteria: string; status: string };
type Plan = {
  id: string;
  client_id: string;
  plan_name: string;
  goals: Goal[];
  start_date: string;
  review_date: string;
  status: string;
  notes: string;
  created_at: string;
};

const GOAL_STATUSES = ["In Progress", "Mastered", "On Hold", "Discontinued"];

const emptyGoal: Goal = { description: "", target: "", mastery_criteria: "80% over 3 consecutive sessions", status: "In Progress" };

export default function TreatmentPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterClient, setFilterClient] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [clientId, setClientId] = useState("");
  const [planName, setPlanName] = useState("");
  const [goals, setGoals] = useState<Goal[]>([{ ...emptyGoal }]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [reviewDate, setReviewDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: planData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
      supabase.from("treatment_plans").select("*").eq("created_by", user.id).order("created_at", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setPlans((planData ?? []).map((p: any) => ({ ...p, goals: Array.isArray(p.goals) ? p.goals : JSON.parse(p.goals || "[]") })));
    setLoading(false);
  }

  function addGoal() { setGoals((prev) => [...prev, { ...emptyGoal }]); }
  function removeGoal(i: number) { setGoals((prev) => prev.filter((_, idx) => idx !== i)); }
  function updateGoal(i: number, field: keyof Goal, value: string) {
    setGoals((prev) => prev.map((g, idx) => idx === i ? { ...g, [field]: value } : g));
  }

  async function handleSave() {
    if (!clientId || !planName) { setError("Client and plan name are required."); return; }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error: saveError } = await supabase
      .from("treatment_plans")
      .insert([{
        client_id: clientId,
        plan_name: planName,
        goals: JSON.stringify(goals),
        start_date: startDate,
        review_date: reviewDate || null,
        notes,
        status: "active",
        created_by: user.id,
      }])
      .select()
      .single();

    if (saveError) { setError(saveError.message); setSaving(false); return; }

    setPlans((prev) => [{ ...data, goals }, ...prev]);
    setShowForm(false);
    setClientId(""); setPlanName(""); setGoals([{ ...emptyGoal }]); setNotes(""); setReviewDate("");
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
    setSaving(false);
  }

  const filtered = filterClient ? plans.filter((p) => p.client_id === filterClient) : plans;
  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  return (
    <div className="space-y-6">
      <PageHeader title="Treatment Plans">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Treatment Plan"}
        </Button>
      </PageHeader>

      {success && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">✓ Treatment plan saved.</div>}

      {showForm && (
        <Section title="New Treatment Plan">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
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
              <label className="text-sm font-medium text-gray-700 mb-1 block">Plan Name *</label>
              <input type="text" value={planName} onChange={(e) => setPlanName(e.target.value)}
                placeholder="e.g. 2024 Annual Treatment Plan"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Review Date</label>
              <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Plan overview, clinical rationale..." rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          {/* GOALS */}
          <div className="mt-4 space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-700">Goals ({goals.length})</label>
              <Button variant="outline" onClick={addGoal}>+ Add Goal</Button>
            </div>
            {goals.map((goal, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium text-gray-700">Goal {i + 1}</p>
                  {goals.length > 1 && (
                    <button onClick={() => removeGoal(i)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Goal Description</label>
                    <textarea value={goal.description} onChange={(e) => updateGoal(i, "description", e.target.value)}
                      placeholder="e.g. Client will independently wash hands with 80% accuracy..."
                      rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Target</label>
                    <input type="text" value={goal.target} onChange={(e) => updateGoal(i, "target", e.target.value)}
                      placeholder="Specific target behavior" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Mastery Criteria</label>
                    <input type="text" value={goal.mastery_criteria} onChange={(e) => updateGoal(i, "mastery_criteria", e.target.value)}
                      placeholder="e.g. 80% over 3 sessions" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Status</label>
                    <select value={goal.status} onChange={(e) => updateGoal(i, "status", e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                      {GOAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>Save Treatment Plan</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* FILTER */}
      {!loading && plans.length > 0 && (
        <div className="flex gap-3 items-center">
          <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <p className="text-sm text-gray-400">{filtered.length} plans</p>
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <Section title="Treatment Plans">
          <p className="text-gray-400 text-sm">No treatment plans yet.</p>
        </Section>
      )}

      <div className="space-y-3">
        {filtered.map((p) => {
          const isExpanded = expandedId === p.id;
          const masteredGoals = p.goals.filter((g) => g.status === "Mastered").length;
          return (
            <div key={p.id} className="border border-gray-100 rounded-xl bg-white">
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-800">{p.plan_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {clientMap.get(p.client_id) ?? "Unknown"} · {p.start_date}
                      {p.review_date && ` → Review: ${p.review_date}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {masteredGoals}/{p.goals.length} goals mastered
                    </p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {p.status}
                    </span>
                    <button onClick={() => setExpandedId(isExpanded ? null : p.id)}
                      className="text-xs text-gray-400 hover:text-gray-600">
                      {isExpanded ? "▲" : "▼"}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                    {p.goals.map((goal, i) => (
                      <div key={i} className={`border rounded-lg p-3 ${goal.status === "Mastered" ? "border-green-200 bg-green-50" : "border-gray-100 bg-gray-50"}`}>
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-medium text-gray-800">Goal {i + 1}: {goal.description}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ml-2 shrink-0 ${
                            goal.status === "Mastered" ? "bg-green-100 text-green-700"
                            : goal.status === "In Progress" ? "bg-blue-100 text-blue-700"
                            : goal.status === "On Hold" ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                          }`}>{goal.status}</span>
                        </div>
                        {goal.target && <p className="text-xs text-gray-500 mt-1">Target: {goal.target}</p>}
                        {goal.mastery_criteria && <p className="text-xs text-gray-500">Mastery: {goal.mastery_criteria}</p>}
                      </div>
                    ))}
                    {p.notes && <p className="text-sm text-gray-600 mt-2 italic">{p.notes}</p>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}