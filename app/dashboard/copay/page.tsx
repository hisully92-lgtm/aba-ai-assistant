"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type CopayRecord = {
  id: string;
  client_id: string;
  session_date: string;
  amount_due: number;
  amount_paid: number;
  payment_method: string;
  status: string;
  notes: string | null;
  created_at: string;
};

const PAYMENT_METHODS = ["Cash", "Check", "Credit Card", "Debit Card", "Zelle", "Venmo", "Insurance", "Waived", "Other"];

const emptyForm = {
  client_id: "",
  session_date: new Date().toISOString().split("T")[0],
  amount_due: 0,
  amount_paid: 0,
  payment_method: "Credit Card",
  status: "unpaid",
  notes: "",
};

export default function CopayPage() {
  const [records, setRecords] = useState<CopayRecord[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: recordData }] = await Promise.all([
      supabase.from("clients").select("id, full_name"),
      supabase.from("copay_tracking").select("*").eq("created_by", user.id).order("session_date", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setRecords(recordData ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.client_id || form.amount_due === 0) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const status = form.amount_paid >= form.amount_due ? "paid" : form.amount_paid > 0 ? "partial" : "unpaid";

    const { data } = await supabase.from("copay_tracking").insert([{
      ...form,
      status,
      notes: form.notes || null,
      created_by: user.id,
    }]).select().single();

    if (data) setRecords((prev) => [data, ...prev]);
    setForm(emptyForm);
    setShowForm(false);
    setSaving(false);
  }

  async function markPaid(id: string, amountDue: number) {
    await supabase.from("copay_tracking").update({ amount_paid: amountDue, status: "paid" }).eq("id", id);
    setRecords((prev) => prev.map((r) => r.id === id ? { ...r, amount_paid: amountDue, status: "paid" } : r));
  }

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  let filtered = records;
  if (filterClient) filtered = filtered.filter((r) => r.client_id === filterClient);
  if (filterStatus) filtered = filtered.filter((r) => r.status === filterStatus);

  const totalDue = records.filter((r) => r.status !== "paid").reduce((a, b) => a + (b.amount_due - b.amount_paid), 0);
  const totalCollected = records.reduce((a, b) => a + b.amount_paid, 0);
  const unpaidCount = records.filter((r) => r.status === "unpaid").length;

  function statusColor(status: string) {
    if (status === "paid") return "bg-green-100 text-green-700";
    if (status === "partial") return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-700";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Co-pay Tracking">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Log Co-pay"}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-xl p-4 text-center bg-white">
          <p className="text-2xl font-bold text-red-500">${totalDue.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Outstanding Balance</p>
        </div>
        <div className="border rounded-xl p-4 text-center bg-white">
          <p className="text-2xl font-bold text-green-600">${totalCollected.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Total Collected</p>
        </div>
        <div className="border rounded-xl p-4 text-center bg-white">
          <p className="text-2xl font-bold text-orange-500">{unpaidCount}</p>
          <p className="text-xs text-gray-500 mt-1">Unpaid Sessions</p>
        </div>
      </div>

      {showForm && (
        <Section title="Log Co-pay">
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
              <label className="text-sm font-medium text-gray-700 mb-1 block">Session Date</label>
              <input type="date" value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Amount Due ($)</label>
              <input type="number" step="0.01" value={form.amount_due} onChange={(e) => setForm({ ...form, amount_due: parseFloat(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Amount Paid ($)</label>
              <input type="number" step="0.01" value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: parseFloat(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Payment Method</label>
              <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>Save Co-pay</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">All Clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">All Statuses</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </select>
        <p className="text-sm text-gray-400">{filtered.length} records</p>
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}

      <div className="space-y-2">
        {filtered.map((record) => (
          <div key={record.id} className={`border rounded-xl p-4 bg-white ${record.status === "paid" ? "border-green-200" : record.status === "partial" ? "border-yellow-200" : "border-red-200"}`}>
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <p className="font-semibold text-gray-800">{clientMap.get(record.client_id) ?? "Unknown"}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {record.session_date} · {record.payment_method}
                  {record.notes && ` · ${record.notes}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-gray-400">Due: ${record.amount_due.toFixed(2)}</p>
                  <p className="text-sm font-bold text-green-600">Paid: ${record.amount_paid.toFixed(2)}</p>
                  {record.amount_due > record.amount_paid && (
                    <p className="text-xs text-red-500">Balance: ${(record.amount_due - record.amount_paid).toFixed(2)}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(record.status)}`}>
                  {record.status}
                </span>
                {record.status !== "paid" && (
                  <Button variant="outline" onClick={() => markPaid(record.id, record.amount_due)}>
                    Mark Paid
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}