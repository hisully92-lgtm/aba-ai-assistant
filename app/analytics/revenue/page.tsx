"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type Billing = {
  total_amount: number;
  status: string;
  created_at: string;
};

type Claim = {
  amount: number;
  status: string;
  created_at: string;
};

type MonthlyRevenue = {
  month: string;
  billed: number;
  paid: number;
  pending: number;
};

export default function RevenueDashboard() {
  const [billing, setBilling] = useState<Billing[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: billingData }, { data: claimData }] = await Promise.all([
        supabase.from("billing_sessions").select("total_amount, status, created_at"),
        supabase.from("insurance_claims").select("amount, status, created_at"),
      ]);
      setBilling(billingData ?? []);
      setClaims(claimData ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const billedTotal = billing.reduce((sum, b) => sum + (b.total_amount ?? 0), 0);
  const paidClaims = claims.filter((c) => c.status === "paid").reduce((sum, c) => sum + (c.amount ?? 0), 0);
  const pendingClaims = claims.filter((c) => c.status === "submitted").reduce((sum, c) => sum + (c.amount ?? 0), 0);
  const deniedClaims = claims.filter((c) => c.status === "denied").reduce((sum, c) => sum + (c.amount ?? 0), 0);
  const collectionRate = billedTotal ? ((paidClaims / billedTotal) * 100).toFixed(1) : "0.0";

  // GROUP BY MONTH
  const monthlyMap = new Map<string, MonthlyRevenue>();
  billing.forEach((b) => {
    const month = b.created_at?.slice(0, 7) ?? "unknown";
    if (!monthlyMap.has(month)) monthlyMap.set(month, { month, billed: 0, paid: 0, pending: 0 });
    monthlyMap.get(month)!.billed += b.total_amount ?? 0;
  });
  claims.forEach((c) => {
    const month = c.created_at?.slice(0, 7) ?? "unknown";
    if (!monthlyMap.has(month)) monthlyMap.set(month, { month, billed: 0, paid: 0, pending: 0 });
    if (c.status === "paid") monthlyMap.get(month)!.paid += c.amount ?? 0;
    if (c.status === "submitted") monthlyMap.get(month)!.pending += c.amount ?? 0;
  });

  const chartData = Array.from(monthlyMap.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6);

  function fmt(n: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  }

  if (loading) return <div className="p-6 text-gray-400">Loading revenue data...</div>;

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Revenue Analytics">
        <p className="text-gray-500 text-sm">Billing, insurance claims and collection performance.</p>
      </PageHeader>

      {/* KPI TILES */}
      <Section title="Revenue Overview">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{fmt(billedTotal)}</p>
            <p className="text-xs text-gray-500 mt-1">Total Billed</p>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{fmt(paidClaims)}</p>
            <p className="text-xs text-gray-500 mt-1">Paid Claims</p>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-yellow-500">{fmt(pendingClaims)}</p>
            <p className="text-xs text-gray-500 mt-1">Pending Claims</p>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-red-500">{fmt(deniedClaims)}</p>
            <p className="text-xs text-gray-500 mt-1">Denied Claims</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          <div className="border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{collectionRate}%</p>
            <p className="text-xs text-gray-500 mt-1">Collection Rate</p>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-700">{fmt(pendingClaims + deniedClaims)}</p>
            <p className="text-xs text-gray-500 mt-1">Outstanding</p>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-700">{billing.length}</p>
            <p className="text-xs text-gray-500 mt-1">Total Sessions</p>
          </div>
        </div>
      </Section>

      {/* TREND CHART */}
      {chartData.length > 0 && (
        <Section title="Revenue Trend (Last 6 Months)">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="billed" stroke="#2563eb" strokeWidth={2} name="Billed" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="paid" stroke="#16a34a" strokeWidth={2} name="Paid" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={2} name="Pending" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* INSIGHTS */}
      <Section title="Clinical Revenue Insights">
        <div className="space-y-2 text-sm text-gray-600">
          <p>📊 Insurance collection rate: <span className="font-semibold">{collectionRate}%</span></p>
          <p>⏳ Outstanding revenue: <span className="font-semibold">{fmt(pendingClaims + deniedClaims)}</span></p>
          <p>💰 Total clinical output: <span className="font-semibold">{fmt(billedTotal)}</span></p>
          <p>✅ Paid to date: <span className="font-semibold">{fmt(paidClaims)}</span></p>
        </div>
      </Section>
    </div>
  );
}