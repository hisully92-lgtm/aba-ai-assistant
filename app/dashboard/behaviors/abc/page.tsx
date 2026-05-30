"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type ABCRecord = {
  id: string;
  client_id: string;
  behavior_name: string;
  antecedent: string;
  notes: string;
  consequence: string;
  created_at: string;
};

const ANTECEDENTS = [
  "Demand presented", "Attention removed", "Preferred item removed",
  "Transition", "Peer interaction", "Alone", "Loud environment",
  "Non-preferred task", "Unstructured time", "Other"
];

const BEHAVIORS = [
  "Aggression", "Self-Injurious Behavior", "Elopement",
  "Property Destruction", "Tantrum", "Non-Compliance",
  "Vocal Disruption", "Stereotypy", "Other"
];

const CONSEQUENCES = [
  "Escape from demand", "Adult attention", "Peer attention",
  "Access to preferred item", "Sensory stimulation", "No reaction",
  "Redirection", "Response blocking", "Other"
];

export default function ABCPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [records, setRecords] = useState<ABCRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [filterClient, setFilterClient] = useState("");

  const [clientId, setClientId] = useState("");
  const [behavior, setBehavior] = useState("");
  const [antecedent, setAntecedent] = useState("");
  const [consequence, setConsequence] = useState("");
  const [notes, setNotes] = useState("");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: abcData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
      supabase.from("behaviors").select("*").eq("recording_method", "abc")
        .eq("created_by", user.id).order("created_at", { ascending: false }).limit(50),
    ]);

    setClients(clientData ?? []);
    setRecords(abcData ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!clientId || !behavior || !antecedent || !consequence) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error } = await supabase.from("behaviors").insert([{
      client_id: clientId,
      behavior_name: behavior,
      antecedent,
      consequence,
      notes,
      recording_method: "abc",
      created_by: user.id,
    }]).select().single();

    if (!error && data) {
      setRecords(prev => [data, ...prev]);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      setBehavior(""); setAntecedent(""); setConsequence(""); setNotes("");
    }
    setSaving(false);
  }

  const clientMap = new Map(clients.map(c => [c.id, c.full_name]));
  const filtered = filterClient ? records.filter(r => r.client_id === filterClient) : records;

  // Function analysis — count most common antecedents and consequences
  const antecedentCounts = filtered.reduce((acc, r) => {
    acc[r.antecedent] = (acc[r.antecedent] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const consequenceCounts = filtered.reduce((acc, r) => {
    acc[r.consequence] = (acc[r.consequence] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topAntecedent = Object.entries(antecedentCounts).sort((a, b) => b[1] - a[1])[0];
  const topConsequence = Object.entries(consequenceCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-6">
      <PageHeader title="ABC Data Collection" />

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          ABC record saved successfully.
        </div>
      )}

      {/* ABC FORM */}
      <Section title="Record ABC Data">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">Select client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Date</label>
            <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* ANTECEDENT */}
          <div className="border-2 border-blue-200 rounded-xl p-4 bg-blue-50">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">A — Antecedent</p>
            <p className="text-xs text-blue-500 mb-3">What happened right before?</p>
            <div className="space-y-1 mb-3">
              {ANTECEDENTS.map(a => (
                <button key={a} onClick={() => setAntecedent(a)}
                  className={`w-full text-left text-xs px-2 py-1.5 rounded-lg transition-colors ${antecedent === a ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-blue-100"}`}>
                  {a}
                </button>
              ))}
            </div>
            {antecedent && <p className="text-xs text-blue-700 font-medium">Selected: {antecedent}</p>}
          </div>

          {/* BEHAVIOR */}
          <div className="border-2 border-red-200 rounded-xl p-4 bg-red-50">
            <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">B — Behavior</p>
            <p className="text-xs text-red-500 mb-3">What behavior occurred?</p>
            <div className="space-y-1 mb-3">
              {BEHAVIORS.map(b => (
                <button key={b} onClick={() => setBehavior(b)}
                  className={`w-full text-left text-xs px-2 py-1.5 rounded-lg transition-colors ${behavior === b ? "bg-red-600 text-white" : "bg-white text-gray-700 hover:bg-red-100"}`}>
                  {b}
                </button>
              ))}
            </div>
            {behavior && <p className="text-xs text-red-700 font-medium">Selected: {behavior}</p>}
          </div>

          {/* CONSEQUENCE */}
          <div className="border-2 border-green-200 rounded-xl p-4 bg-green-50">
            <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">C — Consequence</p>
            <p className="text-xs text-green-500 mb-3">What happened after?</p>
            <div className="space-y-1 mb-3">
              {CONSEQUENCES.map(c => (
                <button key={c} onClick={() => setConsequence(c)}
                  className={`w-full text-left text-xs px-2 py-1.5 rounded-lg transition-colors ${consequence === c ? "bg-green-600 text-white" : "bg-white text-gray-700 hover:bg-green-100"}`}>
                  {c}
                </button>
              ))}
            </div>
            {consequence && <p className="text-xs text-green-700 font-medium">Selected: {consequence}</p>}
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium text-gray-700 mb-1 block">Additional Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Any additional context or observations..." rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>

        <div className="mt-4">
          <Button onClick={handleSave} loading={saving}
            disabled={!clientId || !behavior || !antecedent || !consequence}>
            Save ABC Record
          </Button>
        </div>
      </Section>

      {/* FUNCTION ANALYSIS */}
      {filtered.length >= 3 && (
        <Section title="Function Analysis">
          <p className="text-xs text-gray-500 mb-4">Based on {filtered.length} recorded observations</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-700 mb-2">Most Common Antecedent</p>
              {topAntecedent && (
                <>
                  <p className="font-bold text-blue-800">{topAntecedent[0]}</p>
                  <p className="text-xs text-blue-600 mt-1">{topAntecedent[1]} occurrences ({Math.round(topAntecedent[1] / filtered.length * 100)}%)</p>
                </>
              )}
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-green-700 mb-2">Most Common Consequence</p>
              {topConsequence && (
                <>
                  <p className="font-bold text-green-800">{topConsequence[0]}</p>
                  <p className="text-xs text-green-600 mt-1">{topConsequence[1]} occurrences ({Math.round(topConsequence[1] / filtered.length * 100)}%)</p>
                </>
              )}
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-600 mb-2">Antecedent Breakdown</p>
            <div className="space-y-1">
              {Object.entries(antecedentCounts).sort((a, b) => b[1] - a[1]).map(([ant, count]) => (
                <div key={ant} className="flex items-center gap-2">
                  <p className="text-xs text-gray-600 w-48 truncate">{ant}</p>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${(count / filtered.length) * 100}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 w-8 text-right">{count}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* RECORDS */}
      <Section title="ABC Records">
        {clients.length > 0 && (
          <div className="mb-4">
            <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">All Clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
        )}

        {loading && <p className="text-gray-400 text-sm">Loading...</p>}
        {!loading && filtered.length === 0 && <p className="text-gray-400 text-sm">No ABC records yet.</p>}

        <div className="space-y-3">
          {filtered.map(record => (
            <div key={record.id} className="border border-gray-100 rounded-xl p-4 bg-white">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold text-gray-800">{clientMap.get(record.client_id) ?? "Unknown"}</p>
                  <p className="text-xs text-gray-400">{new Date(record.created_at).toLocaleDateString()}</p>
                </div>
                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">{record.behavior_name}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="bg-blue-50 rounded-lg p-2">
                  <p className="font-semibold text-blue-700 mb-1">Antecedent</p>
                  <p className="text-gray-700">{record.antecedent}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-2">
                  <p className="font-semibold text-red-700 mb-1">Behavior</p>
                  <p className="text-gray-700">{record.behavior_name}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <p className="font-semibold text-green-700 mb-1">Consequence</p>
                  <p className="text-gray-700">{record.consequence}</p>
                </div>
              </div>
              {record.notes && <p className="text-xs text-gray-500 mt-2 italic">{record.notes}</p>}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}