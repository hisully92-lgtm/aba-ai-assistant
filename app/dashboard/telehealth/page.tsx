"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type TelehealthSession = {
  id: string;
  client_id: string;
  session_url: string | null;
  platform: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
  created_at: string;
};

const PLATFORMS = ["Zoom", "Google Meet", "Microsoft Teams", "Doxy.me", "SimplePractice Telehealth", "TheraNest", "Other"];
const DURATIONS = [30, 45, 60, 90, 120];
const STATUSES = ["scheduled", "completed", "cancelled", "no_show"];

const emptyForm = {
  client_id: "",
  platform: "Zoom",
  session_url: "",
  scheduled_at: "",
  duration_minutes: 60,
  notes: "",
};

export default function TelehealthPage() {
  const [sessions, setSessions] = useState<TelehealthSession[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: sessionData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
      supabase.from("telehealth_sessions").select("*").eq("created_by", user.id).order("scheduled_at", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setSessions(sessionData ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.client_id || !form.scheduled_at) { setError("Client and scheduled time are required."); return; }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error: saveError } = await supabase.from("telehealth_sessions").insert([{
      ...form,
      session_url: form.session_url || null,
      status: "scheduled",
      created_by: user.id,
    }]).select().single();

    if (saveError) { setError(saveError.message); setSaving(false); return; }

    setSessions((prev) => [data, ...prev]);
    setForm(emptyForm);
    setShowForm(false);
    setSaving(false);
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from("telehealth_sessions").update({ status }).eq("id", id);
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, status } : s));
  }

  async function handleDelete(id: string) {
    await supabase.from("telehealth_sessions").delete().eq("id", id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  const filtered = filterStatus ? sessions.filter((s) => s.status === filterStatus) : sessions;
  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  const upcoming = sessions.filter((s) => s.status === "scheduled" && new Date(s.scheduled_at) > new Date());

  function statusColor(status: string) {
    if (status === "completed") return "bg-green-100 text-green-700";
    if (status === "scheduled") return "bg-blue-100 text-blue-700";
    if (status === "cancelled") return "bg-red-100 text-red-700";
    if (status === "no_show") return "bg-orange-100 text-orange-700";
    return "bg-gray-100 text-gray-600";
  }

  function platformIcon(platform: string) {
    if (platform === "Zoom") return "🎥";
    if (platform === "Google Meet") return "📹";
    if (platform === "Microsoft Teams") return "💼";
    if (platform === "Doxy.me") return "🏥";
    return "💻";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Telehealth Sessions">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Schedule Telehealth"}
        </Button>
      </PageHeader>

      {/* UPCOMING */}
      {upcoming.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-blue-700 mb-3">📅 Upcoming Telehealth Sessions</p>
          <div className="space-y-2">
            {upcoming.map((s) => (
              <div key={s.id} className="flex justify-between items-center bg-white border border-blue-100 rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{clientMap.get(s.client_id) ?? "Unknown"}</p>
                  <p className="text-xs text-gray-400">{platformIcon(s.platform)} {s.platform} · {new Date(s.scheduled_at).toLocaleString()} · {s.duration_minutes}min</p>
                </div>
                <div className="flex gap-2">
                  {s.session_url && (
                    <a href={s.session_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      Join Session →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <Section title="Schedule Telehealth Session">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
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
              <label className="text-sm font-medium text-gray-700 mb-1 block">Platform</label>
              <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Scheduled Date & Time *</label>
              <input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Duration (minutes)</label>
              <select value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                {DURATIONS.map((d) => <option key={d} value={d}>{d} minutes</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Session URL</label>
              <input type="url" value={form.session_url} onChange={(e) => setForm({ ...form, session_url: e.target.value })}
                placeholder="https://zoom.us/j/..." className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>Schedule Session</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* FILTER */}
      {!loading && sessions.length > 0 && (
        <div className="flex gap-3 items-center">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <p className="text-sm text-gray-400">{filtered.length} sessions</p>
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <Section title="Telehealth Sessions">
          <p className="text-gray-400 text-sm">No telehealth sessions yet.</p>
        </Section>
      )}

      <div className="space-y-3">
        {filtered.map((s) => (
          <div key={s.id} className="border border-gray-100 rounded-xl p-4 bg-white">
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span>{platformIcon(s.platform)}</span>
                  <p className="font-semibold text-gray-800">{clientMap.get(s.client_id) ?? "Unknown"}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(s.status)}`}>
                    {s.status.replace("_", " ")}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {s.platform} · {new Date(s.scheduled_at).toLocaleString()} · {s.duration_minutes}min
                </p>
                {s.notes && <p className="text-xs text-gray-500 mt-1">{s.notes}</p>}
              </div>
              <div className="flex gap-2 flex-wrap">
                {s.session_url && s.status === "scheduled" && (
                  <a href={s.session_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Join →
                  </a>
                )}
                <select value={s.status} onChange={(e) => updateStatus(s.id, e.target.value)}
                  className="text-xs border rounded-lg px-2 py-1 focus:outline-none">
                  {STATUSES.map((st) => <option key={st} value={st}>{st.replace("_", " ")}</option>)}
                </select>
                <button onClick={() => handleDelete(s.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}