"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type Behavior = {
  id: string;
  client_id: string;
  staff_member: string;
  behavior_name: string;
  antecedent: string;
  behavior: string;
  consequence: string;
  frequency: string;
  duration: string;
  intensity: string;
  function_hypothesis: string;
  intervention_used: string;
  replacement_behavior: string;
  created_at: string;
};

const BEHAVIOR_NAMES = ["Aggression", "Self-Injurious Behavior", "Elopement", "Property Destruction", "Tantrum", "Non-Compliance", "Vocal Disruption", "Stereotypy", "Other"];
const ANTECEDENTS = ["Demand presented", "Preferred item removed", "Attention withheld", "Transition", "Unstructured time", "Peer interaction", "Other"];
const FREQUENCIES = ["1-2x", "3-5x", "6-10x", "10+ times", "Continuous"];
const DURATIONS = ["< 1 min", "1-5 min", "5-15 min", "15-30 min", "> 30 min"];
const INTENSITIES = ["Mild", "Moderate", "Severe"];
const FUNCTIONS = ["Attention", "Escape/Avoidance", "Tangible", "Sensory/Automatic", "Unknown"];
const INTERVENTIONS = ["Redirection", "Planned ignoring", "Differential reinforcement", "Response blocking", "NCR", "Token economy", "Visual supports", "First-Then board", "Other"];

const emptyForm = {
  client_id: "", staff_member: "", behavior_name: "", antecedent: "",
  behavior: "", consequence: "", frequency: "", duration: "",
  intensity: "", function_hypothesis: "", intervention_used: "", replacement_behavior: "",
};

