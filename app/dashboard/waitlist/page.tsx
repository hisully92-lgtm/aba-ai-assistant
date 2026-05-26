"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type WaitlistEntry = {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  diagnosis: string | null;
  insurance_provider: string | null;
  referral_source: string | null;
  priority: string;
  status: string;
  notes: string | null;
  date_added: string;
  created_at: string;
};

const PRIORITIES = ["urgent", "high", "normal", "low"];
const STATUSES = ["waiting", "contacted", "intake_scheduled", "enrolled", "declined", "inactive"];
const DIAGNOSES = ["Autism Spectrum Disorder (ASD)", "Intellectual Disability", "ADHD", "Down Syndrome", "Developmental Delay", "Other"];
const INSURANCE_PROVIDERS = ["Medicaid", "Blue Cross Blue Shield", "Aetna", "United Healthcare", "Cigna", "Self-Pay", "Other"];
const REFERRAL_SOURCES = ["Physician referral", "School", "Previous client", "Online search", "Insurance directory", "Parent group", "Other"];

const emptyForm = {
  full_name: "",
  date_of_birth: "",
  guardian_name: "",
  guardian_phone: "",
  guardian_email: "",
  diagnosis: "",
  insurance_provider: "",
  referral_source: "",
  priority: "normal",
  notes: "",
};

export default function WaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("waiting");
  const [filterPriority, setFilterPriority] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("waitlist").select("*").eq("created_by", user.id).order("date_added", { ascending: true });
    setEntries(data ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.full_name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error: saveError } = await supabase.from("waitlist").insert([{
      ...form,
      status: "waiting",
      date_added: new Date().toISOString().split("T")[0],
      created_by: user.id,
    }]).select().single();

    if (saveError) { setError(saveError.message); setSaving(false); return; }

    setEntries((prev) => [...prev, data]);
    setForm(emptyForm);
    setShowForm(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
    setSaving(false);
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from("waitlist").update({ status }).eq("id", id);
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, status } : e));
  }

  async function updatePriority(id: string, priority: string) {
    await supabase.from("waitlist").update({ priority }).eq("id", id);
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, priority } : e));
  }

  let filtered = entries;
  if (filterStatus) filtered = filtered.filter((e) => e.status === filterStatus);
  if (filterPriority) filtered = filtered.filter((e) => e.priority === filterPriority);

  function priorityColor(priority: string) {
    if (priority === "urgent") return "bg-red-100 text-red-700";
    if (priority === "high") return "bg-orange-100 text-orange-700";
    if (priority === "normal") return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-500";
  }

  function statusColor(status: string) {
    if (status === "enrolled") return "bg-green-100 text-green-700";
    if (status === "intake_scheduled") return "bg-blue-100 text-blue-700";
    if (status === "contacted") return "bg-yellow-100 text-yellow-700";
    if (status === "waiting") return "bg-gray-100 text-gray-600";
    return "bg-red-100 text-red-600";
  }

  function daysWaiting(dateAdded: string) {
    return Math.floor((Date.now() - new Date(dateAdded).getTime()) / (1000 * 60 * 60 * 24));
  }

  const waitingCount = entries.filter((e) => e.status === "waiting").length;
  const urgentCount = entries.filter((e) => e.priority === "urgent" && e.status === "waiting").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Waitlist">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add to Waitlist"}
        </Button>
      </PageHeader>

      {success && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">✓ Added to waitlist.</div>}

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4 text-center bg-white">
          <p className="text-2xl font-bold text-blue-600">{entries.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total</p>
        </div>
        <div className="border rounded-lg p-4 text-center bg-white">
          <p className="text-2xl font-bold text-yellow-600">{waitingCount}</p>
          <p className="text-xs text-gray-500 mt-1">Waiting</p>
        </div>
        <div className="border rounded-lg p-4 text-center bg-white">
          <p className="text-2xl font-bold text-red-600">{urgentCount}</p>
          <p className="text-xs text-gray-500 mt-1">Urgent</p>
        </div>
        <div className="border rounded-lg p-4 text-center bg-white">
          <p className="text-2xl font-bold text-green-600">{entries.filter((e) => e.status === "enrolled").length}</p>
          <p className="text-xs text-gray-500 mt-1">Enrolled</p>
        </div>
      </div>

      {showForm && (
        <Section title="Add to Waitlist">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client Name *</label>
              <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Full name" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Date of Birth</label>
              <input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Guardian Name</label>
              <input type="text" value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Guardian Phone</label>
              <input type="tel" value={form.guardian_phone} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Guardian Email</label>
              <input type="email" value={form.guardian_email} onChange={(e) => setForm({ ...form, guardian_email: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Diagnosis</label>
              <select value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select...</option>
                {DIAGNOSES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Insurance</label>
              <select value={form.insurance_provider} onChange={(e) => setForm({ ...form, insurance_provider: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select...</option>
                {INSURANCE_PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Referral Source</label>
              <select value={form.referral_source} onChange={(e) => setForm({ ...form, referral_source: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select...</option>
                {REFERRAL_SOURCES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>Add to Waitlist</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* FILTERS */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <p className="text-sm text-gray-400">{filtered.length} entries</p>
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <Section title="Waitlist">
          <p className="text-gray-400 text-sm">No entries found.</p>
        </Section>
      )}

      <div className="space-y-3">
        {filtered.map((entry) => (
          <div key={entry.id} className="border border-gray-100 rounded-xl p-4 bg-white">
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <p className="font-semibold text-gray-800">{entry.full_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {entry.guardian_name && `Guardian: ${entry.guardian_name}`}
                  {entry.guardian_phone && ` · ${entry.guardian_phone}`}
                </p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {entry.diagnosis && (
                    <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{entry.diagnosis}</span>
                  )}
                  {entry.insurance_provider && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{entry.insurance_provider}</span>
                  )}
                  <span className="text-xs px-2 py-0.5 bg-gray-50 text-gray-500 rounded-full">
                    {daysWaiting(entry.date_added)} days waiting
                  </span>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${priorityColor(entry.priority)}`}>
                  {entry.priority}
                </span>
                <select value={entry.status} onChange={(e) => updateStatus(entry.id, e.target.value)}
                  className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${statusColor(entry.status)}`}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </div>
            </div>
            {entry.notes && <p className="text-xs text-gray-500 mt-2">{entry.notes}</p>}
            {entry.referral_source && <p className="text-xs text-gray-400 mt-1">Referral: {entry.referral_source}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}