"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Link from "next/link";

type Client = { id: string; full_name: string };
type Authorization = {
  id: string;
  client_id: string;
  insurance_provider: string;
  member_id: string | null;
  authorization_number: string | null;
  diagnosis_code: string | null;
  authorized_cpt_codes: CPTCode[];
  total_authorized_units: number;
  used_units: number;
  start_date: string;
  end_date: string;
  status: string;
  submission_date: string | null;
  review_notes: string | null;
  denial_reason: string | null;
  reauth_submitted: boolean;
  reauth_date: string | null;
  alert_days_before: number;
  created_at: string;
};
type CPTCode = { code: string; units: number; used: number };
type UnitLog = {
  id: string;
  authorization_id: string;
  cpt_code: string;
  units_used: number;
  session_date: string;
  notes: string | null;
};
type AuthDocument = {
  id: string;
  authorization_id: string;
  document_name: string;
  document_type: string | null;
  notes: string | null;
  submitted: boolean;
  submitted_at: string | null;
};

const INSURANCE_PROVIDERS = [
  "Blue Cross Blue Shield", "UnitedHealthcare", "Aetna", "Cigna",
  "Humana", "Medicaid", "TRICARE", "Kaiser Permanente", "FEHB", "Other",
];

const CPT_OPTIONS = [
  { code: "97153", label: "97153 — ABA Treatment by Protocol" },
  { code: "97154", label: "97154 — Group ABA Treatment" },
  { code: "97155", label: "97155 — Protocol Modification by BCBA" },
  { code: "97156", label: "97156 — Family Guidance by BCBA" },
  { code: "97157", label: "97157 — Multiple Family Group" },
  { code: "97158", label: "97158 — Group Protocol Modification" },
];

const ICD10_CODES = [
  "F84.0 — Autistic Disorder",
  "F84.5 — Asperger Syndrome",
  "F84.9 — PDD, Unspecified",
  "F70 — Mild Intellectual Disability",
  "F90.2 — ADHD Combined",
];

const REQUIRED_DOCS = [
  "ASD Diagnosis Report",
  "VB-MAPP / ABLLS-R Assessment",
  "Behavioral Assessment (FBA)",
  "Treatment Plan",
  "Behavior Intervention Plan (BIP)",
  "Progress Notes (last 3 months)",
  "BCBA Credentials / NPI",
  "Medical Necessity Letter",
];

const AUTH_STATUSES = [
  { value: "pending", label: "Pending Review", color: "bg-yellow-100 text-yellow-700" },
  { value: "approved", label: "Approved", color: "bg-green-100 text-green-700" },
  { value: "denied", label: "Denied", color: "bg-red-100 text-red-700" },
  { value: "expired", label: "Expired", color: "bg-gray-100 text-gray-600" },
  { value: "reauth_needed", label: "Re-auth Needed", color: "bg-orange-100 text-orange-700" },
  { value: "draft", label: "Draft", color: "bg-blue-100 text-blue-700" },
];

const emptyForm = {
  client_id: "",
  insurance_provider: "",
  member_id: "",
  authorization_number: "",
  diagnosis_code: "",
  total_authorized_units: 0,
  start_date: new Date().toISOString().split("T")[0],
  end_date: "",
  alert_days_before: 30,
  review_notes: "",
};

