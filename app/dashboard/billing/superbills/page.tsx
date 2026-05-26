"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import jsPDF from "jspdf";

type Client = { id: string; full_name: string; diagnosis: string | null };
type CPTItem = { code: string; description: string; units: number; rate: number };
type Superbill = {
  id: string;
  client_id: string;
  provider_name: string;
  provider_npi: string;
  service_date: string;
  diagnosis_code: string;
  cpt_codes: CPTItem[];
  total_amount: number;
  status: string;
  created_at: string;
};

const CPT_OPTIONS = [
  { code: "97153", description: "ABA Treatment by Protocol", defaultRate: 15 },
  { code: "97154", description: "Group ABA Treatment", defaultRate: 10 },
  { code: "97155", description: "Protocol Modification by BCBA", defaultRate: 20 },
  { code: "97156", description: "Family Guidance by BCBA", defaultRate: 20 },
  { code: "97157", description: "Multiple Family Group", defaultRate: 15 },
  { code: "97158", description: "Group Protocol Modification", defaultRate: 15 },
];

const ICD10_CODES = [
  "F84.0 — Autistic Disorder",
  "F84.5 — Asperger Syndrome",
  "F84.9 — Pervasive Developmental Disorder",
  "F70 — Mild Intellectual Disability",
  "F90.2 — ADHD Combined",
];

