"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import { useRole } from "@/lib/hooks/useRole";

type BillingSession = {
  id: string;
  client_id: string;
  session_date: string;
  duration_minutes: number;
  cpt_code: string;
  billable_units: number;
  rate_per_unit: number;
  total_amount: number;
  status: string;
  created_at: string;
};

type Invoice = {
  id: string;
  client_id: string;
  invoice_number: string;
  total_amount: number;
  status: string;
  created_at: string;
};

type UsageLog = {
  id: string;
  user_id: string;
  feature: string;
  count: number;
  created_at: string;
};

type ChurnRisk = {
  userId: string;
  riskLevel: "high" | "medium";
  lastActive: string | null;
  daysSinceActive: number;
  aiRequestsLast30Days: number;
  reason: string;
};

type BillingStats = {
  totalRevenue: number;
  pendingRevenue: number;
  paidRevenue: number;
  totalInvoices: number;
  totalSessions: number;
  avgSessionValue: number;
};

type TabType = "overview" | "sessions" | "invoices" | "usage" | "churn";

const TAB_LABELS: Record<TabType, string> = {
  overview: "Overview",
  sessions: "Billing Sessions",
  invoices: "Invoices",
  usage: "Feature Usage",
  churn: "Churn Risk",
};

export default function AdminBillingPage() {
  const { isAdmin, loading: roleLoading } = useRole();
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState<BillingStats | null>(null);
  const [sessions, setSessions] = useState<BillingSession[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [churnRisks, setChurnRisks] = useState<ChurnRisk[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    loadAll();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    loadTab(activeTab);
  }, [activeTab, isAdmin]);

  async function loadAll() {
    const [{ data: sessionData }, { data: invoiceData }] = await Promise.all([
      supabase.from("billing_sessions").select("total_amount, status"),
      supabase.from("invoices").select("total_amount, status"),
    ]);

    const totalRevenue = (invoiceData ?? []).reduce(
      (sum: number, i: { total_amount: number }) => sum + (i.total_amount ?? 0), 0
    );
    const paidRevenue = (invoiceData ?? [])
      .filter((i: { status: string }) => i.status === "paid")
      .reduce((sum: number, i: { total_amount: number }) => sum + (i.total_amount ?? 0), 0);
    const pendingRevenue = totalRevenue - paidRevenue;

    const totalSessions = sessionData?.length ?? 0;
    const avgSessionValue = totalSessions
      ? (sessionData ?? []).reduce(
          (sum: number, s: { total_amount: number }) => sum + (s.total_amount ?? 0), 0
        ) / totalSessions
      : 0;

    setStats({
      totalRevenue,
      pendingRevenue,
      paidRevenue,
      totalInvoices: invoiceData?.length ?? 0,
      totalSessions,
      avgSessionValue,
    });
  }

  async function loadTab(tab: TabType) {
    setLoading(true);

    if (tab === "sessions") {
      const { data } = await supabase
        .from("billing_sessions")
        .select("*")
        .order("session_date", { ascending: false })
        .limit(100);
      setSessions(data ?? []);
    }

    if (tab === "invoices") {
      const { data } = await supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setInvoices(data ?? []);
    }

    if (tab === "usage") {
      const { data } = await supabase
        .from("usage_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setUsageLogs(data ?? []);
    }

    if (tab === "churn") {
      const res = await fetch("/api/churn", {
        headers: { "x-worker-secret": process.env.NEXT_PUBLIC_WORKER_SECRET ?? "" },
      });
      if (res.ok) {
        const data = await res.json();
        setChurnRisks(data.risks ?? []);
      }
    }

    setLoading(false);
  }

  function statusColor(status: string) {
    if (status === "paid" || status === "complete") return "bg-green-100 text-green-700";
    if (status === "pending") return "bg-yellow-100 text-yellow-700";
    if (status === "cancelled" || status === "failed") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-600";
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  }

  if (roleLoading) return <div className="p-6 text-gray-400">Checking access...</div>;

  if (!isAdmin) {
    return (
      <div className="p-6">
        <p className="text-red-500 font-semibold">Access denied. Admin role required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Billing Dashboard">
        <p className="text-gray-500 text-sm">Revenue tracking and billing overview — admin only</p>
      </PageHeader>

      {/* KPI TILES */}
      {stats && (
        <Section title="Revenue Overview">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</p>
              <p className="text-xs text-gray-500 mt-1">Total Revenue</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(stats.paidRevenue)}</p>
              <p className="text-xs text-gray-500 mt-1">Paid</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-yellow-500">{formatCurrency(stats.pendingRevenue)}</p>
              <p className="text-xs text-gray-500 mt-1">Pending</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-700">{stats.totalInvoices}</p>
              <p className="text-xs text-gray-500 mt-1">Total Invoices</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-700">{stats.totalSessions}</p>
              <p className="text-xs text-gray-500 mt-1">Billing Sessions</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(stats.avgSessionValue)}</p>
              <p className="text-xs text-gray-500 mt-1">Avg Session Value</p>
            </div>
          </div>
        </Section>
      )}

      {/* TABS */}
      <div className="flex gap-2 border-b border-gray-200">
        {(Object.keys(TAB_LABELS) as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}

      {/* BILLING SESSIONS */}
      {!loading && activeTab === "sessions" && (
        <Section title={`Billing Sessions (${sessions.length})`}>
          {sessions.length === 0 ? (
            <p className="text-gray-400 text-sm">No billing sessions found.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div key={s.id} className="border border-gray-100 rounded-lg p-4 bg-white">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <p className="font-medium text-gray-800">
                        CPT: {s.cpt_code} — {s.duration_minutes} min
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(s.session_date).toLocaleDateString()}
                      </p>
                      <div className="flex gap-4 mt-2 text-sm text-gray-600">
                        <span>{s.billable_units} units @ {formatCurrency(s.rate_per_unit)}</span>
                        <span className="font-semibold text-gray-800">
                          = {formatCurrency(s.total_amount)}
                        </span>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor(s.status)}`}>
                      {s.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* INVOICES */}
      {!loading && activeTab === "invoices" && (
        <Section title={`Invoices (${invoices.length})`}>
          {invoices.length === 0 ? (
            <p className="text-gray-400 text-sm">No invoices found.</p>
          ) : (
            <div className="space-y-2">
              {invoices.map((inv) => (
                <div key={inv.id} className="border border-gray-100 rounded-lg p-4 bg-white flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-800">#{inv.invoice_number}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(inv.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-sm font-semibold text-gray-700 mt-1">
                      {formatCurrency(inv.total_amount)}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor(inv.status)}`}>
                    {inv.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* FEATURE USAGE */}
      {!loading && activeTab === "usage" && (
        <Section title={`Feature Usage (${usageLogs.length})`}>
          {usageLogs.length === 0 ? (
            <p className="text-gray-400 text-sm">No usage logs found.</p>
          ) : (
            <div className="space-y-2">
              {usageLogs.map((log) => (
                <div key={log.id} className="border border-gray-100 rounded-lg p-3 bg-white flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{log.feature}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      User: {log.user_id} — {new Date(log.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-blue-600">{log.count}x</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* CHURN RISK */}
      {!loading && activeTab === "churn" && (
        <Section title={`Churn Risk Users (${churnRisks.length})`}>
          {churnRisks.length === 0 ? (
            <p className="text-gray-400 text-sm">No churn risks detected.</p>
          ) : (
            <div className="space-y-2">
              {churnRisks.map((risk) => (
                <div
                  key={risk.userId}
                  className="border border-gray-100 rounded-lg p-3 bg-white flex justify-between items-center"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{risk.userId}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{risk.reason}</p>
                    <p className="text-xs text-gray-400">
                      Last active: {risk.lastActive ? new Date(risk.lastActive).toLocaleDateString() : "Never"}
                      {" · "}{risk.aiRequestsLast30Days} AI requests (30d)
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    risk.riskLevel === "high"
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {risk.riskLevel} risk
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}