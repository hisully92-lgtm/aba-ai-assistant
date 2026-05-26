"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type HomeEntry = {
  id: string;
  client_id: string;
  program_name: string;
  target: string;
  trials_correct: number;
  trials_total: number;
  notes: string | null;
  entry_date: string;
  created_at: string;
};

export default function HomeProgramPage() {
  const [entries, setEntries] = useState<HomeEntry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterClient, setFilterClient] = useState("");

  const [clientId, setClientId] = useState("");
  const [programName, setProgramName] = useState("");
  const [target, setTarget] = useState("");
  const [trialsCorrect, setTrialsCorrect] = useState(0);
  const [trialsTotal, setTrialsTotal] = useState(10);
  const [notes, setNotes] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: entryData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
      supabase.from("home_program_data").select("*").eq("created_by", user.id).order("entry_date", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setEntries(entryData ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!clientId || !programName) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("home_program_data").insert([{
      client_id: clientId,
      program_name: programName,
      target,
      trials_correct: trialsCorrect,
      trials_total: trialsTotal,
      notes: notes || null,
      entry_date: entryDate,
      created_by: user.id,
    }]).select().single();

    if (data) setEntries((prev) => [data, ...prev]);
    setShowForm(false);
    setProgramName(""); setTarget(""); setTrialsCorrect(0); setTrialsTotal(10); setNotes("");
    setSaving(false);
  }

  const filtered = filterClient ? entries.filter((e) => e.client_id === filterClient) : entries;
  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  function accuracy(correct: number, total: number) {
    if (!total) return 0;
    return Math.round((correct / total) * 100);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Home Program Data">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Log Home Practice"}
        </Button>
      </PageHeader>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
        📋 Parents and caregivers can log home practice data here to bridge therapy and home environments.
      </div>

      {showForm && (
        <Section title="Log Home Practice">
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
              <label className="text-sm font-medium text-gray-700 mb-1 block">Date</label>
              <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Program Name *</label>
              <input type="text" value={programName} onChange={(e) => setProgramName(e.target.value)}
                placeholder="e.g. Hand Washing, Colors" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Target</label>
              <input type="text" value={target} onChange={(e) => setTarget(e.target.value)}
                placeholder="Specific target" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Correct Trials</label>
              <input type="number" min={0} value={trialsCorrect} onChange={(e) => setTrialsCorrect(parseInt(e.target.value) || 0)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Total Trials</label>
              <input type="number" min={0} value={trialsTotal} onChange={(e) => setTrialsTotal(parseInt(e.target.value) || 0)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                placeholder="How did practice go? Any observations?" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving} disabled={!clientId || !programName}>Log Practice</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* FILTER */}
      {!loading && entries.length > 0 && (
        <div className="flex gap-3 items-center">
          <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <p className="text-sm text-gray-400">{filtered.length} entries</p>
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <Section title="Home Practice Log">
          <p className="text-gray-400 text-sm">No home practice entries yet.</p>
        </Section>
      )}

      <div className="space-y-3">
        {filtered.map((entry) => {
          const pct = accuracy(entry.trials_correct, entry.trials_total);
          return (
            <div key={entry.id} className="border border-gray-100 rounded-xl p-4 bg-white">
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <p className="font-semibold text-gray-800">{entry.program_name}{entry.target && ` — ${entry.target}`}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {clientMap.get(entry.client_id) ?? "Unknown"} · {entry.entry_date}
                  </p>
                  {entry.notes && <p className="text-xs text-gray-500 mt-1">{entry.notes}</p>}
                </div>
                <div className="flex gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${pct >= 80 ? "bg-green-100 text-green-700" : pct >= 60 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                    {pct}% ({entry.trials_correct}/{entry.trials_total})
                  </span>
                </div>
              </div>
              <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full ${pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                  style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}