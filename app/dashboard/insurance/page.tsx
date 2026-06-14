"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { usePlanGate } from "@/lib/hooks/usePlanGate";
import UpgradePrompt from "@/components/ui/UpgradePrompt";
import Link from "next/link";

type Client = { id: string; full_name: string };
type InsuranceProvider = { id: string; name: string };

type InsuranceClaim = {
  id: string;
  client_id: string;
  provider_id: string | null;
  cpt_code: string;
  units: number;
  amount: number;
  status: string;
  denial_reason: string | null;
  submitted_at: string | null;
  paid_at: string | null;
  created_at: string;
};

type Authorization = {
  id: string;
  client_id: string;
  insurance_provider_id: string | null;
  cpt_code: string;
  start_date: string;
  end_date: string;
  total_units: number;
  used_units: number;
  status: string;
};

const CPT_CODES = [
  { code: "97153", desc: "Adaptive behavior treatment by protocol" },
  { code: "97154", desc: "Group adaptive behavior treatment" },
  { code: "97155", desc: "Adaptive behavior treatment with protocol modification" },
  { code: "97156", desc: "Family adaptive behavior treatment guidance" },
  { code: "97157", desc: "Multiple-family group adaptive behavior treatment" },
  { code: "97158", desc: "Group adaptive behavior treatment with protocol modification" },
  { code: "0362T", desc: "Behavior identification supporting assessment" },
  { code: "0373T", desc: "Adaptive behavior treatment social skills group" },
];

const emptyClaimForm = {
  client_id: "",
  provider_id: "",
  cpt_code: "",
  units: "",
  amount: "",
};

