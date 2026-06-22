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
  npi: string | null;
  diagnosis_code: string | null;
  units: number | null;
  submitted_at: string | null;
  edi_file: string | null;
  created_at: string;
};

const PAYERS = [
  "Aetna", "Anthem", "BlueCross BlueShield", "Cigna", "Humana",
  "Medicaid", "Medicare", "Tricare", "UnitedHealthcare", "Other",
];

const CPT_CODES = [
  { code: "97151", desc: "Behavior Identification Assessment" },
  { code: "97153", desc: "Adaptive Behavior Treatment (RBT)" },
  { code: "97154", desc: "Group Adaptive Behavior Treatment" },
  { code: "97155", desc: "Adaptive Behavior Treatment w/ Protocol Modification (BCBA)" },
  { code: "97156", desc: "Family Adaptive Behavior Treatment" },
  { code: "97157", desc: "Multiple Family Group Adaptive Behavior Treatment" },
  { code: "97158", desc: "Group Adaptive Behavior Treatment w/ Protocol Modification" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  ready: "bg-blue-100 text-blue-700",
  submitted: "bg-yellow-100 text-yellow-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  paid: "bg-purple-100 text-purple-700",
};

function generateEDI837(claim: Claim, clinicName: string, officeAllyId: string): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = now.toTimeString().slice(0, 5).replace(":", "");
  const dos = claim.date_of_service.replace(/-/g, "");
  const amount = (claim.amount ?? 0).toFixed(2);
  const units = claim.units ?? 1;
  const npi = claim.npi ?? "0000000000";
  const dx = claim.diagnosis_code ?? "F84.0";

  return [
    `ISA*00*          *00*          *ZZ*${officeAllyId.padEnd(15)}*ZZ*OFFICEALLY     *${dateStr.slice(2)}*${timeStr}*^*00501*000000001*0*P*:~`,
    `GS*HC*${officeAllyId}*OFFICEALLY*${dateStr}*${timeStr}*1*X*005010X222A1~`,
    `ST*837*0001*005010X222A1~`,
    `BPR*22*${amount}*C*ACH*CCP*01*${officeAllyId}*DA*000000000*${dateStr}~`,
    `NM1*41*2*${clinicName}*****46*${officeAllyId}~`,
    `PER*IC*BILLING*TE*5403227543~`,
    `NM1*40*2*${claim.payer.toUpperCase()}*****46*00000~`,
    `HL*1**20*1~`,
    `NM1*85*2*${clinicName}*****XX*${npi}~`,
    `HL*2*1*22*0~`,
    `SBR*P*18*******MB~`,
    `NM1*IL*1*${claim.client_name.split(" ").slice(-1)[0]}*${claim.client_name.split(" ")[0]}****MI*000000000~`,
    `NM1*PR*2*${claim.payer.toUpperCase()}*****PI*00000~`,
    `CLM*${claim.id.slice(0, 8)}*${amount}***11:B:1*Y*A*Y*I~`,
    `DTP*472*D8*${dos}~`,
    `HI*ABK:${dx}~`,
    `NM1*82*1*PROVIDER*BILLING****XX*${npi}~`,
    `LX*1~`,
    `SV1*HC:${claim.cpt_code}*${amount}*UN*${units}***1~`,
    `DTP*472*D8*${dos}~`,
    `SE*19*0001~`,
    `GE*1*1~`,
    `IEA*1*000000001~`,
  ].join("\n");
}

