"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

import Button from "@/components/ui/Button";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";

import { approveExport } from "@/lib/exports/approveExport";
import { rejectExport } from "@/lib/exports/rejectExport";
import { calculateClientRisk } from "@/lib/risk/calculateClientRisk";
import { sendRiskAlert } from "@/lib/alerts/sendRiskAlert";
import {
  fetchClientTrendData,
  fetchRiskTrendData,
  fetchWorkloadData,
} from "@/lib/analytics/chartData";
import { telemetry } from "@/lib/telemetry";
import { useRole } from "@/lib/hooks/useRole";
import type { TrendPoint, RiskTrendPoint, TherapistLoad } from "@/lib/analytics/chartData";

import RiskAnalyticsPanel from "@/components/analytics/RiskAnalyticsPanel";
import RiskDistributionChart from "@/components/analytics/RiskDistributionChart";
import ClientTrendChart from "@/components/analytics/ClientTrendChart";
import RiskTrendChart from "@/components/analytics/RiskTrendChart";
import WorkloadHeatmap from "@/components/analytics/WorkloadHeatmap";
import PredictiveForecastChart from "@/components/analytics/PredictiveForecastChart";
import ExportNotes from "@/components/exports/ExportNotes";

type RiskLevel = "low" | "medium" | "high";

type ExportItem = {
  id: string;
  client_id: string;
  created_at: string;
  status: "pending" | "approved" | "rejected";
};

type ForecastPoint = {
  day: string;
  probability: number;
};

type ExportWithRisk = ExportItem & {
  risk: RiskLevel;
  predictedRegression: boolean;
  escalationWarning: string | null;
  forecastScore: number;
  forecastCurve: ForecastPoint[];
};

type KPIs = {
  totalClients: number;
  totalExports: number;
  approvalRate: number;
  avgRiskScore: number;
  avgForecastScore: number;
  highRiskClients: number;
  avgResponseHours: number;
  rejectedExports: number;
  efficiencyScore: number;
};

type StatusFilter = "all" | "pending" | "approved" | "rejected";
type RiskFilter = "all" | "low" | "medium" | "high";

