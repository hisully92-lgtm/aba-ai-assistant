"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";

type Invoice = {
  id: string;
  invoice_number: string;
  description: string;
  amount: number;
  status: string;
  created_at: string;
};

export default function CompanyInvoicesPage() {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }

    const { data: cu } = await supabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!cu?.company_id) { setLoading(false); return; }

    const { data } = await supabase
      .from("company_invoices")
      .select("*")
      .eq("company_id", cu.company_id)
      .order("created_at", { ascending: false });

    setInvoices(data ?? []);
    setLoading(false);
  }

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices">
        <p className="text-gray-500 text-sm">Your billing records for tax and accounting purposes.</p>
      </PageHeader>

      <Section title="Invoice History">
        {invoices.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No invoices yet.</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div key={inv.id} className="border border-gray-100 rounded-xl p-4 bg-white flex justify-between items-center flex-wrap gap-2">
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{inv.description}</p>
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
        )}
      </Section>
    </div>
  );
}
