"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type ERARecord = {
  id: string;
  client_id: string | null;
  payer_name: string;
  check_number: string;
  payment_date: string;
  total_billed: number;
  total_paid: number;
  total_adjusted: number;
  adjustment_reason: string;
  status: string;
  created_at: string;
};

const PAYERS = ["Blue Cross Blue Shield", "UnitedHealthcare", "Aetna", "Cigna", "Humana", "Medicaid", "TRICARE", "Kaiser Permanente", "Other"];
const ADJUSTMENT_REASONS = ["Contractual adjustment", "Deductible", "Co-pay", "Co-insurance", "Not covered", "Prior auth required", "Medical necessity denied", "Timely filing", "Duplicate claim", "Other"];
const STATUSES = ["posted", "pending_review", "disputed", "resolved"];

const emptyForm = {
  client_id: "",
  payer_name: "",
  check_number: "",
  payment_date: new Date().toISOString().split("T")[0],
  total_billed: 0,
  total_paid: 0,
  total_adjusted: 0,
  adjustment_reason: "",
  status: "posted",
};

export default function ERAEOBPage() {
  const [records, setRecords] = useState<ERARecord[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterPayer, setFilterPayer] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: recordData }] = await Promise.all([
      supabase.from("clients").select("id, full_name"),
      supabase.from("era_eob_records").select("*").eq("created_by", user.id).order("payment_date", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setRecords(recordData ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.payer_name || !form.payment_date) { setError("Payer and payment date are required."); return; }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error: saveError } = await supabase.from("era_eob_records").insert([{
      ...form,
      client_id: form.client_id || null,
      created_by: user.id,
    }]).select().single();

    if (saveError) { setError(saveError.message); setSaving(false); return; }

    setRecords((prev) => [data, ...prev]);
    setForm(emptyForm);
    setShowForm(false);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from("era_eob_records").delete().eq("id", id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }

  const filtered = filterPayer ? records.filter((r) => r.payer_name === filterPayer) : records;
  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  const totalBilled = filtered.reduce((a, b) => a + b.total_billed, 0);
  const totalPaid = filtered.reduce((a, b) => a + b.total_paid, 0);
  const totalAdjusted = filtered.reduce((a, b) => a + b.total_adjusted, 0);
  const collectionRate = totalBilled ? Math.round((totalPaid / totalBilled) * 100) : 0;

  function statusColor(status: string) {
    if (status === "posted") return "bg-green-100 text-green-700";
    if (status === "pending_review") return "bg-yellow-100 text-yellow-700";
    if (status === "disputed") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-600";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="ERA / EOB Posting">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Post ERA/EOB"}
        </Button>
      </PageHeader>

      {/* SUMMARY */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4 text-center bg-white">
          <p className="text-2xl font-bold text-blue-600">${totalBilled.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Total Billed</p>
        </div>
        <div className="border rounded-lg p-4 text-center bg-white">
          <p className="text-2xl font-bold text-green-600">${totalPaid.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Total Paid</p>
        </div>
        <div className="border rounded-lg p-4 text-center bg-white">
          <p className="text-2xl font-bold text-red-500">${totalAdjusted.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Adjustments</p>
        </div>
        <div className="border rounded-lg p-4 text-center bg-white">
          <p className="text-2xl font-bold text-purple-600">{collectionRate}%</p>
          <p className="text-xs text-gray-500 mt-1">Collection Rate</p>
        </div>
      </div>

      {showForm && (
        <Section title="Post ERA/EOB Record">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Payer *</label>
              <select value={form.payer_name} onChange={(e) => setForm({ ...form, payer_name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select payer...</option>
                {PAYERS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client</label>
              <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">No specific client</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Check / EFT Number</label>
              <input type="text" value={form.check_number} onChange={(e) => setForm({ ...form, check_number: e.target.value })}
                placeholder="e.g. CHK123456" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Payment Date *</label>
              <input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Total Billed ($)</label>
              <input type="number" step="0.01" value={form.total_billed} onChange={(e) => setForm({ ...form, total_billed: parseFloat(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Total Paid ($)</label>
              <input type="number" step="0.01" value={form.total_paid} onChange={(e) => setForm({ ...form, total_paid: parseFloat(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Adjustment Amount ($)</label>
              <input type="number" step="0.01" value={form.total_adjusted} onChange={(e) => setForm({ ...form, total_adjusted: parseFloat(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Adjustment Reason</label>
              <select value={form.adjustment_reason} onChange={(e) => setForm({ ...form, adjustment_reason: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select reason...</option>
                {ADJUSTMENT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>Post ERA/EOB</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* FILTER */}
      {!loading && records.length > 0 && (
        <div className="flex gap-3 items-center">
          <select value={filterPayer} onChange={(e) => setFilterPayer(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Payers</option>
            {PAYERS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <p className="text-sm text-gray-400">{filtered.length} records</p>
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <Section title="ERA/EOB Records">
          <p className="text-gray-400 text-sm">No ERA/EOB records posted yet.</p>
        </Section>
      )}

      <div className="space-y-3">
        {filtered.map((r) => (
          <div key={r.id} className="border border-gray-100 rounded-xl p-4 bg-white">
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <p className="font-semibold text-gray-800">{r.payer_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {r.check_number && `Check: ${r.check_number} · `}
                  {r.payment_date}
                  {r.client_id && ` · ${clientMap.get(r.client_id)}`}
                </p>
                {r.adjustment_reason && <p className="text-xs text-gray-500 mt-1">Adjustment: {r.adjustment_reason}</p>}
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(r.status)}`}>
                  {r.status.replace("_", " ")}
                </span>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Billed: ${r.total_billed.toFixed(2)}</p>
                  <p className="text-sm font-bold text-green-600">Paid: ${r.total_paid.toFixed(2)}</p>
                  {r.total_adjusted > 0 && <p className="text-xs text-red-500">Adj: -${r.total_adjusted.toFixed(2)}</p>}
                </div>
                <button onClick={() => handleDelete(r.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}