export default function BehaviorsPage() {
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState("");
  const [filterBehavior, setFilterBehavior] = useState("");
  const [filterIntensity, setFilterIntensity] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    // RLS handles role-based filtering — no created_by filter needed
    const [{ data: clientData }, { data: behaviorData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").order("full_name"),
      supabase.from("behaviors").select("*").order("created_at", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setBehaviors(behaviorData ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.client_id || !form.behavior_name) {
      setError("Client and behavior name are required.");
      return;
    }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error: saveError } = await supabase
      .from("behaviors")
      .insert([{ ...form, created_by: user.id }])
      .select()
      .single();

    if (saveError) { setError(saveError.message); setSaving(false); return; }

    setBehaviors((prev) => [data, ...prev]);
    setForm(emptyForm);
    setSuccess(true);
    setShowForm(false);
    setTimeout(() => setSuccess(false), 3000);
    setSaving(false);
  }

  let filtered = behaviors;
  if (filterClient) filtered = filtered.filter((b) => b.client_id === filterClient);
  if (filterBehavior) filtered = filtered.filter((b) => b.behavior_name === filterBehavior);
  if (filterIntensity) filtered = filtered.filter((b) => b.intensity === filterIntensity);
  if (dateFrom) filtered = filtered.filter((b) => new Date(b.created_at) >= new Date(dateFrom));
  if (dateTo) filtered = filtered.filter((b) => new Date(b.created_at) <= new Date(dateTo + "T23:59:59"));

  const filtersActive = filterClient || filterBehavior || filterIntensity || dateFrom || dateTo;
  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  function intensityColor(intensity: string) {
    if (intensity === "Severe") return "bg-red-100 text-red-700";
    if (intensity === "Moderate") return "bg-yellow-100 text-yellow-700";
    return "bg-green-100 text-green-700";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Behavior Interventions">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Log Behavior"}
        </Button>
      </PageHeader>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          ✓ Behavior logged successfully.
        </div>
      )}

      {showForm && (
        <Section title="Log Behavior">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
              <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Staff Member</label>
              <input type="text" value={form.staff_member}
                onChange={(e) => setForm({ ...form, staff_member: e.target.value })}
                placeholder="Your name"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Behavior *</label>
              <select value={form.behavior_name} onChange={(e) => setForm({ ...form, behavior_name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select behavior...</option>
                {BEHAVIOR_NAMES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Antecedent</label>
              <select value={form.antecedent} onChange={(e) => setForm({ ...form, antecedent: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select antecedent...</option>
                {ANTECEDENTS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Behavior Description</label>
              <textarea value={form.behavior} onChange={(e) => setForm({ ...form, behavior: e.target.value })}
                placeholder="Describe the behavior..." rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Consequence</label>
              <textarea value={form.consequence} onChange={(e) => setForm({ ...form, consequence: e.target.value })}
                placeholder="What happened after..." rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Frequency</label>
              <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select frequency...</option>
                {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Duration</label>
              <select value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select duration...</option>
                {DURATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Intensity</label>
              <select value={form.intensity} onChange={(e) => setForm({ ...form, intensity: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select intensity...</option>
                {INTENSITIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Function Hypothesis</label>
              <select value={form.function_hypothesis} onChange={(e) => setForm({ ...form, function_hypothesis: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select function...</option>
                {FUNCTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Intervention Used</label>
              <select value={form.intervention_used} onChange={(e) => setForm({ ...form, intervention_used: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select intervention...</option>
                {INTERVENTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Replacement Behavior</label>
              <input type="text" value={form.replacement_behavior}
                onChange={(e) => setForm({ ...form, replacement_behavior: e.target.value })}
                placeholder="Target replacement behavior..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>Save Behavior</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setForm(emptyForm); }}>Cancel</Button>
          </div>
        </Section>
      )}

      {!loading && behaviors.length > 0 && (
        <Section title="Filters">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Client</label>
              <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">All Clients</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Behavior</label>
              <select value={filterBehavior} onChange={(e) => setFilterBehavior(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">All Behaviors</option>
                {BEHAVIOR_NAMES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Intensity</label>
              <select value={filterIntensity} onChange={(e) => setFilterIntensity(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">All Intensities</option>
                {INTENSITIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">From Date</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">To Date</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2">
            {filtersActive && (
              <button onClick={() => { setFilterClient(""); setFilterBehavior(""); setFilterIntensity(""); setDateFrom(""); setDateTo(""); }}
                className="text-sm text-gray-400 hover:text-gray-600 underline">
                Clear filters
              </button>
            )}
            <p className="text-sm text-gray-400">{filtered.length} records</p>
          </div>
        </Section>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <Section title="Behavior Log">
          <p className="text-gray-400 text-sm">No behaviors logged yet.</p>
        </Section>
      )}

      <div className="space-y-3">
        {filtered.map((b) => (
          <div key={b.id} className="border border-gray-100 rounded-xl p-4 bg-white">
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <p className="font-semibold text-gray-800">{b.behavior_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {clientMap.get(b.client_id) ?? "Unknown"} · {b.staff_member} · {new Date(b.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {b.intensity && (
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${intensityColor(b.intensity)}`}>{b.intensity}</span>
                )}
                {b.frequency && (
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">{b.frequency}</span>
                )}
                {b.duration && (
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-600">{b.duration}</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-sm text-gray-600">
              {b.antecedent && <p><span className="font-medium">A:</span> {b.antecedent}</p>}
              {b.behavior && <p><span className="font-medium">B:</span> {b.behavior}</p>}
              {b.consequence && <p><span className="font-medium">C:</span> {b.consequence}</p>}
              {b.function_hypothesis && <p><span className="font-medium">Function:</span> {b.function_hypothesis}</p>}
              {b.intervention_used && <p><span className="font-medium">Intervention:</span> {b.intervention_used}</p>}
              {b.replacement_behavior && <p><span className="font-medium">Replacement:</span> {b.replacement_behavior}</p>}
            </div>
            <div className="mt-3">
              <Button variant="outline" onClick={() => window.location.href = `/dashboard/clients/${b.client_id}/case`}>
                View Case
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}