export default function SuperbillsPage() {
  const [superbills, setSuperbills] = useState<Superbill[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState("");
  const [providerName, setProviderName] = useState("");
  const [providerNpi, setProviderNpi] = useState("");
  const [providerLicense, setProviderLicense] = useState("");
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [diagnosisCode, setDiagnosisCode] = useState("");
  const [cptItems, setCptItems] = useState<CPTItem[]>([]);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: sbData }] = await Promise.all([
      supabase.from("clients").select("id, full_name, diagnosis"),
      supabase.from("superbills").select("*").eq("created_by", user.id).order("created_at", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setSuperbills((sbData ?? []).map((s: any) => ({ ...s, cpt_codes: Array.isArray(s.cpt_codes) ? s.cpt_codes : JSON.parse(s.cpt_codes || "[]") })));
    setLoading(false);
  }

  function addCPT(code: string) {
    const option = CPT_OPTIONS.find((o) => o.code === code);
    if (!option || cptItems.find((i) => i.code === code)) return;
    setCptItems((prev) => [...prev, { code: option.code, description: option.description, units: 1, rate: option.defaultRate }]);
  }

  function updateCPT(code: string, field: "units" | "rate", value: number) {
    setCptItems((prev) => prev.map((item) => item.code === code ? { ...item, [field]: value } : item));
  }

  function removeCPT(code: string) {
    setCptItems((prev) => prev.filter((item) => item.code !== code));
  }

  function calculateTotal() {
    return cptItems.reduce((total, item) => total + (item.units * item.rate), 0);
  }

  async function handleSave() {
    if (!clientId || cptItems.length === 0) { setError("Client and at least one CPT code are required."); return; }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const total = calculateTotal();

    const { data, error: saveError } = await supabase.from("superbills").insert([{
      client_id: clientId,
      provider_name: providerName,
      provider_npi: providerNpi,
      provider_license: providerLicense,
      service_date: serviceDate,
      diagnosis_code: diagnosisCode,
      cpt_codes: JSON.stringify(cptItems),
      total_amount: total,
      status: "draft",
      created_by: user.id,
    }]).select().single();

    if (saveError) { setError(saveError.message); setSaving(false); return; }

    setSuperbills((prev) => [{ ...data, cpt_codes: cptItems }, ...prev]);
    setShowForm(false);
    setClientId(""); setProviderName(""); setProviderNpi(""); setDiagnosisCode(""); setCptItems([]);
    setSaving(false);
  }

  function exportPDF(superbill: Superbill) {
    const client = clients.find((c) => c.id === superbill.client_id);
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("SUPERBILL", 105, 20, { align: "center" });

    doc.setFontSize(11);
    doc.text("ABA AI Assistant — Clinical Practice", 105, 28, { align: "center" });

    doc.setLineWidth(0.5);
    doc.line(20, 33, 190, 33);

    let y = 42;
    doc.setFontSize(10);
    doc.text(`Client: ${client?.full_name ?? "Unknown"}`, 20, y); y += 7;
    doc.text(`Service Date: ${superbill.service_date}`, 20, y); y += 7;
    doc.text(`Diagnosis: ${superbill.diagnosis_code}`, 20, y); y += 7;
    if (superbill.provider_name) { doc.text(`Provider: ${superbill.provider_name}`, 20, y); y += 7; }
    if (superbill.provider_npi) { doc.text(`NPI: ${superbill.provider_npi}`, 20, y); y += 7; }

    y += 5;
    doc.line(20, y, 190, y); y += 8;
    doc.setFontSize(10);
    doc.text("CPT Code", 20, y);
    doc.text("Description", 55, y);
    doc.text("Units", 145, y);
    doc.text("Rate", 162, y);
    doc.text("Total", 178, y);
    y += 5;
    doc.line(20, y, 190, y); y += 6;

    superbill.cpt_codes.forEach((item) => {
      doc.text(item.code, 20, y);
      doc.text(item.description.substring(0, 40), 55, y);
      doc.text(item.units.toString(), 145, y);
      doc.text(`$${item.rate}`, 162, y);
      doc.text(`$${(item.units * item.rate).toFixed(2)}`, 178, y);
      y += 7;
    });

    y += 3;
    doc.line(20, y, 190, y); y += 8;
    doc.setFontSize(12);
    doc.text(`TOTAL: $${superbill.total_amount.toFixed(2)}`, 178, y, { align: "right" });

    y += 20;
    doc.setFontSize(9);
    doc.text("This superbill is for insurance reimbursement purposes. Please submit to your insurance provider.", 105, y, { align: "center" });

    doc.save(`superbill-${client?.full_name?.replace(/\s/g, "-")}-${superbill.service_date}.pdf`);
  }

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  return (
    <div className="space-y-6">
      <PageHeader title="Superbills">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Generate Superbill"}
        </Button>
      </PageHeader>

      {showForm && (
        <Section title="Generate Superbill">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
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
              <label className="text-sm font-medium text-gray-700 mb-1 block">Service Date</label>
              <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Diagnosis Code (ICD-10)</label>
              <select value={diagnosisCode} onChange={(e) => setDiagnosisCode(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select diagnosis...</option>
                {ICD10_CODES.map((c) => <option key={c} value={c.split(" — ")[0]}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Provider Name</label>
              <input type="text" value={providerName} onChange={(e) => setProviderName(e.target.value)}
                placeholder="BCBA name" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">NPI Number</label>
              <input type="text" value={providerNpi} onChange={(e) => setProviderNpi(e.target.value)}
                placeholder="10-digit NPI" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">License Number</label>
              <input type="text" value={providerLicense} onChange={(e) => setProviderLicense(e.target.value)}
                placeholder="State license #" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          {/* CPT CODES */}
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Add CPT Codes</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {CPT_OPTIONS.map((opt) => (
                <button key={opt.code} onClick={() => addCPT(opt.code)}
                  disabled={!!cptItems.find((i) => i.code === opt.code)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${cptItems.find((i) => i.code === opt.code) ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:border-blue-300"}`}>
                  {opt.code}
                </button>
              ))}
            </div>

            {cptItems.length > 0 && (
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs text-gray-500">Code</th>
                      <th className="text-left px-4 py-2 text-xs text-gray-500">Description</th>
                      <th className="text-center px-4 py-2 text-xs text-gray-500">Units</th>
                      <th className="text-center px-4 py-2 text-xs text-gray-500">Rate/Unit</th>
                      <th className="text-right px-4 py-2 text-xs text-gray-500">Total</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cptItems.map((item) => (
                      <tr key={item.code} className="border-t border-gray-100">
                        <td className="px-4 py-2 font-mono font-bold text-blue-700">{item.code}</td>
                        <td className="px-4 py-2 text-xs text-gray-600">{item.description}</td>
                        <td className="px-4 py-2">
                          <input type="number" min={1} value={item.units} onChange={(e) => updateCPT(item.code, "units", parseInt(e.target.value) || 1)}
                            className="w-16 border rounded px-2 py-1 text-xs text-center focus:outline-none" />
                        </td>
                        <td className="px-4 py-2">
                          <input type="number" step="0.01" value={item.rate} onChange={(e) => updateCPT(item.code, "rate", parseFloat(e.target.value) || 0)}
                            className="w-20 border rounded px-2 py-1 text-xs text-center focus:outline-none" />
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-gray-800">${(item.units * item.rate).toFixed(2)}</td>
                        <td className="px-4 py-2">
                          <button onClick={() => removeCPT(item.code)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gray-300 bg-gray-50">
                      <td colSpan={4} className="px-4 py-2 text-sm font-bold text-gray-700 text-right">TOTAL</td>
                      <td className="px-4 py-2 text-right font-bold text-green-700">${calculateTotal().toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} loading={saving} disabled={!clientId || cptItems.length === 0}>
              Generate Superbill
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && superbills.length === 0 && (
        <Section title="Superbills">
          <p className="text-gray-400 text-sm">No superbills generated yet.</p>
        </Section>
      )}

      <div className="space-y-3">
        {superbills.map((sb) => (
          <div key={sb.id} className="border border-gray-100 rounded-xl p-4 bg-white">
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <p className="font-semibold text-gray-800">{clientMap.get(sb.client_id) ?? "Unknown"}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {sb.service_date}
                  {sb.diagnosis_code && ` · ICD-10: ${sb.diagnosis_code}`}
                  {sb.provider_name && ` · ${sb.provider_name}`}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {sb.cpt_codes.map((item) => (
                    <span key={item.code} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                      {item.code} × {item.units}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <p className="text-lg font-bold text-green-600">${sb.total_amount.toFixed(2)}</p>
                <Button variant="outline" onClick={() => exportPDF(sb)}>
                  📄 PDF
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}