"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type AssessmentItem = { name: string; category: string; selected: number; presented: number };
type Assessment = {
  id: string;
  client_id: string;
  assessment_type: string;
  items: AssessmentItem[];
  top_preferences: string[];
  session_date: string;
  notes: string | null;
  created_at: string;
};

const ASSESSMENT_TYPES = [
  { value: "free_operant", label: "Free Operant (FOPA)", desc: "Observe what client naturally approaches in free play" },
  { value: "single_stimulus", label: "Single Stimulus (SS)", desc: "Present one item at a time, record approach/avoidance" },
  { value: "paired_stimulus", label: "Paired Stimulus (PS)", desc: "Present two items, record which is chosen" },
  { value: "multiple_stimulus_without", label: "Multiple Stimulus Without Replacement (MSWO)", desc: "Present array, remove selected items" },
  { value: "multiple_stimulus_with", label: "Multiple Stimulus With Replacement (MSW)", desc: "Present array, replace selected items" },
];

const DEFAULT_ITEMS = [
  { name: "iPad / Tablet", category: "Technology" },
  { name: "Bubbles", category: "Sensory" },
  { name: "Playdough", category: "Tactile" },
  { name: "Blocks", category: "Construction" },
  { name: "Cars/Trucks", category: "Toys" },
  { name: "Stickers", category: "Art" },
  { name: "Books", category: "Academic" },
  { name: "Music/Songs", category: "Auditory" },
  { name: "Snacks", category: "Edibles" },
  { name: "Puzzle", category: "Cognitive" },
  { name: "Swing", category: "Gross Motor" },
  { name: "Play-Doh", category: "Tactile" },
  { name: "Drawing/Coloring", category: "Art" },
  { name: "Social Praise", category: "Social" },
  { name: "Tickles/Physical", category: "Social" },
  { name: "Video/Movies", category: "Technology" },
];

