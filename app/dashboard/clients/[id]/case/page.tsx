"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { telemetry } from "@/lib/telemetry";
import Button from "@/components/ui/Button";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";

type RiskLevel = "high" | "medium" | "low" | "unknown";

type ClientRisk = {
  risk_score: number | null;
  forecast_score: number | null;
  risk_level: RiskLevel;
  updated_at: string | null;
};

type Session = {
  id: string;
  created_at: string;
  status: string;
  notes?: string;
};

function riskBadge(level: RiskLevel) {
  const map: Record<RiskLevel, { label: string; className: string }> = {
    high:    { label: "High Risk",   className: "bg-red-100 text-red-700 border border-red-300" },
    medium:  { label: "Medium Risk", className: "bg-yellow-100 text-yellow-700 border border-yellow-300" },
    low:     { label: "Low Risk",    className: "bg-green-100 text-green-700 border border-green-300" },
    unknown: { label: "Unknown",     className: "bg-gray-100 text-gray-500 border border-gray-200" },
  };
  const { label, className } = map[level];
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${className}`}>
      {label}
    </span>
  );
}

function scoreBar(score: number | null, color: string) {
  const pct = score != null ? Math.min(100, Math.max(0, score)) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
      <div
        className={`h-2 rounded-full ${color}`}
        style={{ width: `${pct}%`, transition: "width 0.4s ease" }}
      />
    </div>
  );
}

export default function CaseDrilldownPage({
  params,
}: {
  params: { id: string };
}) {
  const clientId = params.id;

  const [client, setClient] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [risk, setRisk] = useState<ClientRisk | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [openAlerts, setOpenAlerts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    async function init() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return;
      setUserId(user.id);

      await Promise.all([
        loadClient(),
        loadRisk(),
        loadSessions(),
        loadAlerts(),
      ]);

      setLoading(false);
    }
    init();

    // Real-time: refresh risk when clinician dashboard writes new scores
    subscriptionRef.current = supabase
      .channel(`case-risk-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_risk",
          filter: `client_id=eq.${clientId}`,
        },
        () => loadRisk()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_exports",
          filter: `client_id=eq.${clientId}`,
        },
        () => loadAlerts()
      )
      .subscribe();

    return () => {
      subscriptionRef.current?.unsubscribe();
    };
  }, [clientId]);

  async function loadClient() {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();
    setClient(data);
  }

  async function loadRisk() {
    const { data } = await supabase
      .from("client_risk")
      .select("risk_score, forecast_score, risk_level, updated_at")
      .eq("client_id", clientId)
      .single();

    setRisk(
      data
        ? {
            risk_score: data.risk_score,
            forecast_score: data.forecast_score,
            risk_level: (data.risk_level as RiskLevel) ?? "unknown",
            updated_at: data.updated_at,
          }
        : {
            risk_score: null,
            forecast_score: null,
            risk_level: "unknown",
            updated_at: null,
          }
    );
  }

  async function loadSessions() {
    const { data } = await supabase
      .from("sessions")
      .select("id, created_at, status, notes")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(5);
    setSessions(data ?? []);
  }

  async function loadAlerts() {
    const { count } = await supabase
      .from("client_exports")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("status", "pending");
    setOpenAlerts(count ?? 0);
  }

  async function handleGenerateSummary() {
    if (!userId) return;
    setGenerating(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await telemetry.ai.summary(
        { type: "summary", client_id: clientId },
        userId
      );
      if (res.error) {
        setActionError(res.error);
        return;
      }
      setActionSuccess("AI summary queued. Updates will appear automatically.");
    } catch (err: any) {
      setActionError(err?.message || "AI generation failed");
    } finally {
      setGenerating(false);
    }
  }

  function navigate(path: string) {
    window.location.href = path;
  }

  if (loading) return <div className="p-6 text-gray-500">Loading case...</div>;
  if (!client)  return <div className="p-6 text-red-500">Client not found.</div>;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <PageHeader title={`Case: ${client.full_name}`}>
        {riskBadge(risk?.risk_level ?? "unknown")}
      </PageHeader>

      {/* CLIENT OVERVIEW */}
      <Section title="Client Overview">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
          {client.date_of_birth && (
            <p>
              <span className="font-medium">DOB:</span>{" "}
              {new Date(client.date_of_birth).toLocaleDateString()}
            </p>
          )}
          {client.guardian_name && (
            <p>
              <span className="font-medium">Guardian:</span> {client.guardian_name}
            </p>
          )}
          {risk?.updated_at && (
            <p>
              <span className="font-medium">Risk Updated:</span>{" "}
              {new Date(risk.updated_at).toLocaleDateString()}
            </p>
          )}
          <p>
            <span className="font-medium">Open Alerts:</span>{" "}
            <span className={openAlerts > 0 ? "text-red-600 font-semibold" : ""}>
              {openAlerts}
            </span>
          </p>
        </div>
      </Section>

      {/* RISK INTELLIGENCE */}
      <Section title="Risk Intelligence">
        {risk?.risk_level === "unknown" ? (
          <p className="text-sm text-gray-400">
            No risk data yet. Visit the{" "}
            <button
              className="text-blue-500 underline"
              onClick={() => navigate(`/dashboard/clinician/${clientId}`)}
            >
              clinician view
            </button>{" "}
            to compute scores.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Current Risk Score</span>
                <span className="font-semibold">
                  {risk?.risk_score != null ? `${risk.risk_score}%` : "N/A"}
                </span>
              </div>
              {scoreBar(risk?.risk_score ?? null, "bg-red-400")}
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Forecast Score</span>
                <span className="font-semibold">
                  {risk?.forecast_score != null ? `${risk.forecast_score}%` : "N/A"}
                </span>
              </div>
              {scoreBar(risk?.forecast_score ?? null, "bg-orange-400")}
            </div>
          </div>
        )}
      </Section>

      {/* AI SUMMARY */}
      <Section title="AI Clinical Summary">
        {actionError && (
          <p className="text-red-500 text-sm mb-3">{actionError}</p>
        )}
        {actionSuccess && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 mb-3">
            {actionSuccess}
          </div>
        )}
        <Button
          onClick={handleGenerateSummary}
          loading={generating}
          variant="secondary"
        >
          Generate AI Summary
        </Button>
      </Section>

      {/* RECENT SESSIONS */}
      {sessions.length > 0 && (
        <Section title="Recent Sessions">
          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 border border-gray-100 rounded-lg bg-gray-50 text-sm"
              >
                <div>
                  <p className="font-medium text-gray-700">
                    {new Date(s.created_at).toLocaleDateString()}
                  </p>
                  {s.notes && (
                    <p className="text-gray-400 text-xs mt-0.5 line-clamp-1">
                      {s.notes}
                    </p>
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                    s.status === "completed"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : s.status === "pending"
                      ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                      : "bg-gray-100 text-gray-500 border-gray-200"
                  }`}
                >
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

     {/* ACTIONS */}
<Section title="Actions">
  <div className="flex flex-wrap gap-3">
    <Button variant="outline" onClick={() => navigate(`/dashboard/clients/${clientId}/timeline`)}>
      View Timeline
    </Button>
    <Button variant="outline" onClick={() => navigate(`/dashboard/clients/${clientId}/report`)}>
      Export Report
    </Button>
    <Button variant="outline" onClick={() => navigate(`/dashboard/clients/${clientId}/exports`)}>
      Export History
    </Button>
    <Button variant="outline" onClick={() => navigate(`/dashboard/sessions?client_id=${clientId}`)}>
      View Sessions
    </Button>
    <Button variant="outline" onClick={() => navigate(`/dashboard/clinician/${clientId}`)}>
      Clinician View
    </Button>
  </div>
</Section>
    </div>
  );
}