export default function ClearinghousePage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"claims" | "setup" | "payers" | "reports">("claims");
  const [clinicName, setClinicName] = useState("");
  const [officeAllyId, setOfficeAllyId] = useState("");
  const [npiNumber, setNpiNumber] = useState("");
  const [savingSetup, setSavingSetup] = useState(false);
  const [setupSaved, setSetupSaved] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [generatingEDI, setGeneratingEDI] = useState<string | null>(null);

  const { hasFeature, planName } = usePlanGate();
  const ediGate = hasFeature("edi");

  const [form, setForm] = useState({
    client_name: "",
    cpt_code: "",
    date_of_service: new Date().toISOString().split("T")[0],
    amount: "",
    payer: "",
    npi: "",
    diagnosis_code: "F84.0",
    units: "1",
  });

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id, companies(name, office_ally_id, npi)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (companyUser?.company_id) {
      setCompanyId(companyUser.company_id);
      const company = companyUser.companies as any;
      setClinicName(company?.name ?? "");
      setOfficeAllyId(company?.office_ally_id ?? "");
      setNpiNumber(company?.npi ?? "");
    }

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
      npi: form.npi || npiNumber || null,
      diagnosis_code: form.diagnosis_code || null,
      units: parseInt(form.units) || 1,
      status: "draft",
      created_by: user.id,
    }).select().maybeSingle();

    if (data) setClaims(prev => [data, ...prev]);
    setForm({ client_name: "", cpt_code: "", date_of_service: new Date().toISOString().split("T")[0], amount: "", payer: "", npi: "", diagnosis_code: "F84.0", units: "1" });
    setShowForm(false);
    setSaving(false);
  }

  async function handleGenerateEDI(claim: Claim) {
    setGeneratingEDI(claim.id);
    const ediContent = generateEDI837(claim, clinicName, officeAllyId || "1307531");
    await supabase.from("edi_claims").update({ edi_file: ediContent, status: "ready" }).eq("id", claim.id);
    setClaims(prev => prev.map(c => c.id === claim.id ? { ...c, edi_file: ediContent, status: "ready" } : c));
    const blob = new Blob([ediContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `claim_${claim.id.slice(0, 8)}_${claim.date_of_service}.837`;
    a.click();
    URL.revokeObjectURL(url);
    setGeneratingEDI(null);
  }

  async function handleSubmitClaim(claim: Claim) {
    if (!claim.edi_file) { alert("Please generate the EDI 837 file first."); return; }
    await supabase.from("edi_claims").update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
    }).eq("id", claim.id);
    setClaims(prev => prev.map(c => c.id === claim.id ? { ...c, status: "submitted", submitted_at: new Date().toISOString() } : c));
    window.open("https://cms.officeally.com", "_blank");
    alert("EDI file downloaded. Log in to Office Ally and upload it under Claims → Submit Claims.");
  }

  async function saveSetup() {
    if (!companyId) return;
    setSavingSetup(true);
    await supabase.from("companies").update({
      office_ally_id: officeAllyId,
      npi: npiNumber,
    } as any).eq("id", companyId);
    setSavingSetup(false);
    setSetupSaved(true);
    setTimeout(() => setSetupSaved(false), 3000);
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
            EDI 837 is the electronic format used to submit insurance claims to payers through a clearinghouse like Office Ally.
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

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
        <p className="text-sm font-semibold text-amber-800">Before submitting EDI claims, your clinic needs:</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-amber-700">
          <div className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">⚠️</span>
            <div>
              <p className="font-semibold">Your own NPI Number</p>
              <p>Individual (Type 1) or Organization (Type 2) NPI required for all claims.</p>
              <a href="https://nppes.cms.hhs.gov" target="_blank" rel="noopener noreferrer" className="underline mt-0.5 block">Apply at nppes.cms.hhs.gov →</a>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">⚠️</span>
            <div>
              <p className="font-semibold">Payer Contracts & Enrollment</p>
              <p>You must be enrolled with each payer before submitting claims to them.</p>
              <a href="https://cms.officeally.com/Pages/ResourceCenter/PayerEDIEnrollmentForms.aspx" target="_blank" rel="noopener noreferrer" className="underline mt-0.5 block">Enroll at Office Ally →</a>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">⚠️</span>
            <div>
              <p className="font-semibold">Business Bank Account</p>
              <p>Insurance payments are deposited directly to your clinic bank account.</p>
            </div>
          </div>
        </div>
      </div>

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

      <div className="flex items-center gap-2 text-xs text-gray-400 overflow-x-auto pb-1">
        {[
          { label: "✅ Approved", href: "/dashboard/billing/approved" },
          { label: "→" },
          { label: "📄 CMS-1500", href: "/dashboard/billing/cms1500" },
          { label: "→" },
          { label: "🔌 Clearinghouse", href: "" },
          { label: "→" },
          { label: "💰 ERA/EOB", href: "/dashboard/billing/era-eob" },
        ].map((step, i) => (
          step.label === "→" ? (
            <span key={i} className="text-gray-300 font-bold shrink-0">→</span>
          ) : step.href ? (
            <Link key={i} href={step.href} className="px-3 py-1.5 rounded-full border shrink-0 border-gray-200 hover:border-blue-300 hover:text-blue-600 transition-colors">
              {step.label}
            </Link>
          ) : (
            <span key={i} className="px-3 py-1.5 rounded-full border bg-blue-600 text-white border-blue-600 shrink-0">
              {step.label}
            </span>
          )
        ))}
      </div>

      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {[
          { key: "claims", label: `Claims (${claims.length})` },
          { key: "setup", label: "⚙️ Setup" },
          { key: "payers", label: "🏥 Payer Enrollment" },
          { key: "reports", label: "📊 Reports" },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {showForm && activeTab === "claims" && (
        <Section title="New EDI Claim">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client Name *</label>
              <input type="text" value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))}
                placeholder="Client full name" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">CPT Code *</label>
              <select value={form.cpt_code} onChange={e => setForm(p => ({ ...p, cpt_code: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select CPT code...</option>
                {CPT_CODES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.desc}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Date of Service *</label>
              <input type="date" value={form.date_of_service} onChange={e => setForm(p => ({ ...p, date_of_service: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Amount ($)</label>
              <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="0.00" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Units</label>
              <input type="number" value={form.units} onChange={e => setForm(p => ({ ...p, units: e.target.value }))}
                placeholder="1" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Diagnosis Code (ICD-10)</label>
              <input type="text" value={form.diagnosis_code} onChange={e => setForm(p => ({ ...p, diagnosis_code: e.target.value }))}
                placeholder="e.g. F84.0" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Rendering NPI</label>
              <input type="text" value={form.npi} onChange={e => setForm(p => ({ ...p, npi: e.target.value }))}
                placeholder={npiNumber || "10-digit NPI"} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Payer / Insurance *</label>
              <select value={form.payer} onChange={e => setForm(p => ({ ...p, payer: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select payer...</option>
                {PAYERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSaveClaim} disabled={saving || !form.client_name || !form.cpt_code || !form.payer}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving..." : "Save Claim"}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </Section>
      )}

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
              <div className="flex justify-between items-start flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-semibold text-gray-800">{claim.client_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[claim.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {claim.status}
                    </span>
                    {claim.edi_file && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">EDI Generated</span>}
                  </div>
                  <p className="text-xs text-gray-400">
                    CPT: {claim.cpt_code} · {claim.payer} · {claim.date_of_service}
                    {claim.amount > 0 && ` · $${claim.amount.toFixed(2)}`}
                    {claim.units && ` · ${claim.units} units`}
                    {claim.diagnosis_code && ` · ICD: ${claim.diagnosis_code}`}
                  </p>
                  {claim.submitted_at && (
                    <p className="text-xs text-gray-400 mt-0.5">Submitted {new Date(claim.submitted_at).toLocaleDateString()}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(claim.status === "draft" || claim.status === "ready") && (
                    <button onClick={() => handleGenerateEDI(claim)} disabled={generatingEDI === claim.id}
                      className="text-xs px-3 py-1.5 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50">
                      {generatingEDI === claim.id ? "Generating..." : "Generate EDI 837"}
                    </button>
                  )}
                  {claim.status === "ready" && (
                    <button onClick={() => handleSubmitClaim(claim)}
                      className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      Submit to Office Ally →
                    </button>
                  )}
                  {claim.status === "submitted" && (
                    <button onClick={async () => {
                      await supabase.from("edi_claims").update({ status: "accepted" }).eq("id", claim.id);
                      setClaims(prev => prev.map(c => c.id === claim.id ? { ...c, status: "accepted" } : c));
                    }} className="text-xs px-3 py-1.5 border border-green-200 text-green-600 rounded-lg hover:bg-green-50">
                      Mark Accepted
                    </button>
                  )}
                  {claim.status === "accepted" && (
                    <button onClick={async () => {
                      await supabase.from("edi_claims").update({ status: "paid" }).eq("id", claim.id);
                      setClaims(prev => prev.map(c => c.id === claim.id ? { ...c, status: "paid" } : c));
                    }} className="text-xs px-3 py-1.5 border border-purple-200 text-purple-600 rounded-lg hover:bg-purple-50">
                      Mark Paid
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "setup" && (
        <div className="space-y-4">
          <Section title="Office Ally Setup">
            <p className="text-sm text-gray-600 mb-4">Configure your clinic details for EDI claim generation.</p>
            {setupSaved && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 mb-3">✓ Setup saved successfully.</div>
            )}
            <div className="space-y-3 max-w-md">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Clinic NPI Number</label>
                <input type="text" value={npiNumber} onChange={e => setNpiNumber(e.target.value)}
                  placeholder="10-digit NPI" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <p className="text-xs text-gray-400 mt-1">
                  Don&apos;t have an NPI? <a href="https://nppes.cms.hhs.gov" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Apply at nppes.cms.hhs.gov →</a>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Office Ally Company ID</label>
                <input type="text" value={officeAllyId} onChange={e => setOfficeAllyId(e.target.value)}
                  placeholder="Your Office Ally Company ID" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <button onClick={saveSetup} disabled={savingSetup}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {savingSetup ? "Saving..." : "Save Setup"}
              </button>
            </div>
          </Section>
        </div>
      )}

      {activeTab === "payers" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-semibold mb-1">Payer Enrollment Required</p>
            <p className="text-xs">Before submitting claims to these payers, your clinic must complete EDI enrollment.</p>
          </div>
          {[
            { state: "Virginia", payers: [
              { name: "Medicare Virginia (Palmetto)", url: "https://cms.officeally.com/OfficeAlly/Forms/EDI/Medicare_VA_WV_PartB_EDI_ERA_ENR_PKT.pdf", required: true },
              { name: "Optima Health", url: "https://cms.officeally.com/Pages/ResourceCenter/PayerEDIEnrollmentForms.aspx", required: true },
              { name: "Sentara Health Plans", url: "https://cms.officeally.com/Pages/ResourceCenter/PayerEDIEnrollmentForms.aspx", required: true },
              { name: "Virginia Premier Health Plans", url: "https://cms.officeally.com/Pages/ResourceCenter/PayerEDIEnrollmentForms.aspx", required: false },
            ]},
            { state: "Georgia", payers: [
              { name: "Medicaid Georgia", url: "https://cms.officeally.com/Pages/ResourceCenter/PayerEDIEnrollmentForms.aspx", required: true },
              { name: "Medicare Georgia (Part B)", url: "https://cms.officeally.com/Pages/ResourceCenter/PayerEDIEnrollmentForms.aspx", required: true },
            ]},
            { state: "North Carolina", payers: [
              { name: "Medicaid North Carolina", url: "https://cms.officeally.com/Pages/ResourceCenter/PayerEDIEnrollmentForms.aspx", required: true },
              { name: "Alliance Behavioral Health", url: "https://cms.officeally.com/Pages/ResourceCenter/PayerEDIEnrollmentForms.aspx", required: true },
              { name: "Partners Behavioral Health", url: "https://cms.officeally.com/Pages/ResourceCenter/PayerEDIEnrollmentForms.aspx", required: true },
              { name: "Medicare North Carolina (Part B)", url: "https://cms.officeally.com/Pages/ResourceCenter/PayerEDIEnrollmentForms.aspx", required: true },
            ]},
            { state: "South Carolina", payers: [
              { name: "Medicaid South Carolina", url: "https://cms.officeally.com/Pages/ResourceCenter/PayerEDIEnrollmentForms.aspx", required: true },
              { name: "Medicare South Carolina (Part B)", url: "https://cms.officeally.com/OfficeAlly/Forms/EDI/Medicare_SC_PartB_EDI_ERA_ENR_PKT.pdf", required: true },
            ]},
            { state: "Florida", payers: [
              { name: "Medicaid Florida", url: "https://cms.officeally.com/Pages/ResourceCenter/PayerEDIEnrollmentForms.aspx", required: true },
              { name: "Medicare Florida (Part A)", url: "https://cms.officeally.com/Pages/ResourceCenter/PayerEDIEnrollmentForms.aspx", required: true },
              { name: "Medicare Florida (Part B)", url: "https://cms.officeally.com/Pages/ResourceCenter/PayerEDIEnrollmentForms.aspx", required: true },
              { name: "ICARE", url: "https://cms.officeally.com/Pages/ResourceCenter/PayerEDIEnrollmentForms.aspx", required: false },
            ]},
          ].map(state => (
            <Section key={state.state} title={`${state.state} Payers`}>
              <div className="space-y-2">
                {state.payers.map(payer => (
                  <div key={payer.name} className="flex items-center justify-between border border-gray-100 rounded-lg p-3 bg-white">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${payer.required ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>
                        {payer.required ? "Enrollment Required" : "Optional"}
                      </span>
                      <span className="text-sm text-gray-800">{payer.name}</span>
                    </div>
                    <a href={payer.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs px-3 py-1.5 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50">
                      Enroll →
                    </a>
                  </div>
                ))}
              </div>
            </Section>
          ))}
        </div>
      )}

      {activeTab === "reports" && (
        <Section title="Claims Summary">
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
                {["draft", "ready", "submitted", "accepted", "paid", "rejected"].map(status => {
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
        </Section>
      )}
    </div>
  );
}