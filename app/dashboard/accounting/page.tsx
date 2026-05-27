"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

type AccountingRecord = {
  id: string;
  record_type: string;
  amount: number;
  category: string;
  description: string;
  reference_number: string | null;
  transaction_date: string;
  status: string;
  quickbooks_id: string | null;
  created_at: string;
};

const RECORD_TYPES = ["income", "expense", "payroll", "refund", "adjustment"];
const CATEGORIES = {
  income: ["Session fees", "Assessment fees", "Consultation", "Training", "Other income"],
  expense: ["Rent/Facility", "Staff salaries", "Insurance", "Supplies", "Software/Tech", "Marketing", "Professional development", "Other expense"],
  payroll: ["RBT wages", "BCBA salary", "Admin staff", "Contractor payment", "Payroll taxes"],
  refund: ["Client refund", "Insurance refund", "Vendor refund"],
  adjustment: ["Write-off", "Correction", "Insurance adjustment"],
};

const emptyForm = {
  record_type: "income",
  amount: 0,
  category: "",
  description: "",
  reference_number: "",
  transaction_date: new Date().toISOString().split("T")[0],
  status: "completed",
};

export default function AccountingPage() {
  const [records, setRecords] = useState<AccountingRecord[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [dateRange, setDateRange] = useState("3m");
  const [activeTab, setActiveTab] = useState<"records" | "reports" | "quickbooks">("records");

  useEffect(() => { init(); }, [dateRange]);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const monthsBack = dateRange === "1m" ? 1 : dateRange === "3m" ? 3 : dateRange === "6m" ? 6 : 12;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const { data } = await supabase.from("accounting_records")
      .select("*")
      .eq("created_by", user.id)
      .gte("transaction_date", startDate.toISOString().split("T")[0])
      .order("transaction_date", { ascending: false });

    setRecords(data ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.record_type || !form.amount || !form.category) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("accounting_records").insert([{
      ...form,
      reference_number: form.reference_number || null,
      created_by: user.id,
    }]).select().single();

    if (data) setRecords((prev) => [data, ...prev]);
    setForm(emptyForm);
    setShowForm(false);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from("accounting_records").delete().eq("id", id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }

  const filtered = filterType ? records.filter((r) => r.record_type === filterType) : records;

  const totalIncome = records.filter((r) => r.record_type === "income").reduce((a, b) => a + b.amount, 0);
  const totalExpenses = records.filter((r) => ["expense", "payroll"].includes(r.record_type)).reduce((a, b) => a + b.amount, 0);
  const netProfit = totalIncome - totalExpenses;
  const totalPayroll = records.filter((r) => r.record_type === "payroll").reduce((a, b) => a + b.amount, 0);

  // Monthly chart data
  const monthlyData = records.reduce((acc, r) => {
    const month = r.transaction_date.slice(0, 7);
    const existing = acc.find((a) => a.month === month);
    if (existing) {
      if (r.record_type === "income") existing.income += r.amount;
      else if (["expense", "payroll"].includes(r.record_type)) existing.expenses += r.amount;
    } else {
      acc.push({
        month,
        income: r.record_type === "income" ? r.amount : 0,
        expenses: ["expense", "payroll"].includes(r.record_type) ? r.amount : 0,
      });
    }
    return acc;
  }, [] as { month: string; income: number; expenses: number }[]).sort((a, b) => a.month.localeCompare(b.month));

  function typeColor(type: string) {
    if (type === "income") return "bg-green-100 text-green-700";
    if (type === "expense") return "bg-red-100 text-red-700";
    if (type === "payroll") return "bg-orange-100 text-orange-700";
    if (type === "refund") return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-600";
  }

  function exportCSV() {
    const headers = "Date,Type,Category,Description,Amount,Reference,Status";
    const rows = filtered.map((r) => `${r.transaction_date},${r.record_type},${r.category},"${r.description}",${r.amount},${r.reference_number ?? ""},${r.status}`).join("\n");
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accounting-${dateRange}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Accounting">
        <div className="flex gap-2">
          <div className="flex gap-1 border border-gray-200 rounded-lg p-1">
            {["1m", "3m", "6m", "12m"].map((r) => (
              <button key={r} onClick={() => setDateRange(r)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${dateRange === r ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700"}`}>
                {r}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={exportCSV}>📥 CSV</Button>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Add Record"}
          </Button>
        </div>
      </PageHeader>

      {/* SUMMARY */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-xl p-4 text-center bg-white">
          <p className="text-2xl font-bold text-green-600">${totalIncome.toFixed(0)}</p>
          <p className="text-xs text-gray-500 mt-1">Total Income</p>
        </div>
        <div className="border rounded-xl p-4 text-center bg-white">
          <p className="text-2xl font-bold text-red-500">${totalExpenses.toFixed(0)}</p>
          <p className="text-xs text-gray-500 mt-1">Total Expenses</p>
        </div>
        <div className="border rounded-xl p-4 text-center bg-white">
          <p className={`text-2xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-500"}`}>
            ${netProfit.toFixed(0)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Net Profit</p>
        </div>
        <div className="border rounded-xl p-4 text-center bg-white">
          <p className="text-2xl font-bold text-orange-500">${totalPayroll.toFixed(0)}</p>
          <p className="text-xs text-gray-500 mt-1">Payroll</p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { key: "records", label: "Records" },
          { key: "reports", label: "Reports" },
          { key: "quickbooks", label: "QuickBooks" },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* FORM */}
      {showForm && (
        <Section title="Add Accounting Record">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Type *</label>
              <select value={form.record_type} onChange={(e) => setForm({ ...form, record_type: e.target.value, category: "" })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                {RECORD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Category *</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select category...</option>
                {(CATEGORIES[form.record_type as keyof typeof CATEGORIES] ?? []).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Amount ($) *</label>
              <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Date</label>
              <input type="date" value={form.transaction_date} onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description..." className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Reference / Invoice #</label>
              <input type="text" value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
                placeholder="Optional reference number" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>Save Record</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* RECORDS TAB */}
      {activeTab === "records" && (
        <>
          <div className="flex flex-wrap gap-3 items-center">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">All Types</option>
              {RECORD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <p className="text-sm text-gray-400">{filtered.length} records</p>
          </div>

          {loading && <p className="text-gray-400 text-sm">Loading...</p>}

          <div className="space-y-2">
            {filtered.map((r) => (
              <div key={r.id} className="border border-gray-100 rounded-xl p-4 bg-white flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${typeColor(r.record_type)}`}>
                      {r.record_type}
                    </span>
                    <p className="text-sm font-medium text-gray-800">{r.category}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {r.transaction_date}
                    {r.description && ` · ${r.description}`}
                    {r.reference_number && ` · #${r.reference_number}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className={`font-bold ${["income", "refund"].includes(r.record_type) ? "text-green-600" : "text-red-500"}`}>
                    {["income", "refund"].includes(r.record_type) ? "+" : "-"}${r.amount.toFixed(2)}
                  </p>
                  <button onClick={() => handleDelete(r.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* REPORTS TAB */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          {monthlyData.length > 0 && (
            <Section title="Income vs Expenses">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(v) => [`$${v}`, ""]} />
                  <Bar dataKey="income" fill="#16a34a" name="Income" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="#dc2626" name="Expenses" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>
          )}

          <Section title="Category Breakdown">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(
                records.reduce((acc, r) => {
                  acc[r.category] = (acc[r.category] ?? 0) + r.amount;
                  return acc;
                }, {} as Record<string, number>)
              ).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([category, amount]) => {
                const record = records.find((r) => r.category === category);
                return (
                  <div key={category} className="flex justify-between items-center border border-gray-100 rounded-lg p-3 bg-white">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${typeColor(record?.record_type ?? "")}`}>
                        {record?.record_type}
                      </span>
                      <span className="text-sm text-gray-700">{category}</span>
                    </div>
                    <span className={`font-bold text-sm ${["income", "refund"].includes(record?.record_type ?? "") ? "text-green-600" : "text-red-500"}`}>
                      ${amount.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>
      )}

      {/* QUICKBOOKS TAB */}
      {activeTab === "quickbooks" && (
        <Section title="QuickBooks Integration">
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm font-bold text-green-800 mb-2">🔌 QuickBooks Online Integration</p>
              <p className="text-sm text-green-700 mb-3">
                Connect ABA AI to QuickBooks Online to automatically sync income, expenses, payroll, and invoices.
              </p>
              <div className="space-y-2 text-xs text-green-600">
                <p>• Bi-directional sync of accounting records</p>
                <p>• Auto-generate invoices from session billing</p>
                <p>• Payroll export for RBT and BCBA hours</p>
                <p>• P&L reports pulled directly from QuickBooks</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-700">Setup Steps:</p>
              {[
                { step: "1", text: "Sign up for QuickBooks Online at quickbooks.intuit.com", link: "https://quickbooks.intuit.com", status: "pending" },
                { step: "2", text: "Create a QuickBooks app at developer.intuit.com to get Client ID and Secret", link: "https://developer.intuit.com", status: "pending" },
                { step: "3", text: "Add QB_CLIENT_ID and QB_CLIENT_SECRET to .env.local", link: null, status: "pending" },
                { step: "4", text: "Connect your QuickBooks company account via OAuth", link: null, status: "pending" },
                { step: "5", text: "Map ABA AI categories to QuickBooks chart of accounts", link: null, status: "pending" },
              ].map((item) => (
                <div key={item.step} className="flex items-center gap-3 border border-gray-100 rounded-lg p-3 bg-white">
                  <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full text-xs flex items-center justify-center font-bold shrink-0">
                    {item.step}
                  </span>
                  <p className="text-sm text-gray-600 flex-1">{item.text}</p>
                  {item.link && (
                    <a href={item.link} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline shrink-0">Open →</a>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-gray-900 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-400 mb-2">Add to .env.local</p>
              <code className="text-xs text-green-400 whitespace-pre">{`QB_CLIENT_ID=your_quickbooks_client_id
QB_CLIENT_SECRET=your_quickbooks_client_secret
QB_REDIRECT_URI=https://your-domain.com/api/quickbooks/callback
QB_ENVIRONMENT=sandbox`}</code>
            </div>

            <Button variant="outline" onClick={() => window.open("https://developer.intuit.com", "_blank")}>
              🔗 Set Up QuickBooks Integration →
            </Button>
          </div>
        </Section>
      )}
    </div>
  );
}