"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Link from "next/link";
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
  time_entry_id: string | null;
  created_at: string;
};
type ServiceLine = { cpt: string; modifier: string; units: number; charge: number; date: string };

const CPT_OPTIONS = ["97151", "97152", "97153", "97154", "97155", "97156", "97157", "97158", "T1016"];
const ICD10_OPTIONS = ["F84.0", "F84.5", "F84.9", "F70", "F71", "F90.2", "F80.2"];
const PROVIDERS = ["Blue Cross Blue Shield", "UnitedHealthcare", "Aetna", "Cigna", "Humana", "Medicaid", "TRICARE", "Other"];

const STATUS_FLOW = [
  { key: "draft", label: "Draft", color: "bg-gray-100 text-gray-600" },
  { key: "submitted", label: "Submitted", color: "bg-blue-100 text-blue-700" },
  { key: "accepted", label: "Accepted", color: "bg-yellow-100 text-yellow-700" },
  { key: "paid", label: "Paid", color: "bg-green-100 text-green-700" },
  { key: "denied", label: "Denied", color: "bg-red-100 text-red-700" },
];

function CMS1500Inner() {
  const searchParams = useSearchParams()!;
  const [claims, setClaims] = useState<Claim[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");

  // Form state
  const [clientId, setClientId] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [memberId, setMemberId] = useState("");
  const [authNumber, setAuthNumber] = useState("");
  const [diagnosisCodes, setDiagnosisCodes] = useState<string[]>(["F84.0"]);
  const [serviceLines, setServiceLines] = useState<ServiceLine[]>([]);
  const [providerNpi, setProviderNpi] = useState("");
  const [providerName, setProviderName] = useState("");
  const [billingNpi, setBillingNpi] = useState("");
  const [billingName, setBillingName] = useState("");
  const [fromDate, setFromDate] = useState(new Date().toISOString().split("T")[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);
  const [timeEntryId, setTimeEntryId] = useState<string | null>(null);
  const [prefilledBanner, setPrefilledBanner] = useState(false);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: claimData }, { data: companySettings }] = await Promise.all([
      supabase.from("clients").select("id, full_name, diagnosis"),
      supabase.from("cms1500_claims").select("*").eq("created_by", user.id).order("created_at", { ascending: false }),
      supabase.from("company_users").select("company_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle(),
    ]);

    setClients(clientData ?? []);
    setClaims((claimData ?? []).map((c: any) => ({
      ...c,
      diagnosis_codes: Array.isArray(c.diagnosis_codes) ? c.diagnosis_codes : JSON.parse(c.diagnosis_codes || "[]"),
      service_lines: Array.isArray(c.service_lines) ? c.service_lines : JSON.parse(c.service_lines || "[]"),
    })));

    // Load company provider settings if available
    if (companySettings?.company_id) {
      const { data: company } = await supabase
        .from("companies")
        .select("billing_npi, billing_name, provider_npi, provider_name")
        .eq("id", companySettings.company_id)
        .maybeSingle();
      if (company) {
        if (company.billing_npi) setBillingNpi(company.billing_npi);
        if (company.billing_name) setBillingName(company.billing_name);
        if (company.provider_npi) setProviderNpi(company.provider_npi);
        if (company.provider_name) setProviderName(company.provider_name);
      }
    }

    // Read URL params from billing/approved CMS-1500 button
    const urlClientId = searchParams.get("client_id");
    const urlClientName = searchParams.get("client_name");
    const urlCptCode = searchParams.get("cpt_code");
    const urlDate = searchParams.get("date");
    const urlDuration = searchParams.get("duration_minutes");
    const urlEntryId = searchParams.get("time_entry_id");

    if (urlClientId) {
      setClientId(urlClientId);
      setTimeEntryId(urlEntryId);
      setShowForm(true);
      setPrefilledBanner(true);

      if (urlDate) {
        setFromDate(urlDate);
        setToDate(urlDate);
      }

      // Convert duration to units (1 unit = 15 min for ABA)
      const units = urlDuration ? Math.ceil(parseInt(urlDuration) / 15) : 1;
      setServiceLines([{
        cpt: urlCptCode ?? "97153",
        modifier: "",
        units,
        charge: 0,
        date: urlDate ?? new Date().toISOString().split("T")[0],
      }]);

      // Try to pull authorization info for this client
      if (urlClientId) {
        const { data: authData } = await supabase
          .from("authorizations")
          .select("*")
          .eq("client_id", urlClientId)
          .eq("status", "approved")
          .order("end_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (authData) {
          setAuthNumber(authData.authorization_number ?? "");
          if (authData.insurance_provider) setInsuranceProvider(authData.insurance_provider);
        }

        // Pull diagnosis from client intake
        const { data: intake } = await supabase
          .from("client_intake")
          .select("icd10_code, insurance_provider, member_id")
          .eq("client_id", urlClientId)
          .limit(1)
          .maybeSingle();
        if (intake) {
          if (intake.icd10_code) setDiagnosisCodes([intake.icd10_code]);
          if (intake.insurance_provider && !insuranceProvider) setInsuranceProvider(intake.insurance_provider);
          if (intake.member_id) setMemberId(intake.member_id);
        }
      }
    } else {
      // Default service line
      setServiceLines([{ cpt: "97153", modifier: "", units: 1, charge: 0, date: new Date().toISOString().split("T")[0] }]);
    }

    setLoading(false);
  }

  function addServiceLine() { setServiceLines((prev) => [...prev, { cpt: "97153", modifier: "", units: 1, charge: 0, date: fromDate }]); }
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
      time_entry_id: timeEntryId,
      created_by: user.id,
    }]).select().single();

    if (data) {
      setClaims((prev) => [{ ...data, diagnosis_codes: diagnosisCodes, service_lines: serviceLines }, ...prev]);
      // Reset form
      setShowForm(false);
      setPrefilledBanner(false);
      setTimeEntryId(null);
      setClientId("");
      setInsuranceProvider("");
      setMemberId("");
      setAuthNumber("");
      setDiagnosisCodes(["F84.0"]);
      setServiceLines([{ cpt: "97153", modifier: "", units: 1, charge: 0, date: new Date().toISOString().split("T")[0] }]);
      setFromDate(new Date().toISOString().split("T")[0]);
      setToDate(new Date().toISOString().split("T")[0]);
    }
    setSaving(false);
  }

  async function updateClaimStatus(id: string, status: string) {
    await supabase.from("cms1500_claims").update({ status }).eq("id", id);
    setClaims((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
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
      doc.text(value || "—", x + 40, yPos);
    };
    field("Patient Name", client?.full_name ?? "", 20, y); y += 7;
    field("Insurance", claim.insurance_provider, 20, y); y += 7;
    field("Member ID", claim.member_id ?? "", 20, y); y += 7;
    field("Auth #", claim.authorization_number ?? "", 20, y); y += 7;
    field("Diagnosis", claim.diagnosis_codes.join(", "), 20, y); y += 7;
    field("Service Dates", `${claim.service_from_date} to ${claim.service_to_date}`, 20, y); y += 7;
    field("Rendering Provider", claim.provider_name ?? "", 20, y); y += 7;
    field("Rendering NPI", claim.provider_npi ?? "", 20, y); y += 7;
    field("Billing Provider", claim.billing_provider_name ?? "", 20, y); y += 7;
    field("Billing NPI", claim.billing_npi ?? "", 20, y); y += 10;
    doc.line(20, y, 190, y); y += 6;
    doc.setFont("helvetica", "bold");
    ["CPT", "Modifier", "Units", "Charge", "Total", "Date"].forEach((h, i) => {
      doc.text(h, [20, 50, 75, 100, 130, 160][i], y);
    });
    y += 5; doc.line(20, y, 190, y); y += 5;
    doc.setFont("helvetica", "normal");
    claim.service_lines.forEach((line) => {
      doc.text(line.cpt, 20, y);
      doc.text(line.modifier || "—", 50, y);
      doc.text(String(line.units), 75, y);
      doc.text(`$${line.charge}`, 100, y);
      doc.text(`$${(line.units * line.charge).toFixed(2)}`, 130, y);
      doc.text(line.date, 160, y);
      y += 7;
    });
    y += 3; doc.line(20, y, 190, y); y += 6;
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL CHARGE: $${claim.total_charge.toFixed(2)}`, 190, y, { align: "right" });
    doc.setFontSize(7); doc.setTextColor(150);
    doc.text("CONFIDENTIAL — Contains Protected Health Information (PHI)", 105, 285, { align: "center" });
    doc.save(`CMS1500-${client?.full_name?.replace(/\s/g, "-")}-${claim.service_from_date}.pdf`);
  }

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));
  const filtered = filterStatus === "all" ? claims : claims.filter(c => c.status === filterStatus);

  const stats = {
    total: claims.length,
    submitted: claims.filter(c => c.status === "submitted").length,
    paid: claims.filter(c => c.status === "paid").length,
    denied: claims.filter(c => c.status === "denied").length,
  };

  const inputClass = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";
  const labelClass = "text-sm font-medium text-gray-700 mb-1 block";

  return (
    <div className="space-y-6">
      <PageHeader title="CMS-1500 Claims">
        <div className="flex gap-2">
          <Link href="/dashboard/clearinghouse">
            <Button variant="outline">🔌 Clearinghouse →</Button>
          </Link>
          <Link href="/dashboard/billing/era-eob">
            <Button variant="outline">💰 ERA/EOB →</Button>
          </Link>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ New Claim"}
          </Button>
        </div>
      </PageHeader>

      {/* BILLING FLOW */}
      <div className="flex items-center gap-2 text-xs text-gray-400 overflow-x-auto pb-1">
        {[
          { label: "✅ Approved Entry", href: "/dashboard/billing/approved" },
          { label: "→" },
          { label: "📄 CMS-1500", href: "" },
          { label: "→" },
          { label: "🔌 Clearinghouse", href: "/dashboard/clearinghouse" },
          { label: "→" },
          { label: "💰 ERA/EOB", href: "/dashboard/billing/era-eob" },
        ].map((step, i) => (
          step.label === "→" ? (
            <span key={i} className="text-gray-300 font-bold shrink-0">→</span>
          ) : step.href ? (
            <Link key={i} href={step.href}
              className={`px-3 py-1.5 rounded-full border shrink-0 transition-colors ${!step.href ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 hover:border-blue-300 hover:text-blue-600"}`}>
              {step.label}
            </Link>
          ) : (
            <span key={i} className="px-3 py-1.5 rounded-full border bg-blue-600 text-white border-blue-600 shrink-0">
              {step.label}
            </span>
          )
        ))}
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Claims", val: stats.total, color: "text-blue-600" },
          { label: "Submitted", val: stats.submitted, color: "text-yellow-600" },
          { label: "Paid", val: stats.paid, color: "text-green-600" },
          { label: "Denied", val: stats.denied, color: "text-red-500" },
        ].map(s => (
          <div key={s.label} className="border rounded-xl p-4 text-center bg-white">
            <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* PRE-FILLED BANNER */}
      {prefilledBanner && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <p className="text-sm font-bold text-green-800">Pre-filled from approved time entry</p>
            <p className="text-xs text-green-700 mt-0.5">
              Client, CPT code, date, and units have been filled in automatically.
              Add member ID, auth number, and charges to complete the claim.
            </p>
          </div>
        </div>
      )}

      {/* FORM */}
      {showForm && (
        <Section title="New CMS-1500 Claim">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Patient & Insurance</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelClass}>Client *</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputClass}>
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Insurance Provider *</label>
              <select value={insuranceProvider} onChange={(e) => setInsuranceProvider(e.target.value)} className={inputClass}>
                <option value="">Select...</option>
                {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Member ID</label>
              <input type="text" value={memberId} onChange={(e) => setMemberId(e.target.value)} className={inputClass} placeholder="Insurance member ID" />
            </div>
            <div>
              <label className={labelClass}>Authorization Number</label>
              <input type="text" value={authNumber} onChange={(e) => setAuthNumber(e.target.value)} className={inputClass} placeholder="Auth # from insurance" />
            </div>
            <div>
              <label className={labelClass}>Service From Date</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Service To Date</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Diagnosis Codes (ICD-10)</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {ICD10_OPTIONS.map((code) => (
              <button key={code} onClick={() => setDiagnosisCodes((prev) =>
                prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code])}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${diagnosisCodes.includes(code) ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:border-blue-300"}`}>
                {code}
              </button>
            ))}
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Provider Information</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelClass}>Rendering Provider Name</label>
              <input type="text" value={providerName} onChange={(e) => setProviderName(e.target.value)} className={inputClass} placeholder="BCBA/Therapist name" />
            </div>
            <div>
              <label className={labelClass}>Rendering NPI</label>
              <input type="text" value={providerNpi} onChange={(e) => setProviderNpi(e.target.value)} className={inputClass} placeholder="10-digit NPI" />
            </div>
            <div>
              <label className={labelClass}>Billing Provider Name</label>
              <input type="text" value={billingName} onChange={(e) => setBillingName(e.target.value)} className={inputClass} placeholder="Practice/Agency name" />
            </div>
            <div>
              <label className={labelClass}>Billing NPI</label>
              <input type="text" value={billingNpi} onChange={(e) => setBillingNpi(e.target.value)} className={inputClass} placeholder="Billing 10-digit NPI" />
            </div>
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Service Lines</p>
          <div className="border border-gray-100 rounded-xl overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["CPT", "Modifier", "Units", "$/Unit", "Total", "Date", ""].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {serviceLines.map((line, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <select value={line.cpt} onChange={(e) => updateLine(i, "cpt", e.target.value)}
                        className="border rounded px-2 py-1 text-xs focus:outline-none w-24">
                        {CPT_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={line.modifier} onChange={(e) => updateLine(i, "modifier", e.target.value)}
                        placeholder="GT" className="border rounded px-2 py-1 text-xs w-14 focus:outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min={1} value={line.units} onChange={(e) => updateLine(i, "units", parseInt(e.target.value) || 1)}
                        className="border rounded px-2 py-1 text-xs w-16 text-center focus:outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" value={line.charge} onChange={(e) => updateLine(i, "charge", parseFloat(e.target.value) || 0)}
                        className="border rounded px-2 py-1 text-xs w-20 text-center focus:outline-none" />
                    </td>
                    <td className="px-3 py-2 font-medium text-blue-700 text-xs">${(line.units * line.charge).toFixed(2)}</td>
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
                  <td className="px-3 py-2 font-bold text-green-700 text-xs">${totalCharge().toFixed(2)}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
          <Button variant="outline" onClick={addServiceLine}>+ Add Service Line</Button>

          <div className="mt-4 flex gap-2 flex-wrap">
            <Button onClick={() => handleSave("draft")} loading={saving} variant="outline">Save as Draft</Button>
            <Button onClick={() => handleSave("submitted")} loading={saving}>Submit Claim →</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>

          <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
            💡 After submitting, go to <Link href="/dashboard/clearinghouse" className="underline font-medium">Clearinghouse</Link> to send this claim to Office Ally or Availity for insurance submission.
          </div>
        </Section>
      )}

      {/* FILTER */}
      <div className="flex flex-wrap gap-2">
        {["all", ...STATUS_FLOW.map(s => s.key)].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${filterStatus === s ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:border-blue-300"}`}>
            {s === "all" ? `All (${claims.length})` : `${STATUS_FLOW.find(x => x.key === s)?.label} (${claims.filter(c => c.status === s).length})`}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
          <p className="text-3xl mb-3">📄</p>
          <p className="text-gray-600 font-medium">No claims yet</p>
          <p className="text-gray-400 text-sm mt-1">Claims created here link to your approved time entries.</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((claim) => (
          <div key={claim.id} className="border border-gray-100 rounded-xl bg-white overflow-hidden">
            <div className="p-4 flex justify-between items-start flex-wrap gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="font-semibold text-gray-800">{clientMap.get(claim.client_id) ?? "Unknown"}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_FLOW.find(s => s.key === claim.status)?.color ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_FLOW.find(s => s.key === claim.status)?.label ?? claim.status}
                  </span>
                  {claim.time_entry_id && (
                    <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full">Linked to time entry</span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  {claim.insurance_provider} · {claim.service_from_date} to {claim.service_to_date}
                  {claim.member_id && ` · Member: ${claim.member_id}`}
                  {claim.authorization_number && ` · Auth: ${claim.authorization_number}`}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {claim.diagnosis_codes.map((code) => (
                    <span key={code} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{code}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 items-center shrink-0">
                <p className="text-lg font-bold text-green-600">${claim.total_charge.toFixed(2)}</p>
                <Button variant="outline" onClick={() => exportPDF(claim)}>📄 PDF</Button>
                <button onClick={() => setExpandedId(expandedId === claim.id ? null : claim.id)}
                  className="text-xs text-gray-400 hover:text-gray-600">
                  {expandedId === claim.id ? "▲" : "▼"}
                </button>
              </div>
            </div>

            {expandedId === claim.id && (
              <div className="border-t border-gray-100 p-4 space-y-3">
                {/* SERVICE LINES */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {["CPT", "Modifier", "Units", "Charge", "Total", "Date"].map(h => (
                          <th key={h} className="text-left py-1.5 px-2 text-gray-500 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {claim.service_lines.map((line, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-1.5 px-2 font-mono font-bold text-blue-700">{line.cpt}</td>
                          <td className="py-1.5 px-2 text-gray-500">{line.modifier || "—"}</td>
                          <td className="py-1.5 px-2">{line.units}</td>
                          <td className="py-1.5 px-2">${line.charge}</td>
                          <td className="py-1.5 px-2 font-medium">${(line.units * line.charge).toFixed(2)}</td>
                          <td className="py-1.5 px-2 text-gray-500">{line.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* STATUS ACTIONS */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Update Status</p>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_FLOW.map(s => (
                      <button key={s.key} onClick={() => updateClaimStatus(claim.id, s.key)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${claim.status === s.key ? s.color + " border-current font-semibold" : "border-gray-200 text-gray-600 hover:border-blue-300"}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* NEXT STEP */}
                {claim.status === "submitted" && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-center justify-between">
                    <p className="text-xs text-blue-700 font-medium">Next: Submit to clearinghouse for insurance processing</p>
                    <Link href="/dashboard/clearinghouse">
                      <Button variant="outline">Go to Clearinghouse →</Button>
                    </Link>
                  </div>
                )}
                {claim.status === "accepted" && (
                  <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 flex items-center justify-between">
                    <p className="text-xs text-yellow-700 font-medium">Claim accepted — awaiting payment. Post ERA/EOB when payment arrives.</p>
                    <Link href="/dashboard/billing/era-eob">
                      <Button variant="outline">Post ERA/EOB →</Button>
                    </Link>
                  </div>
                )}
                {claim.status === "paid" && (
                  <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                    <p className="text-xs text-green-700 font-medium">✓ Payment received. Post to ERA/EOB for reconciliation.</p>
                  </div>
                )}
                {claim.status === "denied" && (
                  <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-center justify-between">
                    <p className="text-xs text-red-700 font-medium">Claim denied — review denial reason and resubmit or appeal.</p>
                    <Button variant="outline" onClick={() => {
                      setClientId(claim.client_id);
                      setInsuranceProvider(claim.insurance_provider);
                      setMemberId(claim.member_id);
                      setAuthNumber(claim.authorization_number);
                      setDiagnosisCodes(claim.diagnosis_codes);
                      setServiceLines(claim.service_lines);
                      setFromDate(claim.service_from_date);
                      setToDate(claim.service_to_date);
                      setShowForm(true);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}>Resubmit Claim</Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CMS1500Page() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">Loading...</div>}>
      <CMS1500Inner />
    </Suspense>
  );
}