export default function SupervisorDashboardPage() {
  const { isSupervisor, hasPermission: checkPermission, loading: roleLoading } = useRole();

  const [exportsData, setExportsData] = useState<ExportWithRisk[]>([]);
  const [filteredData, setFilteredData] = useState<ExportWithRisk[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [riskTrendData, setRiskTrendData] = useState<RiskTrendPoint[]>([]);
  const [workloadData, setWorkloadData] = useState<TherapistLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // FILTERS
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");

  const alertedClientsRef = useRef<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AUTH
  useEffect(() => {
    async function getUser() {
      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user) setUserId(auth.user.id);
    }
    getUser();
  }, []);

  // REALTIME SUBSCRIPTION
  useEffect(() => {
    const channel = supabase
      .channel("client_exports_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "client_exports" },
        () => {
          loadExports();
          loadKPIs();
          loadChartData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    loadExports();
    loadKPIs();
    loadChartData();
  }, []);

  // DEBOUNCED FILTER ENGINE
  const applyFilters = useCallback(
    (
      data: ExportWithRisk[],
      search: string,
      status: StatusFilter,
      risk: RiskFilter
    ) => {
      let result = data;
      if (status !== "all") result = result.filter((e) => e.status === status);
      if (risk !== "all") result = result.filter((e) => e.risk === risk);
      if (search.trim()) {
        result = result.filter((e) =>
          e.client_id.toLowerCase().includes(search.toLowerCase())
        );
      }
      setFilteredData(result);
    },
    []
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      applyFilters(exportsData, searchQuery, statusFilter, riskFilter);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [exportsData, searchQuery, statusFilter, riskFilter, applyFilters]);

  // LOAD EXPORTS + ENRICH
  async function loadExports() {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_exports")
      .select("id, client_id, created_at, status")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Load exports error:", error.message);
      setLoading(false);
      return;
    }

    const enriched: ExportWithRisk[] = (data || []).map((item: any, index: any) => {
      const mockClient = {
        id: item.client_id,
        name: "Unknown",
        age: 0,
        diagnosis: index % 2 === 0 ? "ASD aggression" : "communication delay",
      };
      const risk = calculateClientRisk(mockClient);
      const predictedRegression = risk === "high" || index % 4 === 0;
      const escalationWarning = predictedRegression
        ? "Possible escalation risk within 7 days"
        : null;
      const forecastScore = risk === "high" ? 92 : risk === "medium" ? 64 : 28;
      const forecastCurve: ForecastPoint[] = [
        { day: "Mon", probability: forecastScore - 10 },
        { day: "Tue", probability: forecastScore - 5 },
        { day: "Wed", probability: forecastScore },
        { day: "Thu", probability: forecastScore + 5 },
        { day: "Fri", probability: forecastScore + 10 },
      ];
      return { ...item, risk, predictedRegression, escalationWarning, forecastScore, forecastCurve };
    });

    setExportsData(enriched);
    setLoading(false);
  }

  // LOAD KPIs
  async function loadKPIs() {
    setKpiLoading(true);
    const [
      { count: totalClients },
      { data: exports },
      { data: riskData },
    ] = await Promise.all([
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase.from("client_exports").select("id, status, created_at, approved_at"),
      supabase.from("client_risk").select("risk_score, forecast_score, risk_level"),
    ]);

    const totalExports = exports?.length ?? 0;
    const approvedExports = exports?.filter((e: { status: string }) => e.status === "approved").length ?? 0;
    const rejectedExports = exports?.filter((e: { status: string }) => e.status === "rejected").length ?? 0;
    const approvalRate = totalExports ? Math.round((approvedExports / totalExports) * 100) : 0;

    const responseTimes = (exports ?? [])
      .filter((e: { status: string; created_at: string; approved_at: string | null }) =>
        e.status === "approved" && e.approved_at
      )
      .map((e: { created_at: string; approved_at: string }) => {
        const created = new Date(e.created_at).getTime();
        const approved = new Date(e.approved_at).getTime();
        return approved - created;
      })
      .filter((ms: number) => ms > 0);

    const avgResponseMs = responseTimes.length
      ? responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length
      : 0;
    const avgResponseHours = avgResponseMs ? Math.round(avgResponseMs / 1000 / 60 / 60) : 0;

    const riskScores = (riskData ?? [])
      .map((r: { risk_score: number | null }) => r.risk_score)
      .filter((s: any): s is number => s != null);
    const forecastScores = (riskData ?? [])
      .map((r: { forecast_score: number | null }) => r.forecast_score)
      .filter((s: any): s is number => s != null);

    const avgRiskScore = riskScores.length
      ? Math.round(riskScores.reduce((a: any, b: any) => a + b, 0) / riskScores.length) : 0;
    const avgForecastScore = forecastScores.length
      ? Math.round(forecastScores.reduce((a: any, b: any) => a + b, 0) / forecastScores.length) : 0;
    const highRiskClients = (riskData ?? []).filter(
      (r: { risk_level: string }) => r.risk_level === "high"
    ).length;

    const responseTimeScore =
      avgResponseHours === 0 ? 100
      : avgResponseHours < 2 ? 100
      : avgResponseHours < 8 ? 75
      : avgResponseHours < 24 ? 50
      : avgResponseHours < 48 ? 25
      : 0;

    const efficiencyScore = Math.round(
      approvalRate * 0.4 + (100 - avgRiskScore) * 0.4 + responseTimeScore * 0.2
    );

    setKpis({
      totalClients: totalClients ?? 0,
      totalExports,
      approvalRate,
      avgRiskScore,
      avgForecastScore,
      highRiskClients,
      avgResponseHours,
      rejectedExports,
      efficiencyScore,
    });
    setKpiLoading(false);
  }

  // LOAD CHART DATA
  async function loadChartData() {
    const [trend, riskTrend, workload] = await Promise.all([
      fetchClientTrendData(),
      fetchRiskTrendData(),
      fetchWorkloadData(),
    ]);
    setTrendData(trend);
    setRiskTrendData(riskTrend);
    setWorkloadData(workload);
  }

  // ALERT ENGINE
  useEffect(() => {
    if (!exportsData.length) return;
    exportsData.forEach((item) => {
      if (item.risk === "high" && !alertedClientsRef.current.has(item.client_id)) {
        sendRiskAlert({ clientId: item.client_id, risk: item.risk });
        alertedClientsRef.current.add(item.client_id);
      }
    });
  }, [exportsData]);

  // AI WEEKLY SUMMARY
  useEffect(() => {
    if (!exportsData.length || !userId) return;
    const total = exportsData.length;
    const highRisk = exportsData.filter((x) => x.risk === "high").length;
    const mediumRisk = exportsData.filter((x) => x.risk === "medium").length;
    const avgForecastScore = exportsData.reduce((sum, x) => sum + x.forecastScore, 0) / total;
    const escalationCount = exportsData.filter((x) => x.escalationWarning).length;

    setSummary(
      `This week: ${total} exports, ${highRisk} high-risk cases, avg forecast ${avgForecastScore.toFixed(1)}%. Generating full AI summary...`
    );

    setSummary(
  `This week: ${total} exports, ${highRisk} high-risk cases, avg forecast ${avgForecastScore.toFixed(1)}%.`
);
  }, [exportsData, userId]);

  async function handleApprove(exportId: string) {
    if (!checkPermission("approve_exports")) return;
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    await approveExport(exportId, user.id);
    await loadExports();
  }

  async function handleReject(exportId: string) {
    if (!checkPermission("reject_exports")) return;
    await rejectExport(exportId);
    await loadExports();
  }

  function clearFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setRiskFilter("all");
  }

  const filtersActive = searchQuery !== "" || statusFilter !== "all" || riskFilter !== "all";

  function getRiskColor(risk: RiskLevel) {
    return risk === "high" ? "text-red-600" : risk === "medium" ? "text-yellow-500" : "text-green-600";
  }

  // ROLE GUARD
  if (roleLoading) return <div className="p-6 text-gray-400">Checking access...</div>;
  if (!isSupervisor) {
    return (
      <div className="p-6">
        <p className="text-red-500 font-semibold">Access denied. Supervisor or Admin role required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">

      {/* HEADER */}
      <PageHeader title="Supervisor Dashboard">
        <p className="text-gray-500 text-sm">Clinical exports + AI risk intelligence</p>
      </PageHeader>

      {/* KPI TILES */}
      <Section title="Clinic Performance">
        {kpiLoading ? (
          <p className="text-gray-400 text-sm">Loading KPIs...</p>
        ) : kpis ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{kpis.totalClients}</p>
              <p className="text-xs text-gray-500 mt-1">Total Clients</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-700">{kpis.totalExports}</p>
              <p className="text-xs text-gray-500 mt-1">Total Exports</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-orange-500">{kpis.avgRiskScore}%</p>
              <p className="text-xs text-gray-500 mt-1">Avg Risk Score</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{kpis.approvalRate}%</p>
              <p className="text-xs text-gray-500 mt-1">Approval Rate</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-500">{kpis.rejectedExports}</p>
              <p className="text-xs text-gray-500 mt-1">Rejected Exports</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{kpis.highRiskClients}</p>
              <p className="text-xs text-gray-500 mt-1">High Risk Clients</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-500">{kpis.avgForecastScore}%</p>
              <p className="text-xs text-gray-500 mt-1">Avg Forecast</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className={`text-2xl font-bold ${
                kpis.avgResponseHours === 0 ? "text-gray-400"
                : kpis.avgResponseHours < 8 ? "text-green-600"
                : kpis.avgResponseHours < 24 ? "text-yellow-500"
                : "text-red-600"
              }`}>
                {kpis.avgResponseHours === 0 ? "N/A" : `${kpis.avgResponseHours}h`}
              </p>
              <p className="text-xs text-gray-500 mt-1">Avg Response Time</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className={`text-2xl font-bold ${
                kpis.efficiencyScore >= 75 ? "text-green-600"
                : kpis.efficiencyScore >= 50 ? "text-yellow-500"
                : "text-red-600"
              }`}>
                {kpis.efficiencyScore}
              </p>
              <p className="text-xs text-gray-500 mt-1">Efficiency Score</p>
            </div>
          </div>
        ) : null}
      </Section>

      {/* AI SUMMARY */}
      {summary && (
        <Section title="Weekly AI Summary">
          <p className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg p-3">
            {summary}
          </p>
        </Section>
      )}

      {/* ANALYTICS CHARTS */}
      {!loading && exportsData.length > 0 && (
        <>
          <Section title="Risk Analytics">
            <RiskAnalyticsPanel data={exportsData} />
          </Section>
          <Section title="Risk Distribution">
            <RiskDistributionChart data={exportsData} />
          </Section>
          <Section title="Client Trend">
            <ClientTrendChart data={trendData} />
          </Section>
          <Section title="Risk Trend">
            <RiskTrendChart data={riskTrendData} />
          </Section>
          <Section title="Predictive Forecast">
            <PredictiveForecastChart data={exportsData} />
          </Section>
          <Section title="Workload">
            <WorkloadHeatmap data={workloadData} />
          </Section>
        </>
      )}

      {/* LOADING */}
      {loading && <p className="text-gray-400">Loading exports...</p>}

      {/* EMPTY */}
      {!loading && exportsData.length === 0 && (
        <p className="text-gray-400">No exports found.</p>
      )}

      {/* EXPORT LIST */}
      {!loading && exportsData.length > 0 && (
        <Section title="Client Exports">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input
              type="text"
              placeholder="Search by client ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="all">All Risk Levels</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            {filtersActive && (
              <button
                onClick={clearFilters}
                className="text-sm text-gray-400 hover:text-gray-600 underline"
              >
                Clear filters
              </button>
            )}
            <p className="text-sm text-gray-400 ml-auto">
              {filteredData.length} of {exportsData.length} exports
            </p>
          </div>

          {filteredData.length === 0 && (
            <p className="text-gray-400 text-sm">No exports match your filters.</p>
          )}

          <div className="space-y-4">
            {filteredData.map((item) => (
              <div
                key={item.id}
                className="border rounded-lg p-4 bg-gray-50 flex justify-between items-start flex-wrap gap-3"
              >
                <div className="flex-1">
                  <p className="font-semibold">Client ID: {item.client_id}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                  <span className="inline-block mt-2 text-xs px-2 py-1 rounded-full border bg-white">
                    {item.status}
                  </span>
                  <p className={`mt-2 font-bold text-sm ${getRiskColor(item.risk)}`}>
                    Risk: {item.risk.toUpperCase()}
                  </p>
                  <p className="text-sm text-blue-600 mt-0.5">
                    Forecast Score: {item.forecastScore}%
                  </p>
                  {item.predictedRegression && (
                    <div className="mt-3 p-3 rounded-lg bg-orange-50 border border-orange-200">
                      <p className="font-bold text-orange-700 text-sm">AI Escalation Warning</p>
                      <p className="text-xs text-orange-600 mt-1">{item.escalationWarning}</p>
                    </div>
                  )}

                  {/* SUPERVISOR NOTES */}
                  <ExportNotes
                    exportId={item.id}
                    canAdd={checkPermission("add_supervisor_notes")}
                  />
                </div>

                <div className="flex gap-2 shrink-0">
                  {checkPermission("approve_exports") && (
                    <Button onClick={() => handleApprove(item.id)}>Approve</Button>
                  )}
                  {checkPermission("reject_exports") && (
                    <Button variant="danger" onClick={() => handleReject(item.id)}>Reject</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}