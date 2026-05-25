"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { usePlan } from "@/lib/billing/usePlan";

type Client = {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  guardian_name: string | null;
  diagnosis: string | null;
  goals: string | null;
  created_at: string;
};

const DIAGNOSES = [
  "Autism Spectrum Disorder (ASD)",
  "Intellectual Disability",
  "ADHD",
  "Down Syndrome",
  "Cerebral Palsy",
  "Developmental Delay",
  "Language Disorder",
  "Anxiety Disorder",
  "Other",
];

const emptyForm = {
  full_name: "",
  date_of_birth: "",
  guardian_name: "",
  diagnosis: "",
  goals: "",
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterDiagnosis, setFilterDiagnosis] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { plan } = usePlan();
  const isPro = plan === "pro";

  useEffect(() => { fetchClients(); }, []);

  async function fetchClients() {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

    setClients(data ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.full_name.trim()) { setError("Client name is required."); return; }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error } = await supabase
      .from("clients")
      .insert([{ ...form, created_by: user.id }])
      .select()
      .single();

    if (error) { setError(error.message); setSaving(false); return; }

    setClients((prev) => [data, ...prev]);
    setForm(emptyForm);
    setShowForm(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
    setSaving(false);
  }

  async function handleUpdate(id: string, field: string, value: string) {
    await supabase.from("clients").update({ [field]: value }).eq("id", id);
    setClients((prev) => prev.map((c) => c.id === id ? { ...c, [field]: value } : c));
  }

  const isLimitReached = !isPro && clients.length >= 5;

  let filtered = clients;
  if (search.trim()) {
    filtered = filtered.filter((c) =>
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.guardian_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.diagnosis ?? "").toLowerCase().includes(search.toLowerCase())
    );
  }
  if (filterDiagnosis) {
    filtered = filtered.filter((c) => c.diagnosis === filterDiagnosis);
  }

  function getAge(dob: string | null) {
    if (!dob) return null;
    return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Clients / Learners">
        <Button onClick={() => setShowForm(!showForm)} disabled={isLimitReached}>
          {showForm ? "Cancel" : "+ Add Client"}
        </Button>
      </PageHeader>

      {isLimitReached && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          Free plan limit reached (5 clients).{" "}
          <button className="underline font-medium" onClick={() => window.location.href = "/dashboard/upgrade"}>
            Upgrade to Pro
          </button>{" "}
          to add more.
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          ✓ Client added successfully.
        </div>
      )}

      {/* ADD FORM */}
      {showForm && (
        <Section title="Add New Client">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Full Name *</label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Client full name"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Date of Birth</label>
              <input
                type="date"
                value={form.date_of_birth}
                onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Guardian Name</label>
              <input
                type="text"
                value={form.guardian_name}
                onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
                placeholder="Parent or guardian"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Diagnosis</label>
              <select
                value={form.diagnosis}
                onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Select diagnosis...</option>
                {DIAGNOSES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Goals</label>
              <textarea
                value={form.goals}
                onChange={(e) => setForm({ ...form, goals: e.target.value })}
                placeholder="Client's treatment goals..."
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>Save Client</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setForm(emptyForm); }}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* SEARCH + FILTER */}
      {!loading && clients.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="border rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <select
            value={filterDiagnosis}
            onChange={(e) => setFilterDiagnosis(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">All Diagnoses</option>
            {DIAGNOSES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <p className="text-sm text-gray-400">{filtered.length} of {clients.length} clients</p>
        </div>
      )}

      {/* CLIENT LIST */}
      {loading && <p className="text-gray-400 text-sm">Loading clients...</p>}
      {!loading && filtered.length === 0 && (
        <Section title="Clients">
          <p className="text-gray-400 text-sm">
            {search ? "No clients match your search." : "No clients yet. Click '+ Add Client' to get started."}
          </p>
        </Section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((client) => {
          const age = getAge(client.date_of_birth);
          const isExpanded = expandedId === client.id;
          return (
            <div key={client.id} className="border border-gray-100 rounded-xl bg-white hover:shadow-md transition-shadow">
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-gray-800">{client.full_name}</p>
                    {age !== null && <p className="text-xs text-gray-400 mt-0.5">Age: {age}</p>}
                    {client.guardian_name && <p className="text-xs text-gray-400">Guardian: {client.guardian_name}</p>}
                    {client.diagnosis && (
                      <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                        {client.diagnosis}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : client.id)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    {isExpanded ? "▲" : "▼"}
                  </button>
                </div>

                {/* EXPANDED DETAILS */}
                {isExpanded && (
                  <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Diagnosis</label>
                      <select
                        value={client.diagnosis ?? ""}
                        onChange={(e) => handleUpdate(client.id, "diagnosis", e.target.value)}
                        className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                      >
                        <option value="">Select diagnosis...</option>
                        {DIAGNOSES.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Goals</label>
                      <textarea
                        value={client.goals ?? ""}
                        onChange={(e) => handleUpdate(client.id, "goals", e.target.value)}
                        placeholder="Treatment goals..."
                        rows={3}
                        className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>
                  </div>
                )}

                {/* QUICK ACTIONS */}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={() => window.location.href = `/dashboard/clients/${client.id}/case`}
                    className="text-xs px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium transition-colors"
                  >
                    Case
                  </button>
                  <button
                    onClick={() => window.location.href = `/dashboard/clients/${client.id}/timeline`}
                    className="text-xs px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 font-medium transition-colors"
                  >
                    Timeline
                  </button>
                  <button
                    onClick={() => window.location.href = `/dashboard/clients/${client.id}/exports`}
                    className="text-xs px-3 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors"
                  >
                    Exports
                  </button>
                  <button
                    onClick={() => window.location.href = `/dashboard/clinician/${client.id}`}
                    className="text-xs px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 font-medium transition-colors"
                  >
                    Clinician
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}