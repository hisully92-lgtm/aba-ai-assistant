"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

type Profile = { id: string; full_name: string | null; role: string | null };
type Client = { id: string; full_name: string };
type HourEntry = {
  id: string;
  student_id: string;
  supervisor_id: string | null;
  hour_type: string;
  activity_type: string;
  client_id: string | null;
  hours: number;
  session_date: string;
  notes: string | null;
  approved: boolean;
  created_at: string;
};

const HOUR_TYPES = [
  { value: "restricted", label: "Restricted (Supervised)", desc: "Hours completed under direct supervision of BCBA" },
  { value: "unrestricted", label: "Unrestricted (Independent)", desc: "Hours completed independently without direct supervision" },
];

const ACTIVITY_TYPES = [
  "Direct client observation",
  "Direct client intervention",
  "Indirect client support",
  "Behavioral assessment",
  "Data analysis",
  "Report writing",
  "Treatment plan development",
  "Caregiver training",
  "Staff training",
  "Supervision meeting",
  "Case consultation",
  "Other",
];

const BCBA_REQUIREMENTS = {
  total: 2000,
  restricted: 1000,
  unrestricted: 1000,
};

const emptyForm = {
  hour_type: "restricted",
  activity_type: "",
  client_id: "",
  supervisor_id: "",
  hours: 1,
  session_date: new Date().toISOString().split("T")[0],
  notes: "",
};