export default function AuthorizationsPage() {
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedCPTs, setSelectedCPTs] = useState<CPTCode[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterClient, setFilterClient] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"current" | "upcoming" | "past" | "denied">("current");
  const [error, setError] = useState<string | null>(null);

  // Unit log state
  const [unitLogs, setUnitLogs] = useState<Record<string, UnitLog[]>>({});
  const [authDocs, setAuthDocs] = useState<Record<string, AuthDocument[]>>({});
  const [addingUnits, setAddingUnits] = useState<string | null>(null);
  const [unitCPT, setUnitCPT] = useState("");
  const [unitCount, setUnitCount] = useState(1);
  const [unitDate, setUnitDate] = useState(new Date().toISOString().split("T")[0]);
  const [unitNotes, setUnitNotes] = useState("");
  const [savingUnits, setSavingUnits] = useState(false);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: authData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
      supabase.from("insurance_authorizations").select("*").eq("created_by", user.id).order("end_date", { ascending: true }),
    ]);

    setClients(clientData ?? []);
    setAuthorizations((authData ?? []).map((a: any) => ({
      ...a,
      authorized_cpt_codes: Array.isArray(a.authorized_cpt_codes) ? a.authorized_cpt_codes : JSON.parse(a.authorized_cpt_codes || "[]"),
    })));
    setLoading(false);
  }

  async function loadAuthDetails(authId: string) {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: logs }, { data: docs }] = await Promise.all([
      supabase.from("auth_unit_logs").select("*").eq("authorization_id", authId).order("session_date", { ascending: false }),
      supabase.from("auth_documents").select("*").eq("authorization_id", authId).order("created_at", { ascending: false }),
    ]);

    setUnitLogs((prev) => ({ ...prev, [authId]: logs ?? [] }));
    setAuthDocs((prev) => ({ ...prev, [authId]: docs ?? [] }));
  }

  function addCPT(code: string) {
    if (selectedCPTs.find((c) => c.code === code)) return;
    setSelectedCPTs((prev) => [...prev, { code, units: 96, used: 0 }]);
  }

  function updateCPTUnits(code: string, units: number) {
    setSelectedCPTs((prev) => prev.map((c) => c.code === code ? { ...c, units } : c));
  }

  function removeCPT(code: string) {
    setSelectedCPTs((prev) => prev.filter((c) => c.code !== code));
  }

  async function handleSave() {
    if (!form.client_id || !form.insurance_provider || !form.start_date || !form.end_date) {
      setError("Client, insurance provider, and dates are required.");
      return;
    }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const totalUnits = selectedCPTs.reduce((a, b) => a + b.units, 0);

    const { data, error: saveError } = await supabase.from("insurance_authorizations").insert([{
      ...form,
      authorized_cpt_codes: JSON.stringify(selectedCPTs),
      total_authorized_units: totalUnits || form.total_authorized_units,
      used_units: 0,
      status: "pending",
      created_by: user.id,
    }]).select().single();

    if (saveError) { setError(saveError.message); setSaving(false); return; }

    setAuthorizations((prev) => [...prev, { ...data, authorized_cpt_codes: selectedCPTs }].sort((a, b) => a.end_date.localeCompare(b.end_date)));
    setForm(emptyForm);
    setSelectedCPTs([]);
    setShowForm(false);
    setSaving(false);
  }

  async function updateStatus(id: string, status: string, denialReason?: string) {
    await supabase.from("insurance_authorizations").update({
      status,
      denial_reason: denialReason || null,
    }).eq("id", id);
    setAuthorizations((prev) => prev.map((a) => a.id === id ? { ...a, status, denial_reason: denialReason || null } : a));
  }

  async function logUnits(authId: string) {
    if (!unitCPT || !unitCount) return;
    setSavingUnits(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const authRecord = authorizations.find((a) => a.id === authId);
    if (!authRecord) return;

    await supabase.from("auth_unit_logs").insert([{
      authorization_id: authId,
      client_id: authRecord.client_id,
      cpt_code: unitCPT,
      units_used: unitCount,
      session_date: unitDate,
      notes: unitNotes || null,
      created_by: user.id,
    }]);

    // Update used_units
    const newUsed = authRecord.used_units + unitCount;
    await supabase.from("insurance_authorizations").update({ used_units: newUsed }).eq("id", authId);
    setAuthorizations((prev) => prev.map((a) => a.id === authId ? { ...a, used_units: newUsed } : a));

    await loadAuthDetails(authId);
    setAddingUnits(null);
    setUnitCPT(""); setUnitCount(1); setUnitNotes("");
    setSavingUnits(false);
  }

  async function addDocument(authId: string, docName: string, docType: string) {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("auth_documents").insert([{
      authorization_id: authId,
      document_name: docName,
      document_type: docType,
      submitted: false,
      created_by: user.id,
    }]).select().single();

    if (data) {
      setAuthDocs((prev) => ({ ...prev, [authId]: [data, ...(prev[authId] ?? [])] }));
    }
  }

  async function toggleDocSubmitted(authId: string, docId: string, submitted: boolean) {
    await supabase.from("auth_documents").update({
      submitted: !submitted,
      submitted_at: !submitted ? new Date().toISOString() : null,
    }).eq("id", docId);

    setAuthDocs((prev) => ({
      ...prev,
      [authId]: (prev[authId] ?? []).map((d) => d.id === docId ? {
        ...d, submitted: !submitted, submitted_at: !submitted ? new Date().toISOString() : null,
      } : d),
    }));
  }

  function daysUntilExpiry(endDate: string) {
    return Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  function unitsRemaining(auth: Authorization) {
    return auth.total_authorized_units - auth.used_units;
  }

  function utilizationPct(auth: Authorization) {
    if (!auth.total_authorized_units) return 0;
    return Math.round((auth.used_units / auth.total_authorized_units) * 100);
  }

  function statusColor(status: string) {
    return AUTH_STATUSES.find((s) => s.value === status)?.color ?? "bg-gray-100 text-gray-600";
  }

  function statusLabel(status: string) {
    return AUTH_STATUSES.find((s) => s.value === status)?.label ?? status;
  }

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  // Categorize authorizations
  const now = new Date();
  const currentAuths = authorizations.filter((a) => {
    const days = daysUntilExpiry(a.end_date);
    return a.status === "approved" && days > 0 && days > a.alert_days_before;
  });
  const upcomingAuths = authorizations.filter((a) => {
    const days = daysUntilExpiry(a.end_date);
    return (a.status === "approved" || a.status === "reauth_needed") && days <= a.alert_days_before && days > 0;
  });
  const pastAuths = authorizations.filter((a) => {
    const days = daysUntilExpiry(a.end_date);
    return a.status === "expired" || days <= 0;
  });
  const deniedAuths = authorizations.filter((a) => a.status === "denied");
  const pendingAuths = authorizations.filter((a) => a.status === "pending" || a.status === "draft");

  function getTabData() {
    if (activeTab === "current") return [...pendingAuths, ...currentAuths];
    if (activeTab === "upcoming") return upcomingAuths;
    if (activeTab === "past") return pastAuths;
    if (activeTab === "denied") return deniedAuths;
    return authorizations;
  }

  const tabData = filterClient ? getTabData().filter((a) => a.client_id === filterClient) : getTabData();

  return (
    <div className="space-y-6">
      <PageHeader title="Insurance Authorizations">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Authorization"}
        </Button>
      </PageHeader>

      {/* ALERT BANNERS */}
      {upcomingAuths.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-sm font-bold text-orange-700 mb-2">
            ⚠️ {upcomingAuths.length} authorization{upcomingAuths.length > 1 ? "s" : ""} expiring soon — re-authorization required
          </p>
          <div className="space-y-1">
            {upcomingAuths.map((a) => (
              <p key={a.id} className="text-xs text-orange-600">
                {clientMap.get(a.client_id)} — {a.insurance_provider} · Auth #{a.authorization_number ?? "N/A"} · Expires {a.end_date} ({daysUntilExpiry(a.end_date)} days)
              </p>
            ))}
          </div>
        </div>
      )}

      {deniedAuths.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-bold text-red-700 mb-2">
            🚨 {deniedAuths.length} denied authorization{deniedAuths.length > 1 ? "s" : ""} — review denial reasons
          </p>
          {deniedAuths.map((a) => (
            <p key={a.id} className="text-xs text-red-600">
              {clientMap.get(a.client_id)} — {a.insurance_provider} · {a.denial_reason ?? "No reason provided"}
            </p>
          ))}
        </div>
      )}

      {/* SUMMARY STATS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total", value: authorizations.length, color: "text-blue-600" },
          { label: "Active", value: currentAuths.length, color: "text-green-600" },
          { label: "Pending", value: pendingAuths.length, color: "text-yellow-600" },
          { label: "Expiring Soon", value: upcomingAuths.length, color: "text-orange-500" },
          { label: "Denied", value: deniedAuths.length, color: "text-red-500" },
        ].map((stat) => (
          <div key={stat.label} className="border rounded-xl p-4 text-center bg-white">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* FORM */}
      {showForm && (
        <Section title="New Authorization Request">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Client & Insurance</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                {INSURANCE_PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Member ID</label>
              <input type="text" value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })}
                placeholder="Insurance member ID"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Authorization Number</label>
              <input type="text" value={form.authorization_number} onChange={(e) => setForm({ ...form, authorization_number: e.target.value })}
                placeholder="Auth # (once approved)"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Diagnosis Code (ICD-10)</label>
              <select value={form.diagnosis_code} onChange={(e) => setForm({ ...form, diagnosis_code: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select diagnosis...</option>
                {ICD10_CODES.map((c) => <option key={c} value={c.split(" — ")[0]}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Alert Before Expiry</label>
              <select value={form.alert_days_before} onChange={(e) => setForm({ ...form, alert_days_before: parseInt(e.target.value) })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                {[14, 21, 30, 45, 60].map((d) => <option key={d} value={d}>{d} days before expiry</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Start Date *</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">End Date *</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Authorized CPT Codes & Units</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {CPT_OPTIONS.map((opt) => (
              <button key={opt.code} onClick={() => addCPT(opt.code)}
                disabled={!!selectedCPTs.find((c) => c.code === opt.code)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selectedCPTs.find((c) => c.code === opt.code) ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:border-blue-300"}`}>
                {opt.code}
              </button>
            ))}
          </div>

          {selectedCPTs.length > 0 && (
            <div className="border border-gray-100 rounded-xl overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs text-gray-500">CPT Code</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500">Description</th>
                    <th className="text-center px-4 py-2 text-xs text-gray-500">Authorized Units</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCPTs.map((cpt) => (
                    <tr key={cpt.code} className="border-t border-gray-100">
                      <td className="px-4 py-2 font-mono font-bold text-blue-700">{cpt.code}</td>
                      <td className="px-4 py-2 text-xs text-gray-600">
                        {CPT_OPTIONS.find((o) => o.code === cpt.code)?.label.split(" — ")[1]}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input type="number" min={1} value={cpt.units}
                          onChange={(e) => updateCPTUnits(cpt.code, parseInt(e.target.value) || 0)}
                          className="w-20 border rounded px-2 py-1 text-xs text-center focus:outline-none" />
                      </td>
                      <td className="px-4 py-2">
                        <button onClick={() => removeCPT(cpt.code)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={2} className="px-4 py-2 text-xs font-bold text-gray-700">Total Authorized Units</td>
                    <td className="px-4 py-2 text-center font-bold text-blue-700">
                      {selectedCPTs.reduce((a, b) => a + b.units, 0)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
            <textarea value={form.review_notes} onChange={(e) => setForm({ ...form, review_notes: e.target.value })}
              placeholder="Additional notes, clinical rationale..." rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} loading={saving}>Submit Authorization Request</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* TABS */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {[
          { key: "current", label: `Active / Pending (${currentAuths.length + pendingAuths.length})` },
          { key: "upcoming", label: `Expiring Soon (${upcomingAuths.length})` },
          { key: "past", label: `Past (${pastAuths.length})` },
          { key: "denied", label: `Denied (${deniedAuths.length})` },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* FILTER */}
      {!loading && authorizations.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center">
          <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <p className="text-sm text-gray-400">{tabData.length} authorizations</p>
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && tabData.length === 0 && (
        <Section title="No Authorizations">
          <p className="text-gray-400 text-sm">
            {activeTab === "current" && "No active authorizations. Click '+ New Authorization' to submit one."}
            {activeTab === "upcoming" && "No authorizations expiring soon."}
            {activeTab === "past" && "No past authorizations on record."}
            {activeTab === "denied" && "No denied authorizations."}
          </p>
        </Section>
      )}

      {/* AUTH LIST */}
      <div className="space-y-4">
        {tabData.map((auth) => {
          const isExpanded = expandedId === auth.id;
          const days = daysUntilExpiry(auth.end_date);
          const utilPct = utilizationPct(auth);
          const remaining = unitsRemaining(auth);
          const logs = unitLogs[auth.id] ?? [];
          const docs = authDocs[auth.id] ?? [];

          return (
            <div key={auth.id} className={`border rounded-xl bg-white ${auth.status === "denied" ? "border-red-200" : days <= auth.alert_days_before && days > 0 ? "border-orange-200" : days <= 0 ? "border-gray-200" : "border-gray-100"}`}>
              <div className="p-4">
                {/* HEADER */}
                <div className="flex justify-between items-start flex-wrap gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-800">{clientMap.get(auth.client_id) ?? "Unknown"}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(auth.status)}`}>
                        {statusLabel(auth.status)}
                      </span>
                      {days <= auth.alert_days_before && days > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                          ⚠️ Expires in {days} days
                        </span>
                      )}
                      {days <= 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                          Expired {Math.abs(days)} days ago
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {auth.insurance_provider}
                      {auth.authorization_number && ` · Auth #${auth.authorization_number}`}
                      {auth.member_id && ` · Member: ${auth.member_id}`}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {auth.start_date} → {auth.end_date}
                      {auth.diagnosis_code && ` · ICD-10: ${auth.diagnosis_code}`}
                    </p>
                  </div>

                  {/* UNIT TRACKER */}
                  {auth.total_authorized_units > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Units Used</p>
                      <p className="text-lg font-bold text-gray-800">
                        {auth.used_units} / {auth.total_authorized_units}
                      </p>
                      <p className={`text-xs font-medium ${remaining <= 20 ? "text-red-500" : remaining <= 50 ? "text-orange-500" : "text-green-600"}`}>
                        {remaining} remaining
                      </p>
                    </div>
                  )}

                  <button onClick={() => {
                    setExpandedId(isExpanded ? null : auth.id);
                    if (!isExpanded) loadAuthDetails(auth.id);
                  }} className="text-xs text-gray-400 hover:text-gray-600">
                    {isExpanded ? "▲" : "▼"}
                  </button>
                </div>

                {/* UNIT PROGRESS BAR */}
                {auth.total_authorized_units > 0 && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${utilPct >= 90 ? "bg-red-500" : utilPct >= 75 ? "bg-orange-500" : utilPct >= 50 ? "bg-yellow-500" : "bg-green-500"}`}
                        style={{ width: `${Math.min(100, utilPct)}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{utilPct}% utilized</p>
                  </div>
                )}

                {/* CPT CODE BADGES */}
                {auth.authorized_cpt_codes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {auth.authorized_cpt_codes.map((cpt) => (
                      <span key={cpt.code} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                        {cpt.code}: {cpt.units} units
                      </span>
                    ))}
                  </div>
                )}

                {/* DENIAL REASON */}
                {auth.status === "denied" && auth.denial_reason && (
                  <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-red-700 mb-1">Denial Reason:</p>
                    <p className="text-sm text-red-600">{auth.denial_reason}</p>
                  </div>
                )}

                {/* EXPANDED DETAILS */}
                {isExpanded && (
                  <div className="mt-4 border-t border-gray-100 pt-4 space-y-4">

                    {/* STATUS ACTIONS */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Update Status</p>
                      <div className="flex flex-wrap gap-2">
                        {AUTH_STATUSES.map((s) => (
                          <button key={s.value} onClick={async () => {
                            if (s.value === "denied") {
                              const reason = prompt("Enter denial reason (visible to submitter):");
                              if (reason !== null) await updateStatus(auth.id, s.value, reason);
                            } else {
                              await updateStatus(auth.id, s.value);
                            }
                          }}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${auth.status === s.value ? s.color + " border-current" : "border-gray-200 text-gray-600 hover:border-blue-300"}`}>
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* UNIT LOG */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Unit Usage Log</p>
                        <Button variant="outline" onClick={() => setAddingUnits(addingUnits === auth.id ? null : auth.id)}>
                          {addingUnits === auth.id ? "Cancel" : "+ Log Units"}
                        </Button>
                      </div>

                      {addingUnits === auth.id && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3 border border-gray-100 rounded-lg p-3 bg-gray-50">
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">CPT Code</label>
                            <select value={unitCPT} onChange={(e) => setUnitCPT(e.target.value)}
                              className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300">
                              <option value="">Select...</option>
                              {auth.authorized_cpt_codes.map((c) => (
                                <option key={c.code} value={c.code}>{c.code}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Units Used</label>
                            <input type="number" min={1} value={unitCount} onChange={(e) => setUnitCount(parseInt(e.target.value) || 1)}
                              className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Session Date</label>
                            <input type="date" value={unitDate} onChange={(e) => setUnitDate(e.target.value)}
                              className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
                          </div>
                          <div className="flex items-end">
                            <Button onClick={() => logUnits(auth.id)} loading={savingUnits} disabled={!unitCPT}>
                              Save
                            </Button>
                          </div>
                        </div>
                      )}

                      {logs.length > 0 ? (
                        <div className="space-y-1">
                          {logs.map((log) => (
                            <div key={log.id} className="flex justify-between items-center text-xs border border-gray-100 rounded-lg p-2 bg-white">
                              <span className="font-mono text-blue-700">{log.cpt_code}</span>
                              <span className="text-gray-500">{log.session_date}</span>
                              <span className="font-medium text-gray-800">{log.units_used} units</span>
                              {log.notes && <span className="text-gray-400 truncate max-w-24">{log.notes}</span>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">No units logged yet.</p>
                      )}
                    </div>

                    {/* REQUIRED DOCUMENTS */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Required Documents</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {REQUIRED_DOCS.map((docName) => {
                          const existing = docs.find((d) => d.document_name === docName);
                          return (
                            <div key={docName} className={`flex items-center gap-2 border rounded-lg p-2 text-xs transition-all ${existing?.submitted ? "border-green-200 bg-green-50" : "border-gray-100 bg-white"}`}>
                              <button onClick={() => {
                                if (existing) {
                                  toggleDocSubmitted(auth.id, existing.id, existing.submitted);
                                } else {
                                  addDocument(auth.id, docName, "required");
                                }
                              }}
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${existing?.submitted ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-green-400"}`}>
                                {existing?.submitted && "✓"}
                              </button>
                              <span className={existing?.submitted ? "line-through text-gray-400" : "text-gray-700"}>
                                {docName}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        {docs.filter((d) => d.submitted).length}/{REQUIRED_DOCS.length} documents submitted
                      </p>
                    </div>

                    {/* RE-AUTH SECTION */}
                    {(days <= auth.alert_days_before || auth.status === "denied") && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                        <p className="text-sm font-bold text-yellow-800 mb-2">
                          {auth.status === "denied" ? "🔄 Appeal / Resubmit" : "📋 Re-Authorization Needed"}
                        </p>
                        <p className="text-xs text-yellow-700 mb-3">
                          {auth.status === "denied"
                            ? "This authorization was denied. Review the denial reason above and resubmit with additional documentation."
                            : `This authorization expires in ${days} days. Submit updated assessment and treatment plan for re-authorization.`}
                        </p>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => {
                            setForm({
                              ...emptyForm,
                              client_id: auth.client_id,
                              insurance_provider: auth.insurance_provider,
                              member_id: auth.member_id ?? "",
                              diagnosis_code: auth.diagnosis_code ?? "",
                            });
                            setSelectedCPTs(auth.authorized_cpt_codes);
                            setShowForm(true);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}>
                            Submit Re-Authorization
                          </Button>
                          <Button variant="outline" onClick={() => window.location.href = "/dashboard/insurance-providers"}>
                            View Provider Portal Links
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* NOTES */}
                    {auth.review_notes && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                        <p className="text-sm text-gray-600">{auth.review_notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}