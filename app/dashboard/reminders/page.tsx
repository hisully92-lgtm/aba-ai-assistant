"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type Reminder = {
  id: string;
  client_id: string | null;
  title: string;
  message: string | null;
  remind_at: string;
  sent: boolean;
  created_at: string;
};

const emptyForm = {
  client_id: "",
  title: "",
  message: "",
  remind_at: "",
};

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: reminderData }, { data: clientData }] = await Promise.all([
      supabase.from("reminders").select("*").eq("user_id", user.id).order("remind_at", { ascending: true }),
      supabase.from("clients").select("id, full_name"),
    ]);

    setReminders(reminderData ?? []);
    setClients(clientData ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.title || !form.remind_at) {
      setError("Title and reminder time are required.");
      return;
    }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error: saveError } = await supabase
      .from("reminders")
      .insert([{
        user_id: user.id,
        client_id: form.client_id || null,
        title: form.title,
        message: form.message || null,
        remind_at: form.remind_at,
        sent: false,
      }])
      .select()
      .single();

    if (saveError) { setError(saveError.message); setSaving(false); return; }

    setReminders((prev) => [...prev, data].sort((a, b) =>
      new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime()
    ));
    setForm(emptyForm);
    setShowForm(false);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from("reminders").delete().eq("id", id);
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));
  const upcoming = reminders.filter((r) => new Date(r.remind_at) > new Date());
  const past = reminders.filter((r) => new Date(r.remind_at) <= new Date());

  function isUrgent(remind_at: string) {
    const diff = new Date(remind_at).getTime() - Date.now();
    return diff > 0 && diff < 24 * 60 * 60 * 1000;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reminders">
        <p className="text-gray-500 text-sm">Appointment and clinical reminders.</p>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add Reminder"}
        </Button>
      </PageHeader>

      {showForm && (
        <Section title="New Reminder">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Title *</label>
              <input type="text" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Session with John Doe"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client</label>
              <select value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">No client</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Remind At *</label>
              <input type="datetime-local" value={form.remind_at}
                onChange={(e) => setForm({ ...form, remind_at: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Message</label>
              <input type="text" value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Optional details..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>Save Reminder</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setForm(emptyForm); }}>Cancel</Button>
          </div>
        </Section>
      )}

      <Section title={`Upcoming (${upcoming.length})`}>
        {loading && <p className="text-gray-400 text-sm">Loading...</p>}
        {!loading && upcoming.length === 0 && <p className="text-gray-400 text-sm">No upcoming reminders.</p>}
        <div className="space-y-2">
          {upcoming.map((r) => (
            <div key={r.id} className={`border rounded-xl p-4 bg-white flex justify-between items-start ${
              isUrgent(r.remind_at) ? "border-orange-200 bg-orange-50" : "border-gray-100"
            }`}>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-800">{r.title}</p>
                  {isUrgent(r.remind_at) && (
                    <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">Today</span>
                  )}
                </div>
                {r.client_id && <p className="text-xs text-gray-400 mt-0.5">{clientMap.get(r.client_id)}</p>}
                {r.message && <p className="text-sm text-gray-600 mt-1">{r.message}</p>}
                <p className="text-xs text-gray-400 mt-1">
                  🕐 {new Date(r.remind_at).toLocaleString()}
                </p>
              </div>
              <button onClick={() => handleDelete(r.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
            </div>
          ))}
        </div>
      </Section>

      {past.length > 0 && (
        <Section title={`Past (${past.length})`}>
          <div className="space-y-2">
            {past.map((r) => (
              <div key={r.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50 flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500 line-through">{r.title}</p>
                  <p className="text-xs text-gray-400">{new Date(r.remind_at).toLocaleString()}</p>
                </div>
                <button onClick={() => handleDelete(r.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}