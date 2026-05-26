"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type Step = { name: string; prompted: boolean; independent: boolean };
type TASession = {
  id: string;
  client_id: string;
  task_name: string;
  steps: Step[];
  prompt_level: string;
  session_date: string;
  notes: string;
  created_at: string;
};

const COMMON_TASKS = [
  "Hand Washing", "Tooth Brushing", "Dressing", "Shoe Tying",
  "Making a Sandwich", "Setting the Table", "Packing a Backpack",
  "Morning Routine", "Bathroom Routine", "Other"
];

const PROMPT_LEVELS = ["Full Physical (FP)", "Partial Physical (PP)", "Model (M)", "Gesture (G)", "Vocal (V)", "Independent (I)"];

const DEFAULT_STEPS: Record<string, string[]> = {
  "Hand Washing": ["Turn on water", "Wet hands", "Apply soap", "Scrub hands 20 seconds", "Rinse hands", "Turn off water", "Dry hands"],
  "Tooth Brushing": ["Get toothbrush", "Apply toothpaste", "Brush top teeth", "Brush bottom teeth", "Brush tongue", "Rinse mouth", "Rinse toothbrush", "Put away"],
  "Dressing": ["Get clothes", "Put on underwear", "Put on pants", "Put on shirt", "Put on socks", "Put on shoes"],
};

export default function TaskAnalysisPage() {
  const [sessions, setSessions] = useState<TASession[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterClient, setFilterClient] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState("");
  const [taskName, setTaskName] = useState("");
  const [customTask, setCustomTask] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [newStep, setNewStep] = useState("");
  const [promptLevel, setPromptLevel] = useState("");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: sessionData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
      supabase.from("task_analysis").select("*").eq("created_by", user.id).order("created_at", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setSessions((sessionData ?? []).map((s: any) => ({ ...s, steps: Array.isArray(s.steps) ? s.steps : JSON.parse(s.steps || "[]") })));
    setLoading(false);
  }

  function handleTaskSelect(task: string) {
    setTaskName(task);
    const defaults = DEFAULT_STEPS[task];
    if (defaults) {
      setSteps(defaults.map((name) => ({ name, prompted: false, independent: false })));
    } else {
      setSteps([]);
    }
  }

  function addStep() {
    if (!newStep.trim()) return;
    setSteps((prev) => [...prev, { name: newStep.trim(), prompted: false, independent: false }]);
    setNewStep("");
  }

  function toggleStep(index: number, field: "prompted" | "independent") {
    setSteps((prev) => prev.map((s, i) => {
      if (i !== index) return s;
      if (field === "independent") return { ...s, independent: !s.independent, prompted: false };
      return { ...s, prompted: !s.prompted, independent: false };
    }));
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!clientId || !taskName || steps.length === 0) {
      setError("Client, task name, and at least one step are required.");
      return;
    }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error: saveError } = await supabase
      .from("task_analysis")
      .insert([{
        client_id: clientId,
        task_name: taskName === "Other" ? customTask : taskName,
        steps: JSON.stringify(steps),
        prompt_level: promptLevel,
        session_date: sessionDate,
        notes,
        created_by: user.id,
      }])
      .select()
      .single();

    if (saveError) { setError(saveError.message); setSaving(false); return; }

    setSessions((prev) => [{ ...data, steps }, ...prev]);
    setShowForm(false);
    setClientId(""); setTaskName(""); setSteps([]); setNotes(""); setPromptLevel("");
    setSaving(false);
  }

  const filtered = filterClient ? sessions.filter((s) => s.client_id === filterClient) : sessions;
  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  function independentPercent(steps: Step[]) {
    if (!steps.length) return 0;
    return Math.round((steps.filter((s) => s.independent).length / steps.length) * 100);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Task Analysis">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Task Analysis"}
        </Button>
      </PageHeader>

      {showForm && (
        <Section title="New Task Analysis Session">
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
              <label className="text-sm font-medium text-gray-700 mb-1 block">Session Date</label>
              <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Task *</label>
              <select value={taskName} onChange={(e) => handleTaskSelect(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select task...</option>
                {COMMON_TASKS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {taskName === "Other" && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Custom Task Name</label>
                <input type="text" value={customTask} onChange={(e) => setCustomTask(e.target.value)}
                  placeholder="Enter task name..." className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Prompt Level</label>
              <select value={promptLevel} onChange={(e) => setPromptLevel(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select prompt level...</option>
                {PROMPT_LEVELS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..." rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          {/* STEPS */}
          <div className="mt-4">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Steps</label>
            <div className="space-y-2 mb-3">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3 border border-gray-100 rounded-lg p-3 bg-gray-50">
                  <span className="text-xs text-gray-400 w-5">{i + 1}.</span>
                  <span className="text-sm text-gray-700 flex-1">{step.name}</span>
                  <button onClick={() => toggleStep(i, "independent")}
                    className={`text-xs px-2 py-1 rounded-full border transition-all ${step.independent ? "bg-green-500 text-white border-green-500" : "border-gray-300 text-gray-500"}`}>
                    ✓ Indep
                  </button>
                  <button onClick={() => toggleStep(i, "prompted")}
                    className={`text-xs px-2 py-1 rounded-full border transition-all ${step.prompted ? "bg-yellow-500 text-white border-yellow-500" : "border-gray-300 text-gray-500"}`}>
                    P Prompt
                  </button>
                  <button onClick={() => removeStep(i)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newStep} onChange={(e) => setNewStep(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addStep()}
                placeholder="Add a step..." className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <Button variant="outline" onClick={addStep}>Add Step</Button>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>Save Task Analysis</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
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

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <Section title="Task Analysis Sessions">
          <p className="text-gray-400 text-sm">No task analysis sessions yet.</p>
        </Section>
      )}

      <div className="space-y-3">
        {filtered.map((s) => {
          const pct = independentPercent(s.steps);
          return (
            <div key={s.id} className="border border-gray-100 rounded-xl p-4 bg-white">
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <p className="font-semibold text-gray-800">{s.task_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {clientMap.get(s.client_id) ?? "Unknown"} · {s.session_date} · {s.steps.length} steps
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${pct >= 80 ? "bg-green-100 text-green-700" : pct >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                  {pct}% Independent
                </span>
              </div>
              <div className="mt-3 w-full bg-gray-100 rounded-full h-2">
                <div className={`h-2 rounded-full transition-all ${pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                  style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                {s.steps.map((step, i) => (
                  <div key={i} className={`text-xs p-2 rounded-lg border text-center ${step.independent ? "bg-green-50 border-green-200 text-green-700" : step.prompted ? "bg-yellow-50 border-yellow-200 text-yellow-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                    {i + 1}. {step.name}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}