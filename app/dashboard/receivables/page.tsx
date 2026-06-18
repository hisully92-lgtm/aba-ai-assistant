"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Section from "@/components/ui/Section";
import Link from "next/link";

type Receivable = {
  id: string;
  client_id: string | null;
  insurance_provider: string;
  claim_number: string | null;
  service_date: string;
  billed_amount: number;
  expected_amount: number;
  received_amount: number;
  adjustment_amount: number;
  patient_responsibility: number;
  status: string;
  denial_reason: string | null;
  check_number: string | null;
  payment_date: string | null;
  notes: string | null;
  cms1500_id: string | null;
  created_at: string;
};

type Client = { id: string; full_name: string };

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  partial: "bg-orange-100 text-orange-700",
  paid: "bg-green-100 text-green-700",
  denied: "bg-red-100 text-red-700",
  adjusted: "bg-blue-100 text-blue-700",
  written_off: "bg-gray-100 text-gray-500",
};

const PROVIDERS = [
  "Blue Cross Blue Shield", "UnitedHealthcare", "Aetna", "Cigna",
  "Humana", "Medicaid", "TRICARE", "Other",
];

const emptyForm = {
  client_id: "",
  insurance_provider: "",
  claim_number: "",
  service_date: new Date().toISOString().split("T")[0],
  billed_amount: 0,
  expected_amount: 0,
  received_amount: 0,
  adjustment_amount: 0,
  patient_responsibility: 0,
  status: "pending",
  denial_reason: "",
  check_number: "",
  payment_date: "",
  notes: "",
};

