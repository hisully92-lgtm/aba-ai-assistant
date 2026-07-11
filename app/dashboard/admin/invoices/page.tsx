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
    const { data: invoiceData } = await supabase
      .from("company_invoices")
      .select("*")
      .order("created_at", { ascending: false });

    if (!invoiceData || invoiceData.length === 0) {
      setInvoices([]);
      return;
    }

    const companyIds = Array.from(new Set(invoiceData.map((i: { company_id: string }) => i.company_id)));
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name")
      .in("id", companyIds);

    const nameMap: Record<string, string> = {};
    (companies ?? []).forEach((c) => { nameMap[c.id] = c.name; });

    setInvoices(invoiceData.map((i) => ({ ...i, company_name: nameMap[i.company_id] || "Unknown" })));
  }

  function downloadCSV() {
    const headers = ["Invoice Number", "Company", "Description", "Amount", "Status", "Date"];
    const rows = filtered.map((inv) => [
      inv.invoice_number,
      inv.company_name,
      inv.description,
      inv.amount.toFixed(2),
      inv.status,
      new Date(inv.created_at).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invoices-export-" + new Date().toISOString().split("T")[0] + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = invoices.filter((inv) =>
    inv.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    inv.description?.toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = filtered.filter((i) => i.status === "paid").reduce((sum, i) => sum + Number(i.amount), 0);

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
        {filtered.map((inv) => (
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
        ))}
      </div>
    </div>
  );
}


