"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type Profile = { id: string; full_name: string | null };
type FidelityItem = { step: string; completed: boolean; notes: string };
type FidelityRecord = {
  id: string;
  client_id: string;
  staff_id: string;
  program_name: string;
  checklist_items: FidelityItem[];
  overall_score: number;
  session_date: string;
  notes: string;
  created_at: string;
};

const PROGRAM_NAMES = ["Mand Training", "Tact Training", "DTT", "NET", "Task Analysis", "Social Skills", "Daily Living Skills", "Other"];

const DEFAULT_CHECKLIST: Record<string, string[]> = {
  "DTT": [
    "Materials prepared before session",
    "Clear SD presented",
    "3-second wait for response",
    "Correct response reinforced immediately",
    "Error correction procedure followed",
    "Data recorded after each trial",
    "Inter-trial interval maintained",
    "Reinforcer varied appropriately",
  ],
  "Mand Training": [
    "Motivation established (MO in effect)",
    "Waited for spontaneous mand",
    "Prompt used if needed",
    "Reinforcer delivered immediately",
    "Transfer trial conducted",
    "Data recorded",
  ],
  "NET": [
    "Child-led activity identified",
    "Materials accessible",
    "Teaching embedded naturally",
    "Reinforcement contingent on target",
    "Data collected",
    "Session felt natural/play-based",
  ],
};

export default function FidelityPage() {
  const [records, setRecords] = useState<FidelityRecord[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterClient, setFilterClient] = useState("");

  const [clientId, setClientId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [programName, setProgramName] = useState("");
  const [checklist, setChecklist] = useState<FidelityItem[]>([]);
  const [customStep, setCustomStep] = useState("");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: profileData }, { data: recData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
      supabase.from("profiles").select("id, full_name"),
      supabase.from("program_fidelity").select("*").eq("created_by", user.id).order("created_at", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setProfiles(profileData ?? []);
    setRecords((recData ?? []).map((r: any) => ({ ...r, checklist_items: Array.isArray(r.checklist_items) ? r.checklist_items : JSON.parse(r.checklist_items || "[]") })));
    setLoading(false);
  }

  function handleProgramSelect(program: string) {
    setProgramName(program);
    const defaults = DEFAULT_CHECKLIST[program];
    if (defaults) {
      setChecklist(defaults.map((step) => ({ step, completed: false, notes: "" })));
    } else {
      setChecklist([]);
    }
  }

  function toggleItem(index: number) {
    setChecklist((prev) => prev.map((item, i) => i === index ? { ...item, completed: !item.completed } : item));
  }

  function updateItemNotes(index: number, notes: string) {
    setChecklist((prev) => prev.map((item, i) => i === index ? { ...item, notes } : item));
  }

  function addCustomStep() {
    if (!customStep.trim()) return;
    setChecklist((prev) => [...prev, { step: customStep.trim(), completed: false, notes: "" }]);
    setCustomStep("");
  }

  function removeStep(index: number) {
    setChecklist((prev) => prev.filter((_, i) => i !== index));
  }

  function calculateScore() {
    if (!checklist.length) return 0;
    return Math.round((checklist.filter((i) => i.completed).length / checklist.length) * 100);
  }

  async function handleSave() {
    if (!clientId || !programName || checklist.length === 0) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const score = calculateScore();

    const { data, error } = await supabase.from("program_fidelity").insert([{
      client_id: clientId,
      staff_id: staffId || null,
      program_name: programName,
      checklist_items: JSON.stringify(checklist),
      overall_score: score,
      session_date: sessionDate,
      notes,
      created_by: user.id,
    }]).select().single();

    if (!error && data) {
      setRecords((prev) => [{ ...data, checklist_items: checklist }, ...prev]);
      setShowForm(false);
      setClientId(""); setStaffId(""); setProgramName(""); setChecklist([]); setNotes("");
    }
    setSaving(false);
  }

  const filtered = filterClient ? records.filter((r) => r.client_id === filterClient) : records;
  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));
  const profileMap = new Map(profiles.map((p) => [p.id, p.full_name ?? "Unknown"]));

  function scoreColor(score: number) {
    if (score >= 80) return "bg-green-100 text-green-700";
    if (score >= 60) return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-700";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Program Fidelity">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Fidelity Check"}
        </Button>
      </PageHeader>

      {showForm && (
        <Section title="Fidelity Checklist">
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
              <label className="text-sm font-medium text-gray-700 mb-1 block">Staff Member</label>
              <select value={staffId} onChange={(e) => setStaffId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select staff...</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Program *</label>
              <select value={programName} onChange={(e) => handleProgramSelect(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select program...</option>
                {PROGRAM_NAMES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Session Date</label>
              <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          {checklist.length > 0 && (
            <div className="space-y-2 mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-gray-700">Checklist ({calculateScore()}% complete)</label>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                <div className={`h-2 rounded-full transition-all ${calculateScore() >= 80 ? "bg-green-500" : calculateScore() >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                  style={{ width: `${calculateScore()}%` }} />
              </div>
              {checklist.map((item, i) => (
                <div key={i} className={`border rounded-lg p-3 transition-all ${item.completed ? "border-green-200 bg-green-50" : "border-gray-200"}`}>
                  <div className="flex items-start gap-3">
                    <button onClick={() => toggleItem(i)}
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${item.completed ? "bg-green-500 border-green-500 text-white" : "border-gray-300"}`}>
                      {item.completed && "✓"}
                    </button>
                    <div className="flex-1">
                      <p className={`text-sm ${item.completed ? "line-through text-gray-400" : "text-gray-700"}`}>{item.step}</p>
                      {item.completed && (
                        <input type="text" value={item.notes} onChange={(e) => updateItemNotes(i, e.target.value)}
                          placeholder="Optional notes..."
                          className="mt-1 w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
                      )}
                    </div>
                    <button onClick={() => removeStep(i)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 mb-4">
            <input type="text" value={customStep} onChange={(e) => setCustomStep(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomStep()}
              placeholder="Add custom checklist step..."
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <Button variant="outline" onClick={addCustomStep}>Add Step</Button>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving} disabled={!clientId || !programName || checklist.length === 0}>
              Save Fidelity Check
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* FILTER */}
      {!loading && records.length > 0 && (
        <div className="flex gap-3 items-center">
          <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <p className="text-sm text-gray-400">{filtered.length} records</p>
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <Section title="Fidelity Records">
          <p className="text-gray-400 text-sm">No fidelity checks yet.</p>
        </Section>
      )}

      <div className="space-y-3">
        {filtered.map((r) => (
          <div key={r.id} className="border border-gray-100 rounded-xl p-4 bg-white">
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <p className="font-semibold text-gray-800">{r.program_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {clientMap.get(r.client_id) ?? "Unknown"} · {profileMap.get(r.staff_id)} · {r.session_date}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${scoreColor(r.overall_score)}`}>
                {r.overall_score}% fidelity
              </span>
            </div>
            <div className="mt-3 w-full bg-gray-100 rounded-full h-2">
              <div className={`h-2 rounded-full ${r.overall_score >= 80 ? "bg-green-500" : r.overall_score >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                style={{ width: `${r.overall_score}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
              {r.checklist_items.map((item, i) => (
                <div key={i} className={`text-xs p-2 rounded-lg border ${item.completed ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-600"}`}>
                  {item.completed ? "✓" : "✗"} {item.step}
                </div>
              ))}
            </div>
            {r.notes && <p className="text-xs text-gray-500 mt-2">{r.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}