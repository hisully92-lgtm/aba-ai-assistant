"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

import Button from "@/components/ui/Button";

import { approveExport } from "@/lib/exports/approveExport";
import { rejectExport } from "@/lib/exports/rejectExport";

import { calculateClientRisk } from "@/lib/risk/calculateClientRisk";
import { sendRiskAlert } from "@/lib/alerts/sendRiskAlert";

// 📊 Analytics
import RiskAnalyticsPanel from "@/components/analytics/RiskAnalyticsPanel";
import RiskDistributionChart from "@/components/analytics/RiskDistributionChart";
import ClientTrendChart from "@/components/analytics/ClientTrendChart";
import RiskTrendChart from "@/components/analytics/RiskTrendChart";
import WorkloadHeatmap from "@/components/analytics/WorkloadHeatmap";
import PredictiveForecastChart from "@/components/analytics/PredictiveForecastChart";

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

export default function SupervisorDashboardPage() {
  const [exportsData, setExportsData] = useState<ExportWithRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);

  const alertedClientsRef = useRef<Set<string>>(new Set());

  // 📈 STATIC DATA
  const trendData = [
    { week: "Week 1", score: 40 },
    { week: "Week 2", score: 52 },
    { week: "Week 3", score: 61 },
    { week: "Week 4", score: 70 },
    { week: "Week 5", score: 78 },
  ];

  const riskTrendData = [
    { date: "Mon", score: 72 },
    { date: "Tue", score: 68 },
    { date: "Wed", score: 75 },
    { date: "Thu", score: 61 },
    { date: "Fri", score: 58 },
    { date: "Sat", score: 49 },
    { date: "Sun", score: 52 },
  ];

  const workloadData = [
    { therapist: "Sarah", clients: 5 },
    { therapist: "James", clients: 9 },
    { therapist: "Emily", clients: 14 },
  ];

  // 🔌 REALTIME SUPABASE SUBSCRIPTION
  useEffect(() => {
    const channel = supabase
      .channel("client_exports_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "client_exports" },
        () => loadExports()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    loadExports();
  }, []);

  // 🧠 LOAD + ENRICH DATA
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

    const enriched: ExportWithRisk[] = (data || []).map((item, index) => {
      const mockClient = {
        id: item.client_id,
        name: "Unknown",
        age: 0,
        diagnosis:
          index % 2 === 0
            ? "ASD aggression"
            : "communication delay",
      };

      const risk = calculateClientRisk(mockClient);

      const predictedRegression = risk === "high" || index % 4 === 0;

      const escalationWarning = predictedRegression
        ? "Possible escalation risk within 7 days"
        : null;

      const forecastScore =
        risk === "high" ? 92 : risk === "medium" ? 64 : 28;

      const forecastCurve: ForecastPoint[] = [
        { day: "Mon", probability: forecastScore - 10 },
        { day: "Tue", probability: forecastScore - 5 },
        { day: "Wed", probability: forecastScore },
        { day: "Thu", probability: forecastScore + 5 },
        { day: "Fri", probability: forecastScore + 10 },
      ];

      return {
        ...item,
        risk,
        predictedRegression,
        escalationWarning,
        forecastScore,
        forecastCurve,
      };
    });

    setExportsData(enriched);
    setLoading(false);
  }

  // 🚨 ALERT ENGINE
  useEffect(() => {
    if (!exportsData.length) return;

    exportsData.forEach((item) => {
      if (
        item.risk === "high" &&
        !alertedClientsRef.current.has(item.client_id)
      ) {
        sendRiskAlert({
          clientId: item.client_id,
          risk: item.risk,
        });

        alertedClientsRef.current.add(item.client_id);
      }
    });
  }, [exportsData]);

  // 🧠 SIMPLE AI SUMMARY (STEP 5 LIGHT VERSION)
  useEffect(() => {
    if (!exportsData.length) return;

    const highRiskCount = exportsData.filter(
      (x) => x.risk === "high"
    ).length;

    setSummary(
      `This week includes ${highRiskCount} high-risk cases requiring attention. System status remains under monitoring.`
    );
  }, [exportsData]);

  async function handleApprove(exportId: string) {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    await approveExport(exportId, user.id);
    await loadExports();
  }

  async function handleReject(exportId: string) {
    await rejectExport(exportId);
    await loadExports();
  }

  function getRiskColor(risk: RiskLevel) {
    return risk === "high"
      ? "#dc2626"
      : risk === "medium"
      ? "#f59e0b"
      : "#16a34a";
  }

  return (
    <div style={{ padding: 20 }}>

      {/* HEADER */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>
          Supervisor Dashboard
        </h1>
        <p style={{ color: "#666" }}>
          Clinical exports + AI risk intelligence
        </p>
      </div>

      {/* 🧠 AI SUMMARY */}
      {summary && (
        <div
          style={{
            marginBottom: 20,
            padding: 12,
            background: "#f0f9ff",
            border: "1px solid #bae6fd",
            borderRadius: 10,
          }}
        >
          <strong>🧠 Weekly AI Summary</strong>
          <p>{summary}</p>
        </div>
      )}

      {/* 📊 ANALYTICS */}
      {!loading && exportsData.length > 0 && (
        <>
          <RiskAnalyticsPanel data={exportsData} />

          <div style={{ marginTop: 24 }}>
            <RiskDistributionChart data={exportsData} />
          </div>

          <div style={{ marginTop: 24 }}>
            <ClientTrendChart data={trendData} />
          </div>

          <div style={{ marginTop: 24 }}>
            <RiskTrendChart data={riskTrendData} />
          </div>

          <div style={{ marginTop: 24 }}>
            <PredictiveForecastChart data={exportsData} />
          </div>

          <div style={{ marginTop: 24 }}>
            <WorkloadHeatmap data={workloadData} />
          </div>
        </>
      )}

      {/* LOADING */}
      {loading && (
        <p style={{ color: "#666" }}>Loading exports...</p>
      )}

      {/* EMPTY */}
      {!loading && exportsData.length === 0 && (
        <p style={{ color: "#666" }}>No exports found.</p>
      )}

      {/* LIST */}
      {!loading && exportsData.length > 0 && (
        <div style={{ display: "grid", gap: 16, marginTop: 20 }}>
          {exportsData.map((item) => (
            <div
              key={item.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 12,
                padding: 16,
                background: "#fafafa",
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <p style={{ fontWeight: 600 }}>
                  Client ID: {item.client_id}
                </p>

                <p style={{ fontSize: 12, color: "#666" }}>
                  Created {new Date(item.created_at).toLocaleString()}
                </p>

                <span
                  style={{
                    display: "inline-block",
                    marginTop: 6,
                    fontSize: 12,
                    padding: "4px 8px",
                    borderRadius: 999,
                    border: "1px solid #ddd",
                    background: "white",
                  }}
                >
                  {item.status}
                </span>

                <p
                  style={{
                    marginTop: 8,
                    fontWeight: 700,
                    color: getRiskColor(item.risk),
                  }}
                >
                  Risk: {item.risk.toUpperCase()}
                </p>

                <p style={{ marginTop: 6, color: "#2563eb" }}>
                  Forecast Score: {item.forecastScore}%
                </p>

                {item.predictedRegression && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 10,
                      borderRadius: 8,
                      background: "#fff7ed",
                      border: "1px solid #fdba74",
                    }}
                  >
                    <p style={{ fontWeight: 700, color: "#c2410c" }}>
                      AI Escalation Warning
                    </p>
                    <p style={{ fontSize: 13, color: "#7c2d12" }}>
                      {item.escalationWarning}
                    </p>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <Button onClick={() => handleApprove(item.id)}>
                  Approve
                </Button>

                <Button
                  variant="danger"
                  onClick={() => handleReject(item.id)}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}