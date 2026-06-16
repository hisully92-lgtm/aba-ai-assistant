"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type AccountingRecord = {
  id: string;
  record_type: string;
  amount: number;
  category: string;
  description: string;
  reference_number: string | null;
  transaction_date: string;
  status: string;
  created_at: string;
};

type Integration = {
  type: string;
  label: string;
  icon: string;
  category: string;
  description: string;
  fields: { key: string; label: string; type: string; placeholder: string }[];
  helpUrl: string;
  status: "available" | "coming_soon";
};

const RECORD_TYPES = ["income", "expense", "payroll", "refund", "adjustment"];
const CATEGORIES = {
  income: ["Session fees", "Assessment fees", "Consultation", "Training", "Other income"],
  expense: ["Rent/Facility", "Staff salaries", "Insurance", "Supplies", "Software/Tech", "Marketing", "Professional development", "Other expense"],
  payroll: ["RBT wages", "BCBA salary", "Admin staff", "Contractor payment", "Payroll taxes"],
  refund: ["Client refund", "Insurance refund", "Vendor refund"],
  adjustment: ["Write-off", "Correction", "Insurance adjustment"],
};

const INTEGRATIONS: Integration[] = [
  {
    type: "quickbooks",
    label: "QuickBooks Online",
    icon: "📊",
    category: "Accounting",
    description: "Sync income, expenses, payroll, and invoices directly to QuickBooks Online.",
    helpUrl: "https://developer.intuit.com",
    status: "available",
    fields: [
      { key: "client_id", label: "Client ID", type: "text", placeholder: "Your QuickBooks Client ID" },
      { key: "client_secret", label: "Client Secret", type: "password", placeholder: "Your QuickBooks Client Secret" },
      { key: "realm_id", label: "Company ID (Realm ID)", type: "text", placeholder: "Your QuickBooks Company ID" },
    ],
  },
  {
    type: "xero",
    label: "Xero",
    icon: "🟦",
    category: "Accounting",
    description: "Connect Xero for invoicing, expense tracking, and financial reporting.",
    helpUrl: "https://developer.xero.com",
    status: "available",
    fields: [
      { key: "client_id", label: "Client ID", type: "text", placeholder: "Your Xero Client ID" },
      { key: "client_secret", label: "Client Secret", type: "password", placeholder: "Your Xero Client Secret" },
      { key: "tenant_id", label: "Tenant ID", type: "text", placeholder: "Your Xero Tenant ID" },
    ],
  },
  {
    type: "freshbooks",
    label: "FreshBooks",
    icon: "📗",
    category: "Accounting",
    description: "Sync invoices, expenses, and time tracking with FreshBooks.",
    helpUrl: "https://www.freshbooks.com/api",
    status: "available",
    fields: [
      { key: "client_id", label: "Client ID", type: "text", placeholder: "Your FreshBooks Client ID" },
      { key: "client_secret", label: "Client Secret", type: "password", placeholder: "Your FreshBooks Client Secret" },
      { key: "account_id", label: "Account ID", type: "text", placeholder: "Your FreshBooks Account ID" },
    ],
  },
  {
    type: "wave",
    label: "Wave Accounting",
    icon: "🌊",
    category: "Accounting",
    description: "Free accounting software — sync transactions and invoices with Wave.",
    helpUrl: "https://developer.waveapps.com",
    status: "available",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "Your Wave API Key" },
      { key: "business_id", label: "Business ID", type: "text", placeholder: "Your Wave Business ID" },
    ],
  },
  {
    type: "square",
    label: "Square Payments",
    icon: "⬛",
    category: "Payments",
    description: "Accept client payments and sync Square transactions automatically.",
    helpUrl: "https://developer.squareup.com",
    status: "available",
    fields: [
      { key: "access_token", label: "Access Token", type: "password", placeholder: "sq0atp-xxxxxxxxxx" },
      { key: "location_id", label: "Location ID", type: "text", placeholder: "Your Square Location ID" },
      { key: "environment", label: "Environment", type: "select", placeholder: "sandbox or production" },
    ],
  },
  {
    type: "stripe",
    label: "Stripe",
    icon: "💳",
    category: "Payments",
    description: "Process client payments and sync Stripe transactions to your records.",
    helpUrl: "https://stripe.com/docs/api",
    status: "available",
    fields: [
      { key: "publishable_key", label: "Publishable Key", type: "text", placeholder: "pk_live_xxxxxxxxxx" },
      { key: "secret_key", label: "Secret Key", type: "password", placeholder: "sk_live_xxxxxxxxxx" },
      { key: "webhook_secret", label: "Webhook Secret", type: "password", placeholder: "whsec_xxxxxxxxxx" },
    ],
  },
  {
    type: "gusto",
    label: "Gusto Payroll",
    icon: "💼",
    category: "Payroll",
    description: "Sync approved staff hours to Gusto for automatic payroll processing.",
    helpUrl: "https://docs.gusto.com",
    status: "available",
    fields: [
      { key: "api_token", label: "API Token", type: "password", placeholder: "Your Gusto API Token" },
      { key: "company_id", label: "Company ID", type: "text", placeholder: "Your Gusto Company ID" },
    ],
  },
  {
    type: "adp",
    label: "ADP Workforce Now",
    icon: "🏢",
    category: "Payroll",
    description: "Export approved time entries to ADP for payroll processing.",
    helpUrl: "https://developers.adp.com",
    status: "available",
    fields: [
      { key: "client_id", label: "Client ID", type: "text", placeholder: "Your ADP Client ID" },
      { key: "client_secret", label: "Client Secret", type: "password", placeholder: "Your ADP Client Secret" },
    ],
  },
  {
    type: "paychex",
    label: "Paychex Flex",
    icon: "📋",
    category: "Payroll",
    description: "Connect Paychex to sync staff hours and run payroll automatically.",
    helpUrl: "https://developer.paychex.com",
    status: "available",
    fields: [
      { key: "client_id", label: "Client ID", type: "text", placeholder: "Your Paychex Client ID" },
      { key: "client_secret", label: "Client Secret", type: "password", placeholder: "Your Paychex Client Secret" },
      { key: "company_id", label: "Company ID", type: "text", placeholder: "Your Paychex Company ID" },
    ],
  },
  {
    type: "sage",
    label: "Sage Accounting",
    icon: "🌿",
    category: "Accounting",
    description: "Sync with Sage for invoicing, expenses, and financial reporting.",
    helpUrl: "https://developer.sage.com",
    status: "coming_soon",
    fields: [],
  },
  {
    type: "netsuite",
    label: "NetSuite (Oracle)",
    icon: "🔶",
    category: "Accounting",
    description: "Enterprise ERP integration for larger ABA organizations.",
    helpUrl: "https://docs.oracle.com/en/cloud/saas/netsuite",
    status: "coming_soon",
    fields: [],
  },
  {
    type: "csv_excel",
    label: "CSV / Excel Export",
    icon: "📥",
    category: "Export",
    description: "Export all accounting records to CSV or Excel. Works with any accounting software.",
    helpUrl: "",
    status: "available",
    fields: [],
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  Accounting: "bg-blue-100 text-blue-700",
  Payments: "bg-green-100 text-green-700",
  Payroll: "bg-purple-100 text-purple-700",
  Export: "bg-gray-100 text-gray-700",
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
  const [activeTab, setActiveTab] = useState<"records" | "reports" | "integrations">("records");
  const [expandedIntegration, setExpandedIntegration] = useState<string | null>(null);
  const [integrationValues, setIntegrationValues] = useState<Record<string, Record<string, string>>>({});
  const [savedIntegrations, setSavedIntegrations] = useState<Record<string, boolean>>({});
  const [savingIntegration, setSavingIntegration] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [companyId, setCompanyId] = useState("");

  useEffect(() => { init(); }, [dateRange]); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data: cu } = await supabase.from("company_users")
      .select("company_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
    setCompanyId(cu?.company_id ?? "");

    const monthsBack = dateRange === "1m" ? 1 : dateRange === "3m" ? 3 : dateRange === "6m" ? 6 : 12;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const [{ data: recordData }, { data: integrationData }] = await Promise.all([
      supabase.from("accounting_records")
        .select("*")
        .eq("created_by", user.id)
        .gte("transaction_date", startDate.toISOString().split("T")[0])
        .order("transaction_date", { ascending: false }),
      supabase.from("integration_settings")
        .select("*")
        .eq("company_id", cu?.company_id ?? ""),
    ]);

    setRecords(recordData ?? []);

    const savedMap: Record<string, boolean> = {};
    const valuesMap: Record<string, Record<string, string>> = {};
    (integrationData ?? []).forEach((s: any) => {
      savedMap[s.integration_type] = s.is_configured;
      valuesMap[s.integration_type] = typeof s.config === "object" ? s.config : JSON.parse(s.config || "{}");
    });
    setSavedIntegrations(savedMap);
    setIntegrationValues(valuesMap);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.record_type || !form.amount || !form.category) return;
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const { data } = await supabase.from("accounting_records").insert([{
      ...form, reference_number: form.reference_number || null, created_by: user.id,
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

  async function saveIntegration(type: string) {
    setSavingIntegration(type);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const config = integrationValues[type] ?? {};
    const hasValues = Object.values(config).some((v) => v?.trim() !== "");

    const { data: existing } = await supabase.from("integration_settings")
      .select("id").eq("company_id", companyId).eq("integration_type", type).maybeSingle();

    if (existing) {
      await supabase.from("integration_settings").update({
        config, is_configured: hasValues, updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await supabase.from("integration_settings").insert([{
        company_id: companyId, integration_type: type,
        config, is_configured: hasValues, is_enabled: hasValues, created_by: user.id,
      }]);
    }

    setSavedIntegrations((prev) => ({ ...prev, [type]: hasValues }));
    setSavingIntegration(null);
  }

  function updateIntegrationField(type: string, key: string, value: string) {
    setIntegrationValues((prev) => ({
      ...prev, [type]: { ...(prev[type] ?? {}), [key]: value },
    }));
  }

  function exportCSV() {
    const headers = "Date,Type,Category,Description,Amount,Reference,Status";
    const rows = filtered.map((r) =>
      `${r.transaction_date},${r.record_type},${r.category},"${r.description}",${r.amount},${r.reference_number ?? ""},${r.status}`
    ).join("\n");
    const blob = new Blob([`${headers}\n${rows}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accounting-${dateRange}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

  function exportExcel() {
    const headers = ["Date", "Type", "Category", "Description", "Amount", "Reference", "Status"];
    const rows = filtered.map((r) => [
      r.transaction_date, r.record_type, r.category, r.description,
      r.amount, r.reference_number ?? "", r.status,
    ]);
    const content = [headers, ...rows].map((r) => r.join("\t")).join("\n");
    const blob = new Blob([content], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accounting-${dateRange}-${new Date().toISOString().split("T")[0]}.xls`;
    a.click();
  }

  const filtered = filterType ? records.filter((r) => r.record_type === filterType) : records;
  const totalIncome = records.filter((r) => r.record_type === "income").reduce((a, b) => a + b.amount, 0);
  const totalExpenses = records.filter((r) => ["expense", "payroll"].includes(r.record_type)).reduce((a, b) => a + b.amount, 0);
  const netProfit = totalIncome - totalExpenses;
  const totalPayroll = records.filter((r) => r.record_type === "payroll").reduce((a, b) => a + b.amount, 0);

  const monthlyData = records.reduce((acc, r) => {
    const month = r.transaction_date.slice(0, 7);
    const existing = acc.find((a) => a.month === month);
    if (existing) {
      if (r.record_type === "income") existing.income += r.amount;
      else if (["expense", "payroll"].includes(r.record_type)) existing.expenses += r.amount;
    } else {
      acc.push({ month, income: r.record_type === "income" ? r.amount : 0, expenses: ["expense", "payroll"].includes(r.record_type) ? r.amount : 0 });
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

  const configuredCount = INTEGRATIONS.filter((i) => savedIntegrations[i.type]).length;
  const filteredIntegrations = filterCategory === "all"
    ? INTEGRATIONS
    : INTEGRATIONS.filter((i) => i.category === filterCategory);

  return (
    <div className="space-y-6">
      <PageHeader title="Accounting & Integrations">
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-1 border border-gray-200 rounded-lg p-1">
            {["1m", "3m", "6m", "12m"].map((r) => (
              <button key={r} onClick={() => setDateRange(r)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${dateRange === r ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700"}`}>
                {r}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={exportCSV}>📥 CSV</Button>
          <Button variant="outline" onClick={exportExcel}>📊 Excel</Button>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Add Record"}
          </Button>
        </div>
      </PageHeader>

      {/* STATS */}
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
          <p className={`text-2xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-500"}`}>${netProfit.toFixed(0)}</p>
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
          { key: "integrations", label: `🔌 Integrations (${configuredCount} connected)` },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ADD RECORD FORM */}
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
              <input type="number" step="0.01" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Date</label>
              <input type="date" value={form.transaction_date}
                onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
              <input type="text" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Reference / Invoice #</label>
              <input type="text" value={form.reference_number}
                onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
                placeholder="Optional"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
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
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">All Types</option>
              {RECORD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <p className="text-sm text-gray-400">{filtered.length} records</p>
          </div>
          {loading && <p className="text-gray-400 text-sm">Loading...</p>}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
              <p className="text-3xl mb-3">📊</p>
              <p className="text-gray-600 font-medium">No accounting records yet</p>
              <p className="text-gray-400 text-sm mt-1">Add a record above or connect an integration to sync automatically.</p>
            </div>
          )}
          {filtered.map((r) => (
            <div key={r.id} className="border border-gray-100 rounded-xl p-4 bg-white flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${typeColor(r.record_type)}`}>{r.record_type}</span>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(
                records.reduce((acc, r) => { acc[r.category] = (acc[r.category] ?? 0) + r.amount; return acc; }, {} as Record<string, number>)
              ).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([category, amount]) => {
                const record = records.find((r) => r.category === category);
                return (
                  <div key={category} className="flex justify-between items-center border border-gray-100 rounded-lg p-3 bg-white">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${typeColor(record?.record_type ?? "")}`}>{record?.record_type}</span>
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

      {/* INTEGRATIONS TAB */}
      {activeTab === "integrations" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-sm font-semibold text-blue-800 mb-1">🔌 Per-Company Integrations</p>
            <p className="text-sm text-blue-700">Each clinic connects their own accounts. Your data never mixes with other clinics. Credentials are encrypted and stored securely per company.</p>
          </div>

          {/* CATEGORY FILTER */}
          <div className="flex flex-wrap gap-2">
            {["all", "Accounting", "Payments", "Payroll", "Export"].map((cat) => (
              <button key={cat} onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filterCategory === cat ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:border-blue-300"}`}>
                {cat === "all" ? "All" : cat}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredIntegrations.map((intg) => {
              const isExpanded = expandedIntegration === intg.type;
              const isConfigured = savedIntegrations[intg.type];
              const hasFields = intg.fields.length > 0;

              return (
                <div key={intg.type} className={`border rounded-xl bg-white ${isConfigured ? "border-green-200" : "border-gray-100"}`}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <span className="text-2xl">{intg.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-800">{intg.label}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[intg.category] ?? "bg-gray-100 text-gray-600"}`}>
                              {intg.category}
                            </span>
                            {isConfigured && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">✓ Connected</span>}
                            {intg.status === "coming_soon" && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Coming Soon</span>}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{intg.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {intg.helpUrl && (
                          <a href={intg.helpUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">Docs →</a>
                        )}
                        {intg.type === "csv_excel" ? (
                          <div className="flex gap-2">
                            <Button variant="outline" onClick={exportCSV}>CSV</Button>
                            <Button variant="outline" onClick={exportExcel}>Excel</Button>
                          </div>
                        ) : intg.status !== "coming_soon" && hasFields && (
                          <button onClick={() => setExpandedIntegration(isExpanded ? null : intg.type)}
                            className="text-xs text-gray-400 hover:text-gray-600">
                            {isExpanded ? "▲" : "▼"}
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && hasFields && (
                      <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {intg.fields.map((field) => (
                            <div key={field.key}>
                              <label className="text-xs font-medium text-gray-700 mb-1 block">{field.label}</label>
                              {field.type === "select" ? (
                                <select value={integrationValues[intg.type]?.[field.key] ?? ""}
                                  onChange={(e) => updateIntegrationField(intg.type, field.key, e.target.value)}
                                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                                  <option value="">Select...</option>
                                  <option value="sandbox">Sandbox (testing)</option>
                                  <option value="production">Production (live)</option>
                                </select>
                              ) : (
                                <input type={field.type}
                                  value={integrationValues[intg.type]?.[field.key] ?? ""}
                                  onChange={(e) => updateIntegrationField(intg.type, field.key, e.target.value)}
                                  placeholder={field.placeholder}
                                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button onClick={() => saveIntegration(intg.type)} loading={savingIntegration === intg.type}>
                            💾 Save Connection
                          </Button>
                          {isConfigured && (
                            <Button variant="outline" onClick={async () => {
                              updateIntegrationField(intg.type, "_all", "");
                              await saveIntegration(intg.type);
                              setSavedIntegrations((prev) => ({ ...prev, [intg.type]: false }));
                            }}>
                              Disconnect
                            </Button>
                          )}
                        </div>
                        <div className="bg-gray-900 rounded-xl p-3 mt-2">
                          <p className="text-xs font-semibold text-gray-400 mb-1">Also add to .env.local & Vercel</p>
                          <code className="text-xs text-green-400 whitespace-pre">{
                            intg.fields.map((f) => `${intg.type.toUpperCase()}_${f.key.toUpperCase()}=your_${f.key}`).join("\n")
                          }</code>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}