export default function InsurancePage() {
  const { hasFeature, planName } = usePlanGate();
  const insuranceGate = hasFeature("insurance");

  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [providers, setProviders] = useState<InsuranceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"claims" | "authorizations">("claims");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyClaimForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterClient, setFilterClient] = useState("");

  useEffect(() => {
    if (insuranceGate.allowed) load();
    else setLoading(false);
  }, [insuranceGate.allowed]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const [
      { data: claimsData },
      { data: authData },
      { data: clientData },
      { data: providerData },
    ] = await Promise.all([
      supabase.from("insurance_claims").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("authorizations").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("clients").select("id, full_name"),
      supabase.from("insurance_providers").select("id, name"),
    ]);

    setClaims(claimsData ?? []);
    setAuthorizations(authData ?? []);
    setClients(clientData ?? []);
    setProviders(providerData ?? []);
    setLoading(false);
  }

  async function handleSaveClaim() {
    if (!form.client_id || !form.cpt_code || !form.units || !form.amount) {
      setError("Client, CPT code, units and amount are required.");
      return;
    }
    setSaving(true);
    setError(null);

    const { data, error: saveError } = await supabase
      .from("insurance_claims")
      .insert([{
        client_id: form.client_id,
        provider_id: form.provider_id || null,
        cpt_code: form.cpt_code,
        units: Number(form.units),
        amount: Number(form.amount),
        status: "pending",
      }])
      .select()
      .single();

    if (saveError) { setError(saveError.message); setSaving(false); return; }
    setClaims((prev) => [data, ...prev]);
    setForm(emptyClaimForm);
    setShowForm(false);
    setSaving(false);
  }

  async function updateClaimStatus(id: string, status: string) {
    await supabase.from("insurance_claims").update({ status }).eq("id", id);
    setClaims((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
  }

  function statusColor(status: string) {
    if (status === "paid" || status === "approved") return "bg-green-100 text-green-700";
    if (status === "submitted" || status === "pending") return "bg-yellow-100 text-yellow-700";
    if (status === "denied") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-600";
  }

  function fmt(n: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  }

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));
  const providerMap = new Map(providers.map((p) => [p.id, p.name]));
  const filteredClaims = filterClient ? claims.filter((c) => c.client_id === filterClient) : claims;
  const filteredAuths = filterClient ? authorizations.filter((a) => a.client_id === filterClient) : authorizations;
  const totalBilled = filteredClaims.reduce((sum, c) => sum + (c.amount ?? 0), 0);
  const totalPaid = filteredClaims.filter((c) => c.status === "paid").reduce((sum, c) => sum + (c.amount ?? 0), 0);

  // PLAN GATE
  if (!insuranceGate.allowed) {
    return (
      <div className="space-y-6">
        <PageHeader title="Insurance & Billing" />
        <UpgradePrompt
          reason={`Insurance billing and authorization tracking require the Professional plan or higher. You are on the ${planName} plan.`}
          upgradeTo={insuranceGate.upgradeTo}
          feature="Insurance & Billing"
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: "📋", title: "Claims Management", desc: "Submit and track insurance claims by CPT code" },
            { icon: "✅", title: "Authorizations", desc: "Track insurance authorizations with unit usage" },
            { icon: "💰", title: "Revenue Tracking", desc: "Monitor billed vs paid amounts per client" },
          ].map(item => (
            <div key={item.title} className="border border-gray-100 rounded-xl p-5 bg-white text-center">
              <div className="text-3xl mb-2">{item.icon}</div>
              <p className="font-semibold text-gray-800 text-sm">{item.title}</p>
              <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
          💡 Upgrade to <strong>Professional</strong> to unlock insurance billing, authorization tracking, and claims management.
          <Link href="/dashboard/settings/billing" className="ml-2 underline font-medium">View plans →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Insurance & Billing">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Claim"}
        </Button>
      </PageHeader>

      {/* SUMMARY TILES */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4 text-center bg-white">
          <p className="text-2xl font-bold text-blue-600">{filteredClaims.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total Claims</p>
        </div>
        <div className="border rounded-lg p-4 text-center bg-white">
          <p className="text-2xl font-bold text-green-600">{fmt(totalPaid)}</p>
          <p className="text-xs text-gray-500 mt-1">Paid</p>
        </div>
        <div className="border rounded-lg p-4 text-center bg-white">
          <p className="text-2xl font-bold text-yellow-500">{fmt(totalBilled - totalPaid)}</p>
          <p className="text-xs text-gray-500 mt-1">Outstanding</p>
        </div>
        <div className="border rounded-lg p-4 text-center bg-white">
          <p className="text-2xl font-bold text-gray-700">{filteredAuths.length}</p>
          <p className="text-xs text-gray-500 mt-1">Authorizations</p>
        </div>
      </div>

      {/* NEW CLAIM FORM */}
      {showForm && (
        <Section title="New Insurance Claim">
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
              <label className="text-sm font-medium text-gray-700 mb-1 block">Insurance Provider</label>
              <select value={form.provider_id} onChange={(e) => setForm({ ...form, provider_id: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select provider...</option>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">CPT Code *</label>
              <select value={form.cpt_code} onChange={(e) => setForm({ ...form, cpt_code: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select CPT code...</option>
                {CPT_CODES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} — {c.desc}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Units *</label>
              <input type="number" value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })}
                placeholder="Number of units"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Amount ($) *</label>
              <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSaveClaim} loading={saving}>Submit Claim</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setForm(emptyClaimForm); }}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* FILTER */}
      {!loading && (
        <div className="flex items-center gap-3">
          <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        </div>
      )}

      {/* TABS */}
      <div className="flex gap-2 border-b border-gray-200">
        {(["claims", "authorizations"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              activeTab === tab ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {tab === "claims" ? `Claims (${filteredClaims.length})` : `Authorizations (${filteredAuths.length})`}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}

      {/* CLAIMS */}
      {!loading && activeTab === "claims" && (
        <div className="space-y-2">
          {filteredClaims.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-gray-600 font-medium">No claims yet</p>
              <p className="text-gray-400 text-sm mt-1">Click &quot;+ New Claim&quot; to submit your first insurance claim.</p>
            </div>
          ) : (
            filteredClaims.map((claim) => (
              <div key={claim.id} className="border border-gray-100 rounded-xl p-4 bg-white">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <p className="font-medium text-gray-800">
                      {clientMap.get(claim.client_id) ?? "Unknown"} · CPT: {claim.cpt_code}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {claim.units} units · {fmt(claim.amount)}
                      {claim.provider_id && ` · ${providerMap.get(claim.provider_id) ?? ""}`}
                    </p>
                    {claim.denial_reason && (
                      <p className="text-xs text-red-500 mt-1">Denial: {claim.denial_reason}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {claim.submitted_at ? `Submitted: ${new Date(claim.submitted_at).toLocaleDateString()}` : "Not submitted"}
                      {claim.paid_at ? ` · Paid: ${new Date(claim.paid_at).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor(claim.status)}`}>
                      {claim.status}
                    </span>
                    <select value={claim.status} onChange={(e) => updateClaimStatus(claim.id, e.target.value)}
                      className="text-xs border rounded-lg px-2 py-1 focus:outline-none">
                      <option value="pending">Pending</option>
                      <option value="submitted">Submitted</option>
                      <option value="paid">Paid</option>
                      <option value="denied">Denied</option>
                    </select>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* AUTHORIZATIONS */}
      {!loading && activeTab === "authorizations" && (
        <div className="space-y-2">
          {filteredAuths.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-gray-600 font-medium">No authorizations yet</p>
              <p className="text-gray-400 text-sm mt-1">Add authorizations from the client intake page.</p>
            </div>
          ) : (
            filteredAuths.map((auth) => {
              const pct = Math.min(100, (auth.used_units / auth.total_units) * 100);
              const isExpiringSoon = new Date(auth.end_date) < new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
              return (
                <div key={auth.id} className={`border rounded-xl p-4 bg-white ${isExpiringSoon ? "border-yellow-300" : "border-gray-100"}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-800">
                          {clientMap.get(auth.client_id) ?? "Unknown"} · CPT: {auth.cpt_code}
                        </p>
                        {isExpiringSoon && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                            Expiring soon
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {auth.used_units} / {auth.total_units} units used
                      </p>
                      <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
                        <div
                          className={`h-2 rounded-full ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-500" : "bg-blue-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {auth.start_date} → {auth.end_date}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ml-4 ${statusColor(auth.status)}`}>
                      {auth.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}