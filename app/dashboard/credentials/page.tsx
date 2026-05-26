"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Credential = {
  id: string;
  user_id: string;
  credential_type: string;
  credential_number: string;
  issued_date: string;
  expiry_date: string;
  issuing_body: string;
  status: string;
  created_at: string;
};

const CREDENTIAL_TYPES = [
  "BCBA (Board Certified Behavior Analyst)",
  "BCaBA (Board Certified Assistant Behavior Analyst)",
  "RBT (Registered Behavior Technician)",
  "BCBA-D (Doctoral Level BCBA)",
  "CPR/First Aid",
  "Mandated Reporter Training",
  "Crisis Prevention Intervention (CPI)",
  "Professional Assault Crisis Training (ProACT)",
  "State License",
  "NPI Number",
  "Other"
];

const ISSUING_BODIES = ["BACB", "State Board", "American Red Cross", "American Heart Association", "CPI", "Other"];

const emptyForm = {
  credential_type: "",
  credential_number: "",
  issued_date: "",
  expiry_date: "",
  issuing_body: "",
  status: "active",
};

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase
      .from("staff_credentials")
      .select("*")
      .eq("user_id", user.id)
      .order("expiry_date", { ascending: true });

    setCredentials(data ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.credential_type) { setError("Credential type is required."); return; }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error: saveError } = await supabase
      .from("staff_credentials")
      .insert([{ ...form, user_id: user.id }])
      .select()
      .single();

    if (saveError) { setError(saveError.message); setSaving(false); return; }

    setCredentials((prev) => [...prev, data].sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()));
    setForm(emptyForm);
    setShowForm(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from("staff_credentials").delete().eq("id", id);
    setCredentials((prev) => prev.filter((c) => c.id !== id));
  }

  function daysUntilExpiry(date: string) {
    if (!date) return null;
    return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  function expiryColor(days: number | null) {
    if (days === null) return "bg-gray-100 text-gray-500";
    if (days < 0) return "bg-red-100 text-red-700";
    if (days <= 30) return "bg-orange-100 text-orange-700";
    if (days <= 90) return "bg-yellow-100 text-yellow-700";
    return "bg-green-100 text-green-700";
  }

  function expiryLabel(days: number | null) {
    if (days === null) return "No expiry";
    if (days < 0) return `Expired ${Math.abs(days)} days ago`;
    if (days === 0) return "Expires today";
    return `Expires in ${days} days`;
  }

  const expiringSoon = credentials.filter((c) => {
    const days = daysUntilExpiry(c.expiry_date);
    return days !== null && days <= 90 && days >= 0;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="My Credentials">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add Credential"}
        </Button>
      </PageHeader>

      {success && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">✓ Credential saved.</div>}

      {expiringSoon.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-orange-700 mb-2">⚠️ Credentials expiring soon:</p>
          <div className="space-y-1">
            {expiringSoon.map((c) => (
              <p key={c.id} className="text-xs text-orange-600">
                {c.credential_type} — expires {c.expiry_date} ({daysUntilExpiry(c.expiry_date)} days)
              </p>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <Section title="Add Credential">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Credential Type *</label>
              <select value={form.credential_type} onChange={(e) => setForm({ ...form, credential_type: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select type...</option>
                {CREDENTIAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Credential / License Number</label>
              <input type="text" value={form.credential_number} onChange={(e) => setForm({ ...form, credential_number: e.target.value })}
                placeholder="e.g. 1-20-12345" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Issuing Body</label>
              <select value={form.issuing_body} onChange={(e) => setForm({ ...form, issuing_body: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select...</option>
                {ISSUING_BODIES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Issued Date</label>
              <input type="date" value={form.issued_date} onChange={(e) => setForm({ ...form, issued_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Expiry Date</label>
              <input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>Save Credential</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && credentials.length === 0 && (
        <Section title="My Credentials">
          <p className="text-gray-400 text-sm">No credentials added yet.</p>
        </Section>
      )}

      <div className="space-y-3">
        {credentials.map((c) => {
          const days = daysUntilExpiry(c.expiry_date);
          return (
            <div key={c.id} className="border border-gray-100 rounded-xl p-4 bg-white flex justify-between items-start">
              <div>
                <p className="font-semibold text-gray-800">{c.credential_type}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {c.issuing_body && `${c.issuing_body} · `}
                  {c.credential_number && `#${c.credential_number} · `}
                  {c.issued_date && `Issued: ${c.issued_date}`}
                </p>
                {c.expiry_date && (
                  <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${expiryColor(days)}`}>
                    {expiryLabel(days)}
                  </span>
                )}
              </div>
              <button onClick={() => handleDelete(c.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}