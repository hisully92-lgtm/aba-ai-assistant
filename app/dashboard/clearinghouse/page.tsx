"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";
import { usePlanGate } from "@/lib/hooks/usePlanGate";
import UpgradePrompt from "@/components/ui/UpgradePrompt";
import Link from "next/link";

type Claim = {
  id: string;
  client_name: string;
  cpt_code: string;
  date_of_service: string;
  amount: number;
  status: string;
  payer: string;
  submitted_at: string | null;
  created_at: string;
};

const PAYERS = [
  "Aetna", "Anthem", "BlueCross BlueShield", "Cigna", "Humana",
  "Medicaid", "Medicare", "Tricare", "UnitedHealthcare", "Other",
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  ready: "bg-blue-100 text-blue-700",
  submitted: "bg-yellow-100 text-yellow-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  paid: "bg-purple-100 text-purple-700",
};

export default function ClearinghousePage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"claims" | "setup" | "reports">("claims");

  const { hasFeature, planName } = usePlanGate();
  const ediGate = hasFeature("edi");

  const [form, setForm] = useState({
    client_name: "",
    cpt_code: "",
    date_of_service: new Date().toISOString().split("T")[0],
    amount: "",
    payer: "",
  });

  // Availity connection state
  const [availityConnected] = useState(false);
  const [availityApiKey, setAvailityApiKey] = useState("");
  const [availityOrgId, setAvailityOrgId] = useState("");
  const [savingConnection, setSavingConnection] = useState(false);
  const [connectionSaved, setConnectionSaved] = useState(false);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase
      .from("edi_claims")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    setClaims(data ?? []);
    setLoading(false);
  }

  async function handleSaveClaim() {
    if (!form.client_name || !form.cpt_code || !form.payer) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("edi_claims").insert({
      client_name: form.client_name,
      cpt_code: form.cpt_code,
      date_of_service: form.date_of_service,
      amount: parseFloat(form.amount) || 0,
      payer: form.payer,
      status: "draft",
      created_by: user.id,
    }).select().single();

    if (data) setClaims(prev => [data, ...prev]);
    setForm({ client_name: "", cpt_code: "", date_of_service: new Date().toISOString().split("T")[0], amount: "", payer: "" });
    setShowForm(false);
    setSaving(false);
  }

  async function handleSubmitClaim(id: string) {
    await supabase.from("edi_claims").update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
    }).eq("id", id);
    setClaims(prev => prev.map(c => c.id === id ? { ...c, status: "submitted", submitted_at: new Date().toISOString() } : c));
    alert("Claim marked as submitted. Complete the submission in your Availity portal at availity.com");
  }

  async function saveAvailityConnection() {
    setSavingConnection(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (companyUser?.company_id) {
      await supabase.from("companies").update({
        availity_api_key: availityApiKey,
        availity_org_id: availityOrgId,
      }).eq("id", companyUser.company_id);
    }

    setSavingConnection(false);
    setConnectionSaved(true);
    setTimeout(() => setConnectionSaved(false), 3000);
  }

  const draftCount = claims.filter(c => c.status === "draft").length;
  const submittedCount = claims.filter(c => c.status === "submitted").length;
  const paidCount = claims.filter(c => c.status === "paid").length;
  const totalBilled = claims.reduce((sum, c) => sum + (c.amount ?? 0), 0);

  if (!ediGate.allowed) {
    return (
      <div className="space-y-6">
        <PageHeader title="Clearinghouse & EDI Claims" />
        <UpgradePrompt
          reason={`EDI 837 claim submission requires the Enterprise plan or higher. You are currently on the ${planName} plan.`}
          upgradeTo={ediGate.upgradeTo}
          feature="EDI Clearinghouse Integration"
        />
        <Section title="What is EDI 837?">
          <p className="text-sm text-gray-600 mb-4">
            EDI 837 is the electronic format used to submit insurance claims to payers through a clearinghouse like Availity. 
            It eliminates paper claims and speeds up reimbursement.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: "⚡", title: "Faster Payments", desc: "Electronic claims are processed in days, not weeks" },
              { icon: "✅", title: "Fewer Errors", desc: "Automated validation catches errors before submission" },
              { icon: "📊", title: "Full Tracking", desc: "Track every claim from submission to payment" },
            ].map(item => (
              <div key={item.title} className="border border-gray-100 rounded-xl p-4 bg-white text-center">
                <p className="text-2xl mb-2">{item.icon}</p>
                <p className="font-semibold text-gray-800 text-sm">{item.title}</p>
                <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <Link href="/dashboard/settings/billing"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors">
              Upgrade to Enterprise →
            </Link>
          </div>
        </Section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Clearinghouse & EDI Claims">
        <button onClick={() => setShowForm(s => !s)}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
          {showForm ? "✕ Cancel" : "+ New Claim"}
        </button>
      </PageHeader>

      {/* STATS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Draft Claims", value: draftCount, color: "text-gray-600", icon: "📝" },
          { label: "Submitted", value: submittedCount, color: "text-yellow-600", icon: "📤" },
          { label: "Paid", value: paidCount, color: "text-green-600", icon: "💰" },
          { label: "Total Billed", value: `$${totalBilled.toFixed(2)}`, color: "text-blue-600", icon: "📊" },
        ].map(stat => (
          <div key={stat.label} className="border rounded-xl p-4 text-center bg-white">
            <div className="text-xl mb-1">{stat.icon}</div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* AVAILITY CONNECTION BANNER */}
      {!availityConnected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-semibold text-yellow-800 text-sm">Availity not connected</p>
            <p className="text-xs text-yellow-700 mt-0.5">
              Connect your Availity account to submit EDI 837 claims electronically.
              You can still track claims manually until connected.
            </p>
            <button onClick={() => setActiveTab("setup")}
              className="mt-2 text-xs text-yellow-700 underline font-medium">
              Set up Availity connection →
            </button>
          </div>
        </div>
      )}

      {/* TABS */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { key: "claims", label: `Claims (${claims.length})` },
          { key: "setup", label: "⚙️ Setup" },
          { key: "reports", label: "📊 Reports" },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* NEW CLAIM FORM */}
      {showForm && activeTab === "claims" && (
        <Section title="New EDI Claim">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client Name *</label>
              <input type="text" value={form.client_name}
                onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))}
                placeholder="Client full name"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">CPT Code *</label>
              <select value={form.cpt_code}
                onChange={e => setForm(p => ({ ...p, cpt_code: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select CPT code...</option>
                {["97151", "97153", "97154", "97155", "97156", "97157", "97158"].map(code => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Date of Service *</label>
              <input type="date" value={form.date_of_service}
                onChange={e => setForm(p => ({ ...p, date_of_service: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Amount ($)</label>
              <input type="number" value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="0.00"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Payer / Insurance *</label>
              <select value={form.payer}
                onChange={e => setForm(p => ({ ...p, payer: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select payer...</option>
                {PAYERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSaveClaim} disabled={saving || !form.client_name || !form.cpt_code || !form.payer}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
              {saving ? "Saving..." : "Save Claim"}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </Section>
      )}

      {/* CLAIMS LIST */}
      {activeTab === "claims" && (
        <div className="space-y-3">
          {loading && <p className="text-gray-400 text-sm">Loading claims...</p>}
          {!loading && claims.length === 0 && (
            <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-gray-600 font-medium">No claims yet</p>
              <p className="text-gray-400 text-sm mt-1">Create your first EDI claim to get started.</p>
            </div>
          )}
          {claims.map(claim => (
            <div key={claim.id} className="border border-gray-100 rounded-xl p-4 bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-800">{claim.client_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[claim.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {claim.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    CPT: {claim.cpt_code} · {claim.payer} · {claim.date_of_service}
                    {claim.amount > 0 && ` · $${claim.amount.toFixed(2)}`}
                  </p>
                  {claim.submitted_at && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Submitted {new Date(claim.submitted_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {claim.status === "draft" && (
                    <button onClick={() => handleSubmitClaim(claim.id)}
                      className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                      Submit →
                    </button>
                  )}
                  {claim.status === "submitted" && (
                    <button onClick={async () => {
                      await supabase.from("edi_claims").update({ status: "accepted" }).eq("id", claim.id);
                      setClaims(prev => prev.map(c => c.id === claim.id ? { ...c, status: "accepted" } : c));
                    }}
                      className="text-xs px-3 py-1.5 border border-green-200 text-green-600 rounded-lg hover:bg-green-50 transition-colors">
                      Mark Accepted
                    </button>
                  )}
                  {claim.status === "accepted" && (
                    <button onClick={async () => {
                      await supabase.from("edi_claims").update({ status: "paid" }).eq("id", claim.id);
                      setClaims(prev => prev.map(c => c.id === claim.id ? { ...c, status: "paid" } : c));
                    }}
                      className="text-xs px-3 py-1.5 border border-purple-200 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors">
                      Mark Paid
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SETUP TAB */}
      {activeTab === "setup" && (
        <div className="space-y-4">
          <Section title="Availity Connection">
            <p className="text-sm text-gray-600 mb-4">
              Connect your Availity account to submit EDI 837 claims electronically. 
              You'll need your Availity API credentials from your Availity account settings.
            </p>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">How to get your Availity credentials:</p>
              <p>1. Log in at <a href="https://www.availity.com" target="_blank" rel="noopener noreferrer" className="underline">availity.com</a></p>
              <p>2. Go to Settings → API Access → Create API Key</p>
              <p>3. Copy your API Key and Organization ID below</p>
            </div>

            {connectionSaved && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 mb-3">
                ✓ Availity credentials saved successfully.
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Availity API Key</label>
                <input type="password" value={availityApiKey}
                  onChange={e => setAvailityApiKey(e.target.value)}
                  placeholder="Your Availity API key"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Organization ID</label>
                <input type="text" value={availityOrgId}
                  onChange={e => setAvailityOrgId(e.target.value)}
                  placeholder="Your Availity organization ID"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <button onClick={saveAvailityConnection}
                disabled={savingConnection || !availityApiKey || !availityOrgId}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                {savingConnection ? "Saving..." : "Save Connection"}
              </button>
            </div>
          </Section>

          <Section title="Other Clearinghouses">
            <p className="text-sm text-gray-500 mb-3">Coming soon — support for additional clearinghouses:</p>
            <div className="space-y-2">
              {["Office Ally", "Change Healthcare", "Waystar", "TriZetto"].map(ch => (
                <div key={ch} className="flex items-center justify-between border border-gray-100 rounded-lg p-3 bg-white">
                  <span className="text-sm text-gray-700">{ch}</span>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">Coming Soon</span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* REPORTS TAB */}
      {activeTab === "reports" && (
        <Section title="Claims Summary">
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Status</th>
                    <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">Count</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {["draft", "submitted", "accepted", "paid", "rejected"].map(status => {
                    const statusClaims = claims.filter(c => c.status === status);
                    const total = statusClaims.reduce((sum, c) => sum + (c.amount ?? 0), 0);
                    return (
                      <tr key={status} className="border-b border-gray-50">
                        <td className="py-3 px-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600"}`}>
                            {status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-gray-800">{statusClaims.length}</td>
                        <td className="py-3 px-3 text-right text-gray-600">${total.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-gray-200">
                    <td className="py-3 px-3 font-bold text-gray-800">Total</td>
                    <td className="py-3 px-3 text-center font-bold text-gray-800">{claims.length}</td>
                    <td className="py-3 px-3 text-right font-bold text-blue-600">${totalBilled.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700">
              💡 Export claims data from the audit log for your accountant or billing team.
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}