export default function ReceivablesPage() {
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterProvider, setFilterProvider] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState("");

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data: cu } = await supabase.from("company_users")
      .select("company_id").eq("user_id", user.id)
      .eq("status", "active").limit(1).maybeSingle();
    setCompanyId(cu?.company_id ?? "");

    const [{ data: recData }, { data: clientData }] = await Promise.all([
      supabase.from("receivables").select("*")
        .eq("company_id", cu?.company_id)
        .order("service_date", { ascending: false }),
      supabase.from("clients").select("id, full_name")
        .eq("company_id", cu?.company_id),
    ]);

    setReceivables(recData ?? []);
    setClients(clientData ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.insurance_provider || !form.service_date) return;
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("receivables").insert([{
      ...form,
      company_id: companyId,
      client_id: form.client_id || null,
      claim_number: form.claim_number || null,
      denial_reason: form.denial_reason || null,
      check_number: form.check_number || null,
      payment_date: form.payment_date || null,
      notes: form.notes || null,
      created_by: user.id,
    }]).select().single();

    if (data) setReceivables(prev => [data, ...prev]);
    setForm(emptyForm);
    setShowForm(false);
    setSaving(false);
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from("receivables").update({ status }).eq("id", id);
    setReceivables(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  }

  async function postPayment(id: string, amount: number, checkNumber: string, paymentDate: string) {
    const rec = receivables.find(r => r.id === id);
    if (!rec) return;
    const newReceived = rec.received_amount + amount;
    const newStatus = newReceived >= rec.expected_amount ? "paid" : "partial";
    await supabase.from("receivables").update({
      received_amount: newReceived,
      check_number: checkNumber || null,
      payment_date: paymentDate || null,
      status: newStatus,
    }).eq("id", id);
    setReceivables(prev => prev.map(r => r.id === id ? {
      ...r, received_amount: newReceived,
      check_number: checkNumber, payment_date: paymentDate, status: newStatus,
    } : r));
  }

  const clientMap = new Map(clients.map(c => [c.id, c.full_name]));

  let filtered = receivables;
  if (filterStatus) filtered = filtered.filter(r => r.status === filterStatus);
  if (filterProvider) filtered = filtered.filter(r => r.insurance_provider === filterProvider);

  const totalBilled = receivables.reduce((a, b) => a + b.billed_amount, 0);
  const totalExpected = receivables.reduce((a, b) => a + b.expected_amount, 0);
  const totalReceived = receivables.reduce((a, b) => a + b.received_amount, 0);
  const totalOutstanding = totalExpected - totalReceived;
  const collectionRate = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0;

  const inputClass = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";
  const labelClass = "text-sm font-medium text-gray-700 mb-1 block";

  return (
    <div className="space-y-6">
      <PageHeader title="Insurance Receivables">
        <div className="flex gap-2">
          <Link href="/dashboard/billing/era-eob">
            <Button variant="outline">Post ERA/EOB →</Button>
          </Link>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Add Receivable"}
          </Button>
        </div>
      </PageHeader>

      {/* BILLING FLOW */}
      <div className="flex items-center gap-2 text-xs text-gray-400 overflow-x-auto pb-1">
        {[
          { label: "📄 CMS-1500", href: "/dashboard/billing/cms1500" },
          { label: "→" },
          { label: "🔌 Clearinghouse", href: "/dashboard/clearinghouse" },
          { label: "→" },
          { label: "💳 Receivables", href: "" },
          { label: "→" },
          { label: "💰 ERA/EOB", href: "/dashboard/billing/era-eob" },
        ].map((step, i) => (
          step.label === "→" ? (
            <span key={i} className="text-gray-300 font-bold shrink-0">→</span>
          ) : step.href ? (
            <Link key={i} href={step.href}
              className="px-3 py-1.5 rounded-full border shrink-0 border-gray-200 hover:border-blue-300 hover:text-blue-600 transition-colors">
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Billed", val: `$${totalBilled.toFixed(0)}`, color: "text-blue-600" },
          { label: "Expected", val: `$${totalExpected.toFixed(0)}`, color: "text-yellow-600" },
          { label: "Received", val: `$${totalReceived.toFixed(0)}`, color: "text-green-600" },
          { label: "Outstanding", val: `$${totalOutstanding.toFixed(0)}`, color: "text-red-500" },
          { label: "Collection Rate", val: `${collectionRate}%`, color: collectionRate >= 90 ? "text-green-600" : collectionRate >= 75 ? "text-yellow-600" : "text-red-500" },
        ].map(s => (
          <div key={s.label} className="border rounded-xl p-4 text-center bg-white">
            <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* FORM */}
      {showForm && (
        <Section title="Add Receivable">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Client</label>
              <select value={form.client_id} onChange={e => setForm({...form, client_id: e.target.value})} className={inputClass}>
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Insurance Provider *</label>
              <select value={form.insurance_provider} onChange={e => setForm({...form, insurance_provider: e.target.value})} className={inputClass}>
                <option value="">Select...</option>
                {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Claim Number</label>
              <input type="text" value={form.claim_number} onChange={e => setForm({...form, claim_number: e.target.value})} className={inputClass} placeholder="Claim #" />
            </div>
            <div>
              <label className={labelClass}>Service Date *</label>
              <input type="date" value={form.service_date} onChange={e => setForm({...form, service_date: e.target.value})} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Billed Amount ($)</label>
              <input type="number" step="0.01" value={form.billed_amount} onChange={e => setForm({...form, billed_amount: parseFloat(e.target.value) || 0})} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Expected Amount ($)</label>
              <input type="number" step="0.01" value={form.expected_amount} onChange={e => setForm({...form, expected_amount: parseFloat(e.target.value) || 0})} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className={inputClass}>
                {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className={inputClass} placeholder="Optional notes" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>Save</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* FILTERS */}
      <div className="flex flex-wrap gap-3">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">All Statuses</option>
          {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <select value={filterProvider} onChange={e => setFilterProvider(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">All Providers</option>
          {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <p className="text-sm text-gray-400 self-center">{filtered.length} receivables</p>
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
          <p className="text-3xl mb-3">💳</p>
          <p className="text-gray-600 font-medium">No receivables yet</p>
          <p className="text-gray-400 text-sm mt-1">Add a receivable or post an ERA/EOB to track insurance payments.</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(rec => {
          const isExpanded = expandedId === rec.id;
          const outstanding = rec.expected_amount - rec.received_amount;
          const pct = rec.expected_amount > 0 ? Math.round((rec.received_amount / rec.expected_amount) * 100) : 0;

          return (
            <div key={rec.id} className="border border-gray-100 rounded-xl bg-white overflow-hidden">
              <div className="p-4 flex justify-between items-start gap-3 flex-wrap">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {rec.client_id && <p className="font-semibold text-gray-800">{clientMap.get(rec.client_id)}</p>}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[rec.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {rec.status.replace("_", " ")}
                    </span>
                    {rec.claim_number && <span className="text-xs text-gray-400">#{rec.claim_number}</span>}
                  </div>
                  <p className="text-xs text-gray-400">
                    {rec.insurance_provider} · {rec.service_date}
                    {rec.check_number && ` · Check #${rec.check_number}`}
                    {rec.payment_date && ` · Paid ${rec.payment_date}`}
                  </p>
                  {rec.expected_amount > 0 && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>${rec.received_amount.toFixed(2)} received</span>
                        <span>${rec.expected_amount.toFixed(2)} expected · {pct}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${pct >= 100 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-400"}`}
                          style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">${rec.received_amount.toFixed(2)}</p>
                    {outstanding > 0 && <p className="text-xs text-red-500">${outstanding.toFixed(2)} outstanding</p>}
                  </div>
                  <button onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                    className="text-gray-400 hover:text-gray-600 text-xs">
                    {isExpanded ? "▲" : "▼"}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 p-4 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div><p className="text-xs text-gray-400">Billed</p><p className="font-medium">${rec.billed_amount.toFixed(2)}</p></div>
                    <div><p className="text-xs text-gray-400">Expected</p><p className="font-medium">${rec.expected_amount.toFixed(2)}</p></div>
                    <div><p className="text-xs text-gray-400">Received</p><p className="font-medium text-green-600">${rec.received_amount.toFixed(2)}</p></div>
                    <div><p className="text-xs text-gray-400">Patient Resp.</p><p className="font-medium">${rec.patient_responsibility.toFixed(2)}</p></div>
                  </div>

                  {rec.denial_reason && (
                    <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                      <p className="text-xs font-semibold text-red-600 mb-1">Denial Reason</p>
                      <p className="text-sm text-red-700">{rec.denial_reason}</p>
                    </div>
                  )}

                  {rec.notes && <p className="text-sm text-gray-600">{rec.notes}</p>}

                  {/* POST PAYMENT */}
                  {rec.status !== "paid" && (
                    <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                      <p className="text-xs font-semibold text-green-700 mb-2">Post Payment</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <input type="number" step="0.01" placeholder="Amount received"
                          id={`pay-amount-${rec.id}`}
                          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-300" />
                        <input type="text" placeholder="Check number"
                          id={`pay-check-${rec.id}`}
                          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-300" />
                        <input type="date" id={`pay-date-${rec.id}`}
                          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-300" />
                      </div>
                      <Button onClick={() => {
                        const amount = parseFloat((document.getElementById(`pay-amount-${rec.id}`) as HTMLInputElement)?.value || "0");
                        const check = (document.getElementById(`pay-check-${rec.id}`) as HTMLInputElement)?.value ?? "";
                        const date = (document.getElementById(`pay-date-${rec.id}`) as HTMLInputElement)?.value ?? "";
                        if (amount > 0) postPayment(rec.id, amount, check, date);
                      }} className="mt-2">
                        ✓ Post Payment
                      </Button>
                    </div>
                  )}

                  {/* STATUS ACTIONS */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Update Status</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(STATUS_COLORS).map(s => (
                        <button key={s} onClick={() => updateStatus(rec.id, s)}
                          className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${rec.status === s ? STATUS_COLORS[s] + " border-current font-semibold" : "border-gray-200 text-gray-600 hover:border-blue-300"}`}>
                          {s.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
