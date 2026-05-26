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
  renewal_url: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

const CREDENTIAL_TYPES = [
  { label: "BCBA (Board Certified Behavior Analyst)", renewalUrl: "https://www.bacb.com/maintain-certification/bcba/", body: "BACB" },
  { label: "BCaBA (Board Certified Assistant Behavior Analyst)", renewalUrl: "https://www.bacb.com/maintain-certification/bcaba/", body: "BACB" },
  { label: "RBT (Registered Behavior Technician)", renewalUrl: "https://www.bacb.com/maintain-certification/rbt/", body: "BACB" },
  { label: "BCBA-D (Doctoral Level BCBA)", renewalUrl: "https://www.bacb.com/maintain-certification/bcba-d/", body: "BACB" },
  { label: "CPR/First Aid", renewalUrl: "https://www.redcross.org/take-a-class", body: "American Red Cross" },
  { label: "Crisis Prevention Intervention (CPI)", renewalUrl: "https://www.crisisprevention.com", body: "CPI" },
  { label: "Professional Assault Crisis Training (ProACT)", renewalUrl: "", body: "ProACT" },
  { label: "Mandated Reporter Training", renewalUrl: "", body: "State" },
  { label: "State License", renewalUrl: "", body: "State Board" },
  { label: "NPI Number", renewalUrl: "https://nppes.cms.hhs.gov", body: "CMS" },
  { label: "Other", renewalUrl: "", body: "Other" },
];

const ISSUING_BODIES = ["BACB", "State Board", "American Red Cross", "American Heart Association", "CPI", "CMS", "Other"];

const emptyForm = {
  credential_type: "",
  credential_number: "",
  issued_date: "",
  expiry_date: "",
  issuing_body: "",
  renewal_url: "",
  notes: "",
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

  function handleTypeSelect(label: string) {
    const found = CREDENTIAL_TYPES.find((c) => c.label === label);
    setForm((prev) => ({
      ...prev,
      credential_type: label,
      issuing_body: found?.body ?? "",
      renewal_url: found?.renewalUrl ?? "",
    }));
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

    setCredentials((prev) => [...prev, data].sort((a, b) =>
      new Date(a.expiry_date || "9999").getTime() - new Date(b.expiry_date || "9999").getTime()
    ));
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
    if (days <= 30) return "bg-red-100 text-red-700";
    if (days <= 60) return "bg-orange-100 text-orange-700";
    if (days <= 90) return "bg-yellow-100 text-yellow-700";
    return "bg-green-100 text-green-700";
  }

  function expiryLabel(days: number | null) {
    if (days === null) return "No expiry set";
    if (days < 0) return `⚠️ Expired ${Math.abs(days)} days ago`;
    if (days === 0) return "⚠️ Expires today!";
    if (days <= 30) return `🔴 Expires in ${days} days`;
    if (days <= 60) return `🟠 Expires in ${days} days`;
    if (days <= 90) return `🟡 Expires in ${days} days`;
    return `✅ Expires in ${days} days`;
  }

  const expiringSoon = credentials.filter((c) => {
    const days = daysUntilExpiry(c.expiry_date);
    return days !== null && days <= 30 && days >= 0;
  });

  const expired = credentials.filter((c) => {
    const days = daysUntilExpiry(c.expiry_date);
    return days !== null && days < 0;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="My Credentials">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add Credential"}
        </Button>
      </PageHeader>

      {success && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">✓ Credential saved.</div>}

      {/* URGENT ALERTS */}
      {expired.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-bold text-red-700 mb-2">🚨 Expired Credentials — Action Required:</p>
          <div className="space-y-2">
            {expired.map((c) => (
              <div key={c.id} className="flex justify-between items-center">
                <p className="text-sm text-red-600">{c.credential_type} — expired {c.expiry_date}</p>
                {c.renewal_url && (
                  <a href={c.renewal_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700">
                    Renew Now →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {expiringSoon.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-sm font-bold text-orange-700 mb-2">⚠️ Credentials Expiring Within 30 Days:</p>
          <div className="space-y-2">
            {expiringSoon.map((c) => (
              <div key={c.id} className="flex justify-between items-center">
                <p className="text-sm text-orange-600">
                  {c.credential_type} — expires {c.expiry_date} ({daysUntilExpiry(c.expiry_date)} days)
                </p>
                {c.renewal_url && (
                  <a href={c.renewal_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs px-3 py-1 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
                    Renew Now →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FORM */}
      {showForm && (
        <Section title="Add Credential">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Credential Type *</label>
              <select value={form.credential_type} onChange={(e) => handleTypeSelect(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select type...</option>
                {CREDENTIAL_TYPES.map((t) => <option key={t.label} value={t.label}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Credential Number</label>
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
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Renewal URL</label>
              <input type="url" value={form.renewal_url} onChange={(e) => setForm({ ...form, renewal_url: e.target.value })}
                placeholder="https://www.bacb.com/maintain-certification/..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <p className="text-xs text-gray-400 mt-1">Link to renewal page — auto-filled for BACB credentials</p>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
              <textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="CEU requirements, supervisor info, etc..." rows={2}
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
          <p className="text-gray-400 text-sm">No credentials added yet. Add your BCBA, RBT, or other certifications.</p>
        </Section>
      )}

      <div className="space-y-3">
        {credentials.map((c) => {
          const days = daysUntilExpiry(c.expiry_date);
          return (
            <div key={c.id} className={`border rounded-xl p-4 bg-white ${days !== null && days <= 30 ? "border-orange-200" : days !== null && days < 0 ? "border-red-200" : "border-gray-100"}`}>
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div className="flex-1">
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
                  {c.notes && <p className="text-xs text-gray-500 mt-1">{c.notes}</p>}
                  {c.renewal_url && (
                    <a href={c.renewal_url} target="_blank" rel="noopener noreferrer"
                      className="inline-block mt-2 text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                      🔗 Renew / Update →
                    </a>
                  )}
                </div>
                <button onClick={() => handleDelete(c.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* RENEWAL LINKS REFERENCE */}
      <Section title="Quick Renewal Links">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CREDENTIAL_TYPES.filter((t) => t.renewalUrl).map((t) => (
            <a key={t.label} href={t.renewalUrl} target="_blank" rel="noopener noreferrer"
              className="flex justify-between items-center border border-gray-100 rounded-lg p-3 bg-white hover:border-blue-300 hover:shadow-sm transition-all">
              <div>
                <p className="text-sm font-medium text-gray-700">{t.label}</p>
                <p className="text-xs text-gray-400">{t.body}</p>
              </div>
              <span className="text-blue-500 text-xs">→</span>
            </a>
          ))}
        </div>
      </Section>
    </div>
  );
}