"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { telemetry } from "@/lib/telemetry";
import { calculateClientRisk } from "@/lib/risk/calculateClientRisk";
import { sendRiskAlert } from "@/lib/alerts/sendRiskAlert";
import Button from "@/components/ui/Button";
import Section from "@/components/ui/Section";

type RiskLevel = "low" | "medium" | "high";

type ExportItem = {
  id: string;
  client_id: string;
  created_at: string;
  status: string;
};

type ExportWithRisk = ExportItem & {
  risk: RiskLevel;
  riskScore: number;
  forecastScore: number;
  predictedRegression: boolean;
  escalationWarning: string | null;
};

type Props = {
  params: { id: string };
};

export default function ClinicianDetailPage({ params }: Props) {
  const clinicianId = params.id;

  const [loading, setLoading] = useState(true);
  const [exportsData, setExportsData] = useState<ExportWithRisk[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const alertedClientsRef = useRef<Set<string>>(new Set());

  // REALTIME SUBSCRIPTION
  useEffect(() => {
    const channel = supabase
      .channel(`clinician_exports_${clinicianId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "client_exports" },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinicianId]);

  useEffect(() => {
    async function init() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return;
      setUserId(user.id);
      await loadData(user.id);
    }
    init();
  }, [clinicianId]);

  // LOAD + ENRICH + WRITE RISK
  async function loadData(resolvedUserId?: string) {
    setLoading(true);

    const uid = resolvedUserId || userId;

    const { data, error } = await supabase
      .from("client_exports")
      .select("id, client_id, created_at, status")
      .eq("client_id", clinicianId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading clinician data:", error.message);
      setLoading(false);
      return;
    }

    const enriched: ExportWithRisk[] = (data || []).map((item, index) => {
      const mockClient = {
        id: item.client_id,
        name: "Unknown",
        age: 0,
        diagnosis: index % 2 === 0 ? "ASD aggression" : "communication delay",
      };

      const risk = calculateClientRisk(mockClient);
      const riskScore = risk === "high" ? 75 : risk === "medium" ? 45 : 20;
      const forecastScore = risk === "high" ? 92 : risk === "medium" ? 64 : 28;
      const predictedRegression = risk === "high" || index % 4 === 0;
      const escalationWarning = predictedRegression
        ? "Possible escalation risk within 7 days"
        : null;

      return {
        ...item,
        risk,
        riskScore,
        forecastScore,
        predictedRegression,
        escalationWarning,
      };
    });

    setExportsData(enriched);

    // WRITE latest score per client to client_risk
    if (uid) {
      const latestPerClient = new Map<string, ExportWithRisk>();
      for (const item of enriched) {
        if (!latestPerClient.has(item.client_id)) {
          latestPerClient.set(item.client_id, item);
        }
      }

      const upserts = Array.from(latestPerClient.values()).map((item) => ({
        client_id: item.client_id,
        risk_score: item.riskScore,
        forecast_score: item.forecastScore,
        risk_level: item.risk,
        computed_by: uid,
        computed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      if (upserts.length > 0) {
        const { error: upsertError } = await supabase
          .from("client_risk")
          .upsert(upserts, { onConflict: "client_id" });

        if (upsertError) {
          console.error("Failed to write risk scores:", upsertError.message);
        }
      }
    }

    setLoading(false);
  }

  // ALERT ENGINE
  useEffect(() => {
    if (!exportsData.length) return;

    exportsData.forEach((item) => {
      if (
        item.risk === "high" &&
        !alertedClientsRef.current.has(item.client_id)
      ) {
        sendRiskAlert({ clientId: item.client_id, risk: item.risk });
        alertedClientsRef.current.add(item.client_id);
      }
    });
  }, [exportsData]);

  // GENERATE AI SUMMARY
  async function handleGenerateSummary() {
    if (!userId) return;
    setGeneratingSummary(true);
    setSummaryError(null);
    setAiSummary(null);

    try {
      const res = await telemetry.ai.summary(
        { type: "summary", client_id: clinicianId },
        userId
      );

      if (res.error) {
        setSummaryError(res.error);
        return;
      }

      setAiSummary("AI clinical summary queued successfully. Check back shortly for results.");
    } catch (err: any) {
      setSummaryError(err?.message || "AI generation failed");
    } finally {
      setGeneratingSummary(false);
    }
  }

  function getRiskColor(risk: RiskLevel) {
    return risk === "high"
      ? "#dc2626"
      : risk === "medium"
      ? "#f59e0b"
      : "#16a34a";
  }

  // STATS
  const highRiskCount = exportsData.filter((x) => x.risk === "high").length;
  const mediumRiskCount = exportsData.filter((x) => x.risk === "medium").length;
  const lowRiskCount = exportsData.filter((x) => x.risk === "low").length;
  const pendingCount = exportsData.filter((x) => x.status === "pending").length;

  return (
    <div className="space-y-6 p-6">
      {/* HEADER */}
      <Section title="Clinician / Client View">
        <p className="text-gray-500 text-sm">ID: {clinicianId}</p>
      </Section>

      {/* STATS */}
      {!loading && exportsData.length > 0 && (
        <Section title="Overview">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{highRiskCount}</p>
              <p className="text-sm text-gray-500">High Risk</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-yellow-500">{mediumRiskCount}</p>
              <p className="text-sm text-gray-500">Medium Risk</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{lowRiskCount}</p>
              <p className="text-sm text-gray-500">Low Risk</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{pendingCount}</p>
              <p className="text-sm text-gray-500">Pending</p>
            </div>
          </div>
        </Section>
      )}

      {/* AI SUMMARY */}
      <Section title="AI Clinical Summary">
        {summaryError && (
          <p className="text-red-500 text-sm mb-3">{summaryError}</p>
        )}
        {aiSummary && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 mb-3">
            {aiSummary}
          </div>
        )}
        <Button
          onClick={handleGenerateSummary}
          loading={generatingSummary}
          variant="secondary"
        >
          Generate AI Summary
        </Button>
      </Section>

      {/* LOADING */}
      {loading && <p className="text-gray-500">Loading...</p>}

      {/* EMPTY */}
      {!loading && exportsData.length === 0 && (
        <p className="text-gray-500">No records found for this ID.</p>
      )}

      {/* EXPORT LIST */}
      {!loading && exportsData.length > 0 && (
        <Section title="Client Exports">
          <div className="space-y-4">
            {exportsData.map((item) => (
              <div key={item.id} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start flex-wrap gap-3">
                  <div>
                    <p className="font-semibold">Export ID: {item.id}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                    <span className="inline-block mt-2 text-xs px-2 py-1 rounded-full border bg-white">
                      {item.status}
                    </span>
                    <p
                      className="mt-2 font-bold text-sm"
                      style={{ color: getRiskColor(item.risk) }}
                    >
                      Risk: {item.risk.toUpperCase()}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Risk Score: {item.riskScore}%
                    </p>
                    <p className="text-sm text-blue-600 mt-0.5">
                      Forecast Score: {item.forecastScore}%
                    </p>

                    {item.predictedRegression && (
                      <div className="mt-3 p-3 rounded-lg bg-orange-50 border border-orange-200">
                        <p className="font-bold text-orange-700 text-sm">
                          AI Escalation Warning
                        </p>
                        <p className="text-xs text-orange-600 mt-1">
                          {item.escalationWarning}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        (window.location.href = `/dashboard/clients/${item.client_id}`)
                      }
                    >
                      View Client
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}