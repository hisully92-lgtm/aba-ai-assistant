"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";

const YOUR_COMPANY_ID = "fcb8cbb2-4136-4d02-ba09-5355cc888189";

type Invoice = {
  id: string;
  company_id: string;
  invoice_number: string;
  description: string;
  amount: number;
  status: string;
  created_at: string;
  company_name?: string;
};

type CompanyRow = {
  id: string;
  name: string;
};

export default function AdminInvoicesPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => { checkAccess(); }, []);

  async function checkAccess() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }

    const { data: cu } = await supabase
      .from("company_users")
      .select("role")
      .eq("user_id", user.id)
      .eq("company_id", YOUR_COMPANY_ID)
      .maybeSingle();

    if (!cu || !["admin", "director", "clinical_director"].includes(cu.role ?? "")) {
      window.location.href = "/dashboard";
      return;
    }

    setAuthorized(true);
    await loadInvoices();
    setLoading(false);
  }

  async function loadInvoices() {
    const result = await supabase
      .from("company_invoices")
      .select("*")
      .order("created_at", { ascending: false });

    const invoiceData = (result.data ?? []) as Invoice[];

    if (invoiceData.length === 0) {
      setInvoices([]);
      return;
    }

    const companyIds: string[] = Array.from(new Set(invoiceData.map(function (i: Invoice) { return i.company_id; })));

    const companyResult = await supabase
      .from("companies")
      .select("id, name")
      .in("id", companyIds);

    const companies = (companyResult.data ?? []) as CompanyRow[];

    const nameMap: Record<string, string> = {};
    companies.forEach(function (c: CompanyRow) { nameMap[c.id] = c.name; });

    const merged: Invoice[] = invoiceData.map(function (i: Invoice) {
      return { id: i.id, company_id: i.company_id, invoice_number: i.invoice_number, description: i.description, amount: i.amount, status: i.status, created_at: i.created_at, company_name: nameMap[i.company_id] || "Unknown" };
    });

    setInvoices(merged);
  }

  function downloadCSV() {
    const headers = ["Invoice Number", "Company", "Description", "Amount", "Status", "Date"];
    const rows = filtered.map(function (inv: Invoice) {
      return [
        inv.invoice_number,
        inv.company_name || "",
        inv.description,
        inv.amount.toFixed(2),
        inv.status,
        new Date(inv.created_at).toLocaleDateString(),
      ];
    });
    const csv = [headers, ...rows].map(function (r: string[]) {
      return r.map(function (v: string) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(",");
    }).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invoices-export-" + new Date().toISOString().split("T")[0] + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered: Invoice[] = invoices.filter(function (inv: Invoice) {
    return (
      (inv.company_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      (inv.description ?? "").toLowerCase().includes(search.toLowerCase())
    );
  });

  const totalRevenue: number = filtered
    .filter(function (i: Invoice) { return i.status === "paid"; })
    .reduce(function (sum: number, i: Invoice) { return sum + Number(i.amount); }, 0);

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;
  if (!authorized) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="All Invoices">
        <button
          onClick={downloadCSV}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          Export to QuickBooks CSV
        </button>
      </PageHeader>

      <Section title="Summary">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Invoices</p>
            <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Paid Revenue</p>
            <p className="text-2xl font-bold text-green-600">${totalRevenue.toFixed(2)}</p>
          </div>
        </div>
      </Section>

      <input
        type="text"
        placeholder="Search by company, invoice number, or description..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
      />

      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">No invoices found.</p>
        )}
        {filtered.map(function (inv: Invoice) {
          return (
            <div key={inv.id} className="border border-gray-100 rounded-xl p-4 bg-white flex justify-between items-center flex-wrap gap-2">
              <div>
                <p className="font-semibold text-gray-800 text-sm">{inv.company_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{inv.description}</p>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{inv.invoice_number}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900">${Number(inv.amount).toFixed(2)}</p>
                <span className={"text-xs px-2 py-0.5 rounded-full font-medium " + (inv.status === "paid" ? "bg-green-100 text-green-700" : inv.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700")}>
                  {inv.status}
                </span>
                <p className="text-xs text-gray-400 mt-0.5">{new Date(inv.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
