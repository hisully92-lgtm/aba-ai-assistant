"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import jsPDF from "jspdf";

type Client = { id: string; full_name: string; diagnosis: string | null };
type Claim = {
  id: string;
  client_id: string;
  insurance_provider: string;
  member_id: string;
  authorization_number: string;
  diagnosis_codes: string[];
  service_lines: ServiceLine[];
  provider_npi: string;
  provider_name: string;
  billing_npi: string;
  billing_provider_name: string;
  total_charge: number;
  service_from_date: string;
  service_to_date: string;
  status: string;
  created_at: string;
};
type ServiceLine = { cpt: string; modifier: string; units: number; charge: number; date: string };

const CPT_OPTIONS = ["97153", "97154", "97155", "97156", "97157", "97158"];
const ICD10_OPTIONS = ["F84.0", "F84.5", "F84.9", "F70", "F71", "F90.2", "F80.2"];
const PROVIDERS = ["Blue Cross Blue Shield", "UnitedHealthcare", "Aetna", "Cigna", "Humana", "Medicaid", "TRICARE", "Other"];

const emptyLine: ServiceLine = { cpt: "97153", modifier: "", units: 1, charge: 0, date: new Date().toISOString().split("T")[0] };

export default function CMS1500Page() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [clientId, setClientId] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [memberId, setMemberId] = useState("");
  const [authNumber, setAuthNumber] = useState("");
  const [diagnosisCodes, setDiagnosisCodes] = useState<string[]>(["F84.0"]);
  const [serviceLines, setServiceLines] = useState<ServiceLine[]>([{ ...emptyLine }]);
  const [providerNpi, setProviderNpi] = useState("");
  const [providerName, setProviderName] = useState("");
  const [billingNpi, setBillingNpi] = useState("");
  const [billingName, setBillingName] = useState("");
  const [fromDate, setFromDate] = useState(new Date().toISOString().split("T")[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: claimData }] = await Promise.all([
      supabase.from("clients").select("id, full_name, diagnosis"),
      supabase.from("cms1500_claims").select("*").eq("created_by", user.id).order("created_at", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setClaims((claimData ?? []).map((c: any) => ({
      ...c,
      diagnosis_codes: Array.isArray(c.diagnosis_codes) ? c.diagnosis_codes : JSON.parse(c.diagnosis_codes || "[]"),
      service_lines: Array.isArray(c.service_lines) ? c.service_lines : JSON.parse(c.service_lines || "[]"),
    })));
    setLoading(false);
  }

  function addServiceLine() { setServiceLines((prev) => [...prev, { ...emptyLine }]); }
  function updateLine(i: number, field: keyof ServiceLine, value: any) {
    setServiceLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  }
  function removeLine(i: number) { setServiceLines((prev) => prev.filter((_, idx) => idx !== i)); }
  function totalCharge() { return serviceLines.reduce((a, b) => a + (b.units * b.charge), 0); }

  async function handleSave(status: string) {
    if (!clientId || !insuranceProvider || serviceLines.length === 0) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("cms1500_claims").insert([{
      client_id: clientId,
      insurance_provider: insuranceProvider,
      member_id: memberId,
      authorization_number: authNumber,
      diagnosis_codes: JSON.stringify(diagnosisCodes),
      service_lines: JSON.stringify(serviceLines),
      provider_npi: providerNpi,
      provider_name: providerName,
      billing_npi: billingNpi,
      billing_provider_name: billingName,
      total_charge: totalCharge(),
      service_from_date: fromDate,
      service_to_date: toDate,
      status,
      created_by: user.id,
    }]).select().single();

    if (data) setClaims((prev) => [{ ...data, diagnosis_codes: diagnosisCodes, service_lines: serviceLines }, ...prev]);
    setShowForm(false);
    setSaving(false);
  }

  function exportPDF(claim: Claim) {
    const client = clients.find((c) => c.id === claim.client_id);
    const doc = new jsPDF();

    doc.setFontSize(14);
    doc.text("CMS-1500 HEALTH INSURANCE CLAIM FORM", 105, 15, { align: "center" });
    doc.setFontSize(9);

    let y = 30;
    const field = (label: string, value: string, x: number, yPos: number) => {
      doc.setFont("helvetica", "bold");
      doc.text(label + ":", x, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(value, x + 35, yPos);
    };

    field("Patient Name", client?.full_name ?? "", 20, y); y += 7;
    field("Insurance", claim.insurance_provider, 20, y); y += 7;
    field("Member ID", claim.member_id ?? "", 20, y); y += 7;
    field("Auth #", claim.authorization_number ?? "", 20, y); y += 7;
    field("Diagnosis", claim.diagnosis_codes.join(", "), 20, y); y += 7;
    field("Service Dates", `${claim.service_from_date} to ${claim.service_to_date}`, 20, y); y += 7;
    field("Provider NPI", claim.provider_npi ?? "", 20, y); y += 7;
    field("Provider", claim.provider_name ?? "", 20, y); y += 7;
    field("Billing NPI", claim.billing_npi ?? "", 20, y); y += 7;
    field("Billing Provider", claim.billing_provider_name ?? "", 20, y); y += 10;

    doc.line(20, y, 190, y); y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("CPT Code", 20, y);
    doc.text("Modifier", 55, y);
    doc.text("Units", 85, y);
    doc.text("Charge", 110, y);
    doc.text("Total", 145, y);
    doc.text("Date", 165, y);
    y += 5;
    doc.line(20, y, 190, y); y += 5;

    doc.setFont("helvetica", "normal");
    claim.service_lines.forEach((line) => {
      doc.text(line.cpt, 20, y);
      doc.text(line.modifier || "--", 55, y);
      doc.text(String(line.units), 85, y);
      doc.text(`$${line.charge}`, 110, y);
      doc.text(`$${(line.units * line.charge).toFixed(2)}`, 145, y);
      doc.text(line.date, 165, y);
      y += 7;
    });

    y += 3;
    doc.line(20, y, 190, y); y += 6;
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL CHARGE: $${claim.total_charge.toFixed(2)}`, 165, y, { align: "right" });

    doc.save(`CMS1500-${client?.full_name?.replace(/\s/g, "-")}-${claim.service_from_date}.pdf`);
  }

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  function statusColor(status: string) {
    if (status === "submitted") return "bg-blue-100 text-blue-700";
    if (status === "paid") return "bg-green-100 text-green-700";
    if (status === "denied") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-600";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="CMS-1500 Claims">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Claim"}
        </Button>
      </PageHeader>

      {showForm && (
        <Section title="New CMS-1500 Claim">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Patient & Insurance</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Insurance Provider *</label>
              <select value={insuranceProvider} onChange={(e) => setInsuranceProvider(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select...</option>
                {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Member ID</label>
              <input type="text" value={memberId} onChange={(e) => setMemberId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Authorization Number</label>
              <input type="text" value={authNumber} onChange={(e) => setAuthNumber(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Service From Date</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Service To Date</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Diagnosis Codes</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {ICD10_OPTIONS.map((code) => (
              <button key={code} onClick={() => setDiagnosisCodes((prev) => prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code])}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${diagnosisCodes.includes(code) ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:border-blue-300"}`}>
                {code}
              </button>
            ))}
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Provider Information</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Rendering Provider Name</label>
              <input type="text" value={providerName} onChange={(e) => setProviderName(e.target.value)}
                placeholder="BCBA/Therapist name"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Rendering NPI</label>
              <input type="text" value={providerNpi} onChange={(e) => setProviderNpi(e.target.value)}
                placeholder="10-digit NPI"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Billing Provider Name</label>
              <input type="text" value={billingName} onChange={(e) => setBillingName(e.target.value)}
                placeholder="Practice/Agency name"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Billing NPI</label>
              <input type="text" value={billingNpi} onChange={(e) => setBillingNpi(e.target.value)}
                placeholder="Billing 10-digit NPI"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Service Lines</p>
          <div className="border border-gray-100 rounded-xl overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-xs text-gray-500">CPT</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-500">Modifier</th>
                  <th className="text-center px-3 py-2 text-xs text-gray-500">Units</th>
                  <th className="text-center px-3 py-2 text-xs text-gray-500">Charge/Unit</th>
                  <th className="text-center px-3 py-2 text-xs text-gray-500">Total</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-500">Date</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {serviceLines.map((line, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <select value={line.cpt} onChange={(e) => updateLine(i, "cpt", e.target.value)}
                        className="border rounded px-2 py-1 text-xs focus:outline-none w-20">
                        {CPT_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={line.modifier} onChange={(e) => updateLine(i, "modifier", e.target.value)}
                        placeholder="e.g. GT" className="border rounded px-2 py-1 text-xs w-16 focus:outline-none" />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="number" min={1} value={line.units} onChange={(e) => updateLine(i, "units", parseInt(e.target.value) || 1)}
                        className="border rounded px-2 py-1 text-xs w-16 text-center focus:outline-none" />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="number" step="0.01" value={line.charge} onChange={(e) => updateLine(i, "charge", parseFloat(e.target.value) || 0)}
                        className="border rounded px-2 py-1 text-xs w-20 text-center focus:outline-none" />
                    </td>
                    <td className="px-3 py-2 text-center font-medium text-blue-700">${(line.units * line.charge).toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <input type="date" value={line.date} onChange={(e) => updateLine(i, "date", e.target.value)}
                        className="border rounded px-2 py-1 text-xs focus:outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => removeLine(i)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={4} className="px-3 py-2 text-xs font-bold text-gray-700 text-right">TOTAL</td>
                  <td className="px-3 py-2 text-center font-bold text-green-700">${totalCharge().toFixed(2)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>
          <Button variant="outline" onClick={addServiceLine}>+ Add Service Line</Button>

          <div className="mt-4 flex gap-2">
            <Button onClick={() => handleSave("draft")} loading={saving} variant="outline">Save as Draft</Button>
            <Button onClick={() => handleSave("submitted")} loading={saving}>Submit Claim</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && claims.length === 0 && (
        <Section title="CMS-1500 Claims">
          <p className="text-gray-400 text-sm">No claims yet.</p>
        </Section>
      )}

      <div className="space-y-3">
        {claims.map((claim) => (
          <div key={claim.id} className="border border-gray-100 rounded-xl p-4 bg-white">
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <p className="font-semibold text-gray-800">{clientMap.get(claim.client_id) ?? "Unknown"}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {claim.insurance_provider} · {claim.service_from_date} to {claim.service_to_date}
                  {claim.member_id && ` · ${claim.member_id}`}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {claim.diagnosis_codes.map((code) => (
                    <span key={code} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{code}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <p className="text-lg font-bold text-green-600">${claim.total_charge.toFixed(2)}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(claim.status)}`}>
                  {claim.status}
                </span>
                <Button variant="outline" onClick={() => exportPDF(claim)}>📄 PDF</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}