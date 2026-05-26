"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type TrainingItem = {
  id: string;
  client_id: string;
  title: string;
  content: string | null;
  category: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
};

const CATEGORIES = [
  "Reinforcement Strategies",
  "Behavior Management",
  "Communication Support",
  "Daily Living Skills",
  "Crisis Prevention",
  "Data Collection",
  "ABA Basics",
  "Generalization Strategies",
  "School Collaboration",
  "Other",
];

const TEMPLATES = [
  {
    title: "Introduction to ABA",
    category: "ABA Basics",
    content: `Applied Behavior Analysis (ABA) is a scientific approach to understanding and changing behavior. Key principles:

1. Reinforcement: Adding something positive or removing something negative to increase a behavior
2. Antecedent-Behavior-Consequence (ABC): Understanding what happens before and after behaviors
3. Prompting: Providing assistance to help your child complete tasks
4. Generalization: Helping skills occur across different settings and people

Your role as a caregiver is essential. Consistency between home and therapy is one of the most powerful tools for your child's success.`,
  },
  {
    title: "How to Use a Token Economy",
    category: "Reinforcement Strategies",
    content: `A token economy is a system where your child earns tokens for positive behaviors, which can be exchanged for rewards.

Steps:
1. Choose tokens (stickers, chips, points)
2. Identify target behaviors to reinforce
3. Decide how many tokens = a reward
4. Be consistent — give tokens immediately after the behavior
5. Use a visual chart your child can see

Tips:
- Start easy so your child experiences success early
- Gradually increase requirements as skills improve
- Let your child help choose the rewards`,
  },
  {
    title: "Handling Tantrums at Home",
    category: "Behavior Management",
    content: `When a tantrum occurs:

1. Stay calm — your calm response models regulation
2. Ensure safety first — remove dangerous items
3. Use planned ignoring for attention-maintained behavior
4. Do NOT give in to demands during a tantrum
5. Wait for a calm moment to problem-solve

Prevention strategies:
- Use visual schedules to prepare for transitions
- Offer choices to increase control
- Identify early warning signs and intervene early
- Ensure basic needs are met (hungry, tired, overstimulated)

After the tantrum: Acknowledge feelings, review what happened, practice replacement skills.`,
  },
  {
    title: "Supporting Communication at Home",
    category: "Communication Support",
    content: `Ways to support your child's communication:

1. Follow their lead — respond to what they show interest in
2. Expand their language — add one word to what they say
3. Create opportunities — don't anticipate every need
4. Use visual supports — pictures, schedules, first-then boards
5. Reinforce all communication attempts

If your child uses AAC (device/PECS):
- Have it available at ALL times
- Model using it yourself
- Respond to every communication attempt
- Never take it away as punishment`,
  },
];

const emptyForm = {
  client_id: "",
  title: "",
  content: "",
  category: "",
};

export default function CaregiverTrainingPage() {
  const [items, setItems] = useState<TrainingItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: trainingData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
      supabase.from("caregiver_training").select("*").eq("created_by", user.id).order("created_at", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setItems(trainingData ?? []);
    setLoading(false);
  }

  function useTemplate(template: typeof TEMPLATES[0]) {
    setForm({ ...form, title: template.title, content: template.content, category: template.category });
  }

  async function handleSave() {
    if (!form.client_id || !form.title) { setError("Client and title are required."); return; }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error: saveError } = await supabase.from("caregiver_training").insert([{
      ...form,
      created_by: user.id,
    }]).select().single();

    if (saveError) { setError(saveError.message); setSaving(false); return; }

    setItems((prev) => [data, ...prev]);
    setForm(emptyForm);
    setShowForm(false);
    setSaving(false);
  }

  async function toggleComplete(id: string, completed: boolean) {
    await supabase.from("caregiver_training").update({
      completed: !completed,
      completed_at: !completed ? new Date().toISOString() : null,
    }).eq("id", id);

    setItems((prev) => prev.map((item) => item.id === id ? {
      ...item,
      completed: !completed,
      completed_at: !completed ? new Date().toISOString() : null,
    } : item));
  }

  async function handleDelete(id: string) {
    await supabase.from("caregiver_training").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  let filtered = items;
  if (filterClient) filtered = filtered.filter((i) => i.client_id === filterClient);
  if (filterCategory) filtered = filtered.filter((i) => i.category === filterCategory);

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));
  const completedCount = items.filter((i) => i.completed).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Caregiver Training">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add Training Material"}
        </Button>
      </PageHeader>

      {/* STATS */}
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="border rounded-lg p-4 text-center bg-white">
            <p className="text-2xl font-bold text-blue-600">{items.length}</p>
            <p className="text-xs text-gray-500 mt-1">Total Materials</p>
          </div>
          <div className="border rounded-lg p-4 text-center bg-white">
            <p className="text-2xl font-bold text-green-600">{completedCount}</p>
            <p className="text-xs text-gray-500 mt-1">Completed</p>
          </div>
          <div className="border rounded-lg p-4 text-center bg-white">
            <p className="text-2xl font-bold text-orange-500">{items.length - completedCount}</p>
            <p className="text-xs text-gray-500 mt-1">Pending</p>
          </div>
        </div>
      )}

      {showForm && (
        <Section title="Add Training Material">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          {/* TEMPLATES */}
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Quick Templates</p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button key={t.title} onClick={() => useTemplate(t)}
                  className="text-xs px-3 py-1.5 border border-blue-200 text-blue-600 rounded-full hover:bg-blue-50 transition-colors">
                  {t.title}
                </button>
              ))}
            </div>
          </div>

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
              <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select category...</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Title *</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Training material title" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Content</label>
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Training content, instructions, or notes..." rows={6}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>Save Material</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* FILTERS */}
      {!loading && items.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center">
          <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <p className="text-sm text-gray-400">{filtered.length} materials</p>
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <Section title="Training Materials">
          <p className="text-gray-400 text-sm">No training materials yet.</p>
        </Section>
      )}

      <div className="space-y-3">
        {filtered.map((item) => {
          const isExpanded = expandedId === item.id;
          return (
            <div key={item.id} className={`border rounded-xl bg-white ${item.completed ? "border-green-200" : "border-gray-100"}`}>
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3 flex-1">
                    <button onClick={() => toggleComplete(item.id, item.completed)}
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${item.completed ? "bg-green-500 border-green-500 text-white" : "border-gray-300"}`}>
                      {item.completed && "✓"}
                    </button>
                    <div className="flex-1">
                      <p className={`font-semibold ${item.completed ? "line-through text-gray-400" : "text-gray-800"}`}>{item.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {clientMap.get(item.client_id) ?? "Unknown"}
                        {item.category && ` · ${item.category}`}
                        {item.completed && item.completed_at && ` · Completed ${new Date(item.completed_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <button onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="text-xs text-gray-400 hover:text-gray-600">
                      {isExpanded ? "▲" : "▼"}
                    </button>
                    <button onClick={() => handleDelete(item.id)}
                      className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                  </div>
                </div>

                {isExpanded && item.content && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                      {item.content}
                    </pre>
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