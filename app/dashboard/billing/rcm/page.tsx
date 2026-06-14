"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import { usePlanGate } from "@/lib/hooks/usePlanGate";
import UpgradePrompt from "@/components/ui/UpgradePrompt";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line
} from "recharts";

export default function RCMPage() {
  const { hasFeature, planName } = usePlanGate();
  const insuranceGate = hasFeature("insurance");

  const [loading, setLoading] = useState(true);
  const [claimsData, setClaimsData] = useState<any[]>([]);
  const [eraData, setEraData] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalBilled: 0,
    totalPaid: 0,
    totalAdjusted: 0,
    totalClaims: 0,
    pendingClaims: 0,
    deniedClaims: 0,
    approvedClaims: 0,
    collectionRate: 0,
    avgDaysToPayment: 0,
  });

  useEffect(() => {
    if (insuranceGate.allowed) init();
    else setLoading(false);
  }, [insuranceGate.allowed]); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: claims }, { data: era }] = await Promise.all([
      supabase.from("insurance_claims").select("*").order("created_at", { ascending: false }),
      supabase.from("era_eob_records").select("*").eq("created_by", user.id).order("payment_date", { ascending: false }),
    ]);

    const claimsList = claims ?? [];
    const eraList = era ?? [];

    const totalBilled = eraList.reduce((a: any, b: any) => a + (b.total_billed ?? 0), 0);
    const totalPaid = eraList.reduce((a: any, b: any) => a + (b.total_paid ?? 0), 0);
    const totalAdjusted = eraList.reduce((a: any, b: any) => a + (b.total_adjusted ?? 0), 0);

    setSummary({
      totalBilled,
      totalPaid,
      totalAdjusted,
      totalClaims: claimsList.length,
      pendingClaims: claimsList.filter((c: any) => c.status === "pending" || c.status === "submitted").length,
      deniedClaims: claimsList.filter((c: any) => c.status === "denied").length,
      approvedClaims: claimsList.filter((c: any) => c.status === "approved" || c.status === "paid").length,
      collectionRate: totalBilled ? Math.round((totalPaid / totalBilled) * 100) : 0,
      avgDaysToPayment: 21,
    });

    const monthlyMap = new Map<string, { billed: number; paid: number }>();
    eraList.forEach((e: any) => {
      const month = e.payment_date?.slice(0, 7) ?? "";
      if (!month) return;
      const existing = monthlyMap.get(month) ?? { billed: 0, paid: 0 };
      monthlyMap.set(month, {
        billed: existing.billed + (e.total_billed ?? 0),
        paid: existing.paid + (e.total_paid ?? 0),
      });
    });
    setEraData(Array.from(monthlyMap.entries()).map(([month, data]) => ({ month, ...data })).sort((a, b) => a.month.localeCompare(b.month)).slice(-6));

    const statusMap = new Map<string, number>();
    claimsList.forEach((c: any) => statusMap.set(c.status, (statusMap.get(c.status) ?? 0) + 1));
    setClaimsData(Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })));

    setLoading(false);
  }

  // PLAN GATE
  if (!insuranceGate.allowed) {
    return (
      <div className="space-y-6">
        <PageHeader title="Revenue Cycle Management" />
        <UpgradePrompt
          reason={`Revenue Cycle Management requires the Professional plan or higher. You are on the ${planName} plan.`}
          upgradeTo={insuranceGate.upgradeTo}
          feature="Revenue Cycle Management"
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: "📊", title: "Revenue Trends", desc: "Monthly billed vs collected charts" },
            { icon: "💰", title: "Collection Rate", desc: "Track your overall collection rate" },
            { icon: "📋", title: "Claims Pipeline", desc: "Pending, approved, and denied claim counts" },
          ].map(item => (
            <div key={item.title} className="border border-gray-100 rounded-xl p-5 bg-white text-center">
              <div className="text-3xl mb-2">{item.icon}</div>
              <p className="font-semibold text-gray-800 text-sm">{item.title}</p>
              <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
          💡 Upgrade to <strong>Professional</strong> to unlock revenue cycle management and billing analytics.
          <Link href="/dashboard/settings/billing" className="ml-2 underline font-medium">View plans →</Link>
        </div>
      </div>
    );
  }

  if (loading) return <div className="p-8 text-gray-400">Loading RCM data...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Revenue Cycle Management">
        <p className="text-gray-500 text-sm">Financial overview of your billing pipeline.</p>
      </PageHeader>

      {/* KEY METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-xl p-4 bg-white">
          <p className="text-xs text-gray-500">Total Billed</p>
          <p className="text-2xl font-bold text-blue-600">${summary.totalBilled.toFixed(0)}</p>
        </div>
        <div className="border rounded-xl p-4 bg-white">
          <p className="text-xs text-gray-500">Total Collected</p>
          <p className="text-2xl font-bold text-green-600">${summary.totalPaid.toFixed(0)}</p>
        </div>
        <div className="border rounded-xl p-4 bg-white">
          <p className="text-xs text-gray-500">Collection Rate</p>
          <p className="text-2xl font-bold text-purple-600">{summary.collectionRate}%</p>
        </div>
        <div className="border rounded-xl p-4 bg-white">
          <p className="text-xs text-gray-500">Adjustments</p>
          <p className="text-2xl font-bold text-red-500">${summary.totalAdjusted.toFixed(0)}</p>
        </div>
      </div>

      {/* CLAIMS PIPELINE */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-xl p-4 bg-yellow-50 border-yellow-200 text-center">
          <p className="text-2xl font-bold text-yellow-600">{summary.pendingClaims}</p>
          <p className="text-xs text-yellow-600 mt-1">Pending / Submitted</p>
        </div>
        <div className="border rounded-xl p-4 bg-green-50 border-green-200 text-center">
          <p className="text-2xl font-bold text-green-600">{summary.approvedClaims}</p>
          <p className="text-xs text-green-600 mt-1">Approved / Paid</p>
        </div>
        <div className="border rounded-xl p-4 bg-red-50 border-red-200 text-center">
          <p className="text-2xl font-bold text-red-600">{summary.deniedClaims}</p>
          <p className="text-xs text-red-600 mt-1">Denied</p>
        </div>
      </div>

      {/* REVENUE TREND */}
      {eraData.length > 0 && (
        <Section title="Revenue Trend">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={eraData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v) => [`$${v}`, ""]} />
              <Line type="monotone" dataKey="billed" stroke="#2563eb" strokeWidth={2} name="Billed" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="paid" stroke="#16a34a" strokeWidth={2} name="Collected" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-400 mt-2 text-center">Blue = Billed · Green = Collected</p>
        </Section>
      )}

      {eraData.length === 0 && (
        <Section title="Revenue Trend">
          <div className="text-center py-8 text-gray-400 text-sm">
            No ERA/EOB data yet. Post ERA records to see revenue trends.
          </div>
        </Section>
      )}

      {/* CLAIMS BY STATUS */}
      {claimsData.length > 0 && (
        <Section title="Claims by Status">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={claimsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="status" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* QUICK ACTIONS */}
      <Section title="Quick Actions">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Post ERA/EOB", href: "/dashboard/billing/era-eob", icon: "💳" },
            { label: "Generate Superbill", href: "/dashboard/billing/superbills", icon: "📄" },
            { label: "Claims & Auth", href: "/dashboard/insurance", icon: "🏦" },
            { label: "AI Compliance Check", href: "/dashboard/insurance/ai-check", icon: "🤖" },
          ].map((action) => (
            <button key={action.label} onClick={() => window.location.href = action.href}
              className="border border-gray-100 rounded-xl p-4 bg-white hover:shadow-md transition-shadow text-left">
              <p className="text-2xl mb-2">{action.icon}</p>
              <p className="text-sm font-medium text-gray-700">{action.label}</p>
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}