export default function PreferenceAssessmentPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterClient, setFilterClient] = useState("");

  const [clientId, setClientId] = useState("");
  const [assessmentType, setAssessmentType] = useState("multiple_stimulus_without");
  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [customItem, setCustomItem] = useState("");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [activeSession, setActiveSession] = useState(false);
  const [currentPair, setCurrentPair] = useState<[number, number]>([0, 1]);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: assessData }] = await Promise.all([
      supabase.from("clients").select("id, full_name"),
      supabase.from("preference_assessments").select("*").eq("created_by", user.id).order("created_at", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setAssessments((assessData ?? []).map((a: any) => ({
      ...a,
      items: Array.isArray(a.items) ? a.items : JSON.parse(a.items || "[]"),
      top_preferences: Array.isArray(a.top_preferences) ? a.top_preferences : JSON.parse(a.top_preferences || "[]"),
    })));
    setLoading(false);
  }

  function initItems() {
    setItems(DEFAULT_ITEMS.map((item) => ({ ...item, selected: 0, presented: 0 })));
  }

  function addCustomItem() {
    if (!customItem.trim()) return;
    setItems((prev) => [...prev, { name: customItem.trim(), category: "Custom", selected: 0, presented: 0 }]);
    setCustomItem("");
  }

  function toggleItem(name: string) {
    setItems((prev) => prev.map((item) =>
      item.name === name ? { ...item, selected: item.presented > 0 ? item.selected : -1 } : item
    ));
  }

  function startSession() {
    setActiveSession(true);
    setCurrentPair([0, 1]);
    setItems((prev) => prev.map((item) => ({ ...item, selected: 0, presented: 0 })));
  }

  function selectItem(index: number) {
    const [a, b] = currentPair;
    setItems((prev) => prev.map((item, i) => {
      if (i === a || i === b) return { ...item, presented: item.presented + 1, selected: i === index ? item.selected + 1 : item.selected };
      return item;
    }));

    // Advance to next pair
    const nextB = b + 1;
    if (nextB >= items.length) {
      const nextA = a + 1;
      if (nextA >= items.length - 1) {
        setActiveSession(false);
        return;
      }
      setCurrentPair([nextA, nextA + 1]);
    } else {
      setCurrentPair([a, nextB]);
    }
  }

  function recordFreeOperant(name: string) {
    setItems((prev) => prev.map((item) =>
      item.name === name ? { ...item, selected: item.selected + 1, presented: item.presented + 1 } : item
    ));
  }

  function getTopPreferences(count: number = 5): string[] {
    return [...items]
      .filter((i) => i.presented > 0)
      .sort((a, b) => (b.selected / b.presented) - (a.selected / a.presented))
      .slice(0, count)
      .map((i) => i.name);
  }

  async function handleSave() {
    if (!clientId || !assessmentType) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const topPrefs = getTopPreferences();

    const { data } = await supabase.from("preference_assessments").insert([{
      client_id: clientId,
      assessment_type: assessmentType,
      items: JSON.stringify(items),
      results: JSON.stringify(items),
      top_preferences: JSON.stringify(topPrefs),
      session_date: sessionDate,
      notes: notes || null,
      created_by: user.id,
    }]).select().single();

    if (data) setAssessments((prev) => [{ ...data, items, top_preferences: topPrefs }, ...prev]);
    setShowForm(false);
    setClientId(""); setItems([]); setNotes(""); setActiveSession(false);
    setSaving(false);
  }

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));
  const filtered = filterClient ? assessments.filter((a) => a.client_id === filterClient) : assessments;

  function preferenceColor(pct: number) {
    if (pct >= 80) return "bg-green-500";
    if (pct >= 60) return "bg-yellow-500";
    if (pct >= 40) return "bg-orange-400";
    return "bg-red-400";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Preference Assessments">
        <Button onClick={() => { setShowForm(!showForm); if (!showForm) initItems(); }}>
          {showForm ? "Cancel" : "+ New Assessment"}
        </Button>
      </PageHeader>

      {showForm && (
        <Section title="Preference Assessment">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Assessment Date</label>
              <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <label className="text-sm font-medium text-gray-700 block">Assessment Type</label>
            {ASSESSMENT_TYPES.map((type) => (
              <button key={type.value} onClick={() => setAssessmentType(type.value)}
                className={`w-full text-left border-2 rounded-xl p-3 transition-all ${assessmentType === type.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}>
                <p className="text-sm font-semibold text-gray-800">{type.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{type.desc}</p>
              </button>
            ))}
          </div>

          {/* ITEM SELECTION */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">Stimulus Items ({items.length})</label>
              <div className="flex gap-2">
                <input type="text" value={customItem} onChange={(e) => setCustomItem(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomItem()}
                  placeholder="Add custom item..."
                  className="border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
                <Button variant="outline" onClick={addCustomItem}>Add</Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {items.map((item) => (
                <div key={item.name} className="text-xs px-3 py-1.5 rounded-full border bg-white text-gray-700 border-gray-200">
                  {item.name}
                  {item.presented > 0 && (
                    <span className="ml-1 font-bold text-blue-600">
                      {Math.round((item.selected / item.presented) * 100)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* LIVE ASSESSMENT */}
          {assessmentType === "free_operant" && (
            <Section title="Free Operant Recording — Tap items as client approaches">
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                {items.map((item) => (
                  <button key={item.name} onClick={() => recordFreeOperant(item.name)}
                    className="border-2 rounded-xl p-3 text-center hover:border-blue-400 transition-all bg-white active:scale-95">
                    <p className="text-sm font-medium text-gray-800">{item.name}</p>
                    <p className="text-lg font-bold text-blue-600 mt-1">{item.selected}</p>
                    <p className="text-xs text-gray-400">approaches</p>
                  </button>
                ))}
              </div>
            </Section>
          )}

          {assessmentType === "paired_stimulus" && !activeSession && (
            <Button onClick={startSession}>▶ Start Paired Stimulus Session</Button>
          )}

          {assessmentType === "paired_stimulus" && activeSession && currentPair[0] < items.length && (
            <Section title="Choose the preferred item:">
              <div className="grid grid-cols-2 gap-4">
                {currentPair.map((idx) => (
                  <button key={idx} onClick={() => selectItem(idx)}
                    className="border-2 border-gray-200 hover:border-blue-500 rounded-2xl p-8 text-center bg-white active:scale-95 transition-all">
                    <p className="text-xl font-bold text-gray-800">{items[idx]?.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{items[idx]?.category}</p>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3 text-center">
                Pair {currentPair[0] + 1}-{currentPair[1] + 1} of {items.length}
              </p>
            </Section>
          )}

          {/* TOP PREFERENCES PREVIEW */}
          {items.some((i) => i.presented > 0) && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Current Top Preferences:</p>
              <div className="flex flex-wrap gap-2">
                {getTopPreferences(5).map((pref, i) => (
                  <span key={pref} className={`text-xs px-3 py-1.5 rounded-full text-white font-medium ${i === 0 ? "bg-green-500" : i === 1 ? "bg-blue-500" : i === 2 ? "bg-yellow-500" : "bg-gray-400"}`}>
                    {i + 1}. {pref}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving} disabled={!clientId}>Save Assessment</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* FILTER */}
      {!loading && assessments.length > 0 && (
        <div className="flex gap-3 items-center">
          <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <p className="text-sm text-gray-400">{filtered.length} assessments</p>
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}

      <div className="space-y-3">
        {filtered.map((assessment) => (
          <div key={assessment.id} className="border border-gray-100 rounded-xl p-4 bg-white">
            <p className="font-semibold text-gray-800">{clientMap.get(assessment.client_id) ?? "Unknown"}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {ASSESSMENT_TYPES.find((t) => t.value === assessment.assessment_type)?.label} · {assessment.session_date}
            </p>
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-600 mb-2">Top Preferences:</p>
              <div className="flex flex-wrap gap-2">
                {assessment.top_preferences.map((pref, i) => (
                  <span key={pref} className={`text-xs px-3 py-1 rounded-full text-white font-medium ${i === 0 ? "bg-green-500" : i === 1 ? "bg-blue-500" : i === 2 ? "bg-yellow-500" : "bg-gray-400"}`}>
                    {i + 1}. {pref}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}