export default function StudentHubPage() {
  const [entries, setEntries] = useState<HourEntry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const [{ data: profileData }, { data: clientData }, { data: entryData }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, role").in("role", ["supervisor", "clinical_director", "admin"]),
      supabase.from("clients").select("id, full_name"),
      supabase.from("student_analyst_hours").select("*").eq("student_id", user.id).order("session_date", { ascending: false }),
    ]);

    setProfiles(profileData ?? []);
    setClients(clientData ?? []);
    setEntries(entryData ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.activity_type || !form.hours) { setError("Activity type and hours are required."); return; }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error: saveError } = await supabase.from("student_analyst_hours").insert([{
      ...form,
      student_id: user.id,
      supervisor_id: form.supervisor_id || null,
      client_id: form.client_id || null,
      created_by: user.id,
    }]).select().single();

    if (saveError) { setError(saveError.message); setSaving(false); return; }

    setEntries((prev) => [data, ...prev]);
    setForm(emptyForm);
    setShowForm(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from("student_analyst_hours").delete().eq("id", id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const filtered = filterType ? entries.filter((e) => e.hour_type === filterType) : entries;
  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));
  const profileMap = new Map(profiles.map((p) => [p.id, p.full_name ?? "Unknown"]));

  // STATS
  const totalHours = entries.reduce((a, b) => a + b.hours, 0);
  const restrictedHours = entries.filter((e) => e.hour_type === "restricted").reduce((a, b) => a + b.hours, 0);
  const unrestrictedHours = entries.filter((e) => e.hour_type === "unrestricted").reduce((a, b) => a + b.hours, 0);
  const approvedHours = entries.filter((e) => e.approved).reduce((a, b) => a + b.hours, 0);

  const restrictedPct = Math.min(100, Math.round((restrictedHours / BCBA_REQUIREMENTS.restricted) * 100));
  const unrestrictedPct = Math.min(100, Math.round((unrestrictedHours / BCBA_REQUIREMENTS.unrestricted) * 100));
  const totalPct = Math.min(100, Math.round((totalHours / BCBA_REQUIREMENTS.total) * 100));

  // MONTHLY TREND
  const monthlyData = entries.reduce((acc, entry) => {
    const month = entry.session_date.slice(0, 7);
    const existing = acc.find((a) => a.month === month);
    if (existing) {
      if (entry.hour_type === "restricted") existing.restricted += entry.hours;
      else existing.unrestricted += entry.hours;
    } else {
      acc.push({
        month,
        restricted: entry.hour_type === "restricted" ? entry.hours : 0,
        unrestricted: entry.hour_type === "unrestricted" ? entry.hours : 0,
      });
    }
    return acc;
  }, [] as { month: string; restricted: number; unrestricted: number }[]).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);

  const pieData = [
    { name: "Restricted", value: restrictedHours, color: "#2563eb" },
    { name: "Unrestricted", value: unrestrictedHours, color: "#16a34a" },
    { name: "Remaining", value: Math.max(0, BCBA_REQUIREMENTS.total - totalHours), color: "#e5e7eb" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Student Analyst Hub">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Log Hours"}
        </Button>
      </PageHeader>

      {success && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">✓ Hours logged successfully.</div>}

      {/* PROGRESS OVERVIEW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-xl p-4 bg-white">
          <p className="text-sm font-medium text-gray-700 mb-2">Total Hours</p>
          <p className="text-3xl font-bold text-blue-600">{totalHours.toFixed(1)}</p>
          <p className="text-xs text-gray-400 mt-1">of {BCBA_REQUIREMENTS.total} required</p>
          <div className="mt-2 w-full bg-gray-100 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${totalPct}%` }} />
          </div>
          <p className="text-xs text-blue-600 mt-1">{totalPct}% complete</p>
        </div>
        <div className="border rounded-xl p-4 bg-white">
          <p className="text-sm font-medium text-gray-700 mb-2">Restricted Hours</p>
          <p className="text-3xl font-bold text-blue-600">{restrictedHours.toFixed(1)}</p>
          <p className="text-xs text-gray-400 mt-1">of {BCBA_REQUIREMENTS.restricted} required</p>
          <div className="mt-2 w-full bg-gray-100 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${restrictedPct}%` }} />
          </div>
          <p className="text-xs text-blue-600 mt-1">{restrictedPct}% complete</p>
        </div>
        <div className="border rounded-xl p-4 bg-white">
          <p className="text-sm font-medium text-gray-700 mb-2">Unrestricted Hours</p>
          <p className="text-3xl font-bold text-green-600">{unrestrictedHours.toFixed(1)}</p>
          <p className="text-xs text-gray-400 mt-1">of {BCBA_REQUIREMENTS.unrestricted} required</p>
          <div className="mt-2 w-full bg-gray-100 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full" style={{ width: `${unrestrictedPct}%` }} />
          </div>
          <p className="text-xs text-green-600 mt-1">{unrestrictedPct}% complete</p>
        </div>
      </div>

      {/* CHARTS */}
      {entries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Section title="Monthly Hours">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="restricted" stroke="#2563eb" strokeWidth={2} name="Restricted" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="unrestricted" stroke="#16a34a" strokeWidth={2} name="Unrestricted" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Section>
          <Section title="Hour Distribution">
            <div className="flex items-center gap-4">
              <PieChart width={160} height={160}>
                <Pie data={pieData} cx={75} cy={75} innerRadius={45} outerRadius={70} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
              <div className="space-y-3">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-gray-600">{item.name}: {item.value.toFixed(1)}h</span>
                  </div>
                ))}
                <p className="text-xs text-gray-400 mt-2">✓ {approvedHours.toFixed(1)}h approved</p>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* REQUIREMENTS INFO */}
      <Section title="BCBA Exam Requirements (BACB)">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="border border-blue-100 rounded-lg p-3 bg-blue-50">
            <p className="font-semibold text-blue-800">Total Experience</p>
            <p className="text-2xl font-bold text-blue-600">2,000h</p>
            <p className="text-xs text-blue-600 mt-1">Minimum required</p>
          </div>
          <div className="border border-blue-100 rounded-lg p-3 bg-blue-50">
            <p className="font-semibold text-blue-800">Restricted Hours</p>
            <p className="text-2xl font-bold text-blue-600">1,000h</p>
            <p className="text-xs text-blue-600 mt-1">Must be supervised</p>
          </div>
          <div className="border border-green-100 rounded-lg p-3 bg-green-50">
            <p className="font-semibold text-green-800">Unrestricted Hours</p>
            <p className="text-2xl font-bold text-green-600">1,000h</p>
            <p className="text-xs text-green-600 mt-1">Independent work</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Requirements based on BACB Experience Standards. Always verify current requirements at <a href="https://www.bacb.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">bacb.com</a>
        </p>
      </Section>

      {/* FORM */}
      {showForm && (
        <Section title="Log Experience Hours">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Hour Type *</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {HOUR_TYPES.map((t) => (
                  <button key={t.value} onClick={() => setForm({ ...form, hour_type: t.value })}
                    className={`text-left border rounded-xl p-3 transition-all ${form.hour_type === t.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}>
                    <p className="text-sm font-medium text-gray-800">{t.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Activity Type *</label>
              <select value={form.activity_type} onChange={(e) => setForm({ ...form, activity_type: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select activity...</option>
                {ACTIVITY_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Hours *</label>
              <input type="number" min={0.25} step={0.25} value={form.hours}
                onChange={(e) => setForm({ ...form, hours: parseFloat(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Session Date</label>
              <input type="date" value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Supervising BCBA</label>
              <select value={form.supervisor_id} onChange={(e) => setForm({ ...form, supervisor_id: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select supervisor...</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client (optional)</label>
              <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">No specific client</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Describe activities completed..." rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>Log Hours</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* FILTER + LIST */}
      {!loading && entries.length > 0 && (
        <div className="flex gap-3 items-center">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Hours</option>
            <option value="restricted">Restricted Only</option>
            <option value="unrestricted">Unrestricted Only</option>
          </select>
          <p className="text-sm text-gray-400">{filtered.length} entries · {filtered.reduce((a, b) => a + b.hours, 0).toFixed(1)}h</p>
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <Section title="Hour Log">
          <p className="text-gray-400 text-sm">No hours logged yet. Click "+ Log Hours" to get started.</p>
        </Section>
      )}

      <div className="space-y-2">
        {filtered.map((entry) => (
          <div key={entry.id} className={`border rounded-xl p-4 bg-white flex justify-between items-start ${entry.approved ? "border-green-200" : "border-gray-100"}`}>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${entry.hour_type === "restricted" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                  {entry.hour_type === "restricted" ? "Restricted" : "Unrestricted"}
                </span>
                <p className="text-sm font-medium text-gray-800">{entry.activity_type}</p>
                {entry.approved && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">✓ Approved</span>}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {entry.session_date}
                {entry.supervisor_id && ` · Supervisor: ${profileMap.get(entry.supervisor_id)}`}
                {entry.client_id && ` · ${clientMap.get(entry.client_id)}`}
              </p>
              {entry.notes && <p className="text-xs text-gray-500 mt-1">{entry.notes}</p>}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-blue-600">{entry.hours}h</span>
              <button onClick={() => handleDelete(entry.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}