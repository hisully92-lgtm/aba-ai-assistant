"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type EligibilityCheck = {
  id: string;
  client_id: string;
  insurance_provider: string;
  member_id: string | null;
  check_date: string;
  status: string;
  eligible: boolean | null;
  deductible: number;
  deductible_met: number;
  copay: number;
  coinsurance: number;
  out_of_pocket_max: number;
  notes: string | null;
  created_at: string;
};

const PROVIDERS = ["Blue Cross Blue Shield", "UnitedHealthcare", "Aetna", "Cigna", "Humana", "Medicaid", "TRICARE", "Kaiser Permanente", "Other"];

const emptyForm = {
  client_id: "",
  insurance_provider: "",
  member_id: "",
  check_date: new Date().toISOString().split("T")[0],
  deductible: 0,
  deductible_met: 0,
  copay: 0,
  coinsurance: 0,
  out_of_pocket_max: 0,
  notes: "",
};

export default function EligibilityPage() {
  const [checks, setChecks] = useState<EligibilityCheck[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [npiResult, setNpiResult] = useState<any>(null);
  const [npiInput, setNpiInput] = useState("");

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: checkData }] = await Promise.all([
      supabase.from("clients").select("id, full_name"),
      supabase.from("eligibility_checks").select("*").eq("created_by", user.id).order("check_date", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setChecks(checkData ?? []);
    setLoading(false);
  }

  async function handleSave(eligible: boolean) {
    if (!form.client_id || !form.insurance_provider) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("eligibility_checks").insert([{
      ...form,
      member_id: form.member_id || null,
      eligible,
      status: "verified",
      created_by: user.id,
    }]).select().single();

    if (data) setChecks((prev) => [data, ...prev]);
    setForm(emptyForm);
    setShowForm(false);
    setSaving(false);
  }

  async function verifyNPI() {
    if (!npiInput) return;
    setVerifying(true);
    try {
      const res = await fetch(`/api/npi/verify?npi=${npiInput}`);
      const data = await res.json();
      setNpiResult(data.results?.[0] ?? null);
    } catch { setNpiResult(null); }
    setVerifying(false);
  }

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));
  const remainingDeductible = (form.deductible - form.deductible_met).toFixed(2);

  return (
    <div className="space-y-6">
      <PageHeader title="Insurance Eligibility">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Verify Eligibility"}
        </Button>
      </PageHeader>

      {/* NPI VERIFIER */}
      <Section title="NPI Provider Verification">
        <p className="text-xs text-gray-500 mb-3">Verify any provider NPI number against the CMS NPPES database (free, no API key required)</p>
        <div className="flex gap-3">
          <input type="text" value={npiInput} onChange={(e) => setNpiInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && verifyNPI()}
            placeholder="Enter 10-digit NPI..."
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          <Button onClick={verifyNPI} loading={verifying}>Verify NPI</Button>
        </div>
        {npiResult && (
          <div className={`mt-3 p-3 rounded-lg border text-sm ${npiResult.status === "A" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
            <p className="font-bold">{npiResult.status === "A" ? "✓ Active NPI" : "⚠️ Inactive NPI"}</p>
            <p>Name: {npiResult.name}</p>
            {npiResult.credential && <p>Credential: {npiResult.credential}</p>}
            {npiResult.taxonomy && <p>Taxonomy: {npiResult.taxonomy}</p>}
            {npiResult.address && <p>Address: {npiResult.address}</p>}
          </div>
        )}
      </Section>

      {showForm && (
        <Section title="Verify Client Eligibility">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
              <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Insurance Provider *</label>
              <select value={form.insurance_provider} onChange={(e) => setForm({ ...form, insurance_provider: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select provider...</option>
                {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Member ID</label>
              <input type="text" value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Check Date</label>
              <input type="date" value={form.check_date} onChange={(e) => setForm({ ...form, check_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Coverage Details</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            {[
              { label: "Deductible ($)", key: "deductible" },
              { label: "Deductible Met ($)", key: "deductible_met" },
              { label: "Co-pay ($)", key: "copay" },
              { label: "Co-insurance (%)", key: "coinsurance" },
              { label: "Out-of-Pocket Max ($)", key: "out_of_pocket_max" },
            ].map((field) => (
              <div key={field.key}>
                <label className="text-sm font-medium text-gray-700 mb-1 block">{field.label}</label>
                <input type="number" step="0.01" value={(form as any)[field.key]}
                  onChange={(e) => setForm({ ...form, [field.key]: parseFloat(e.target.value) || 0 })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            ))}
          </div>

          {form.deductible > 0 && (
            <div className={`p-3 rounded-lg border mb-4 text-sm ${parseFloat(remainingDeductible) <= 0 ? "bg-green-50 border-green-200 text-green-700" : "bg-yellow-50 border-yellow-200 text-yellow-700"}`}>
              Remaining deductible: ${remainingDeductible}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={() => handleSave(true)} loading={saving} className="bg-green-600 hover:bg-green-700">
              ✓ Eligible
            </Button>
            <Button onClick={() => handleSave(false)} loading={saving} variant="danger">
              ✗ Not Eligible
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}

      <div className="space-y-3">
        {checks.map((check) => (
          <div key={check.id} className={`border rounded-xl p-4 bg-white ${check.eligible ? "border-green-200" : check.eligible === false ? "border-red-200" : "border-gray-100"}`}>
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-800">{clientMap.get(check.client_id) ?? "Unknown"}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${check.eligible ? "bg-green-100 text-green-700" : check.eligible === false ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>
                    {check.eligible ? "✓ Eligible" : check.eligible === false ? "✗ Not Eligible" : "Pending"}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{check.insurance_provider} · {check.check_date}{check.member_id && ` · ${check.member_id}`}</p>
                <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                  {check.copay > 0 && <span>Co-pay: ${check.copay}</span>}
                  {check.deductible > 0 && <span>Deductible: ${check.deductible_met}/${check.deductible}</span>}
                  {check.coinsurance > 0 && <span>Co-insurance: {check.coinsurance}%</span>}
                </div>
                {check.notes && <p className="text-xs text-gray-500 mt-1">{check.notes}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}