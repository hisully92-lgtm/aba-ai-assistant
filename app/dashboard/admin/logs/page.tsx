"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { useRole } from "@/lib/hooks/useRole";

type LogType = "system" | "access" | "ai_usage" | "billing";
type ComplianceExportType = "access" | "ai_usage" | "billing" | "system";

type SystemLog = {
  id: string;
  user_id: string | null;
  type: string;
  event: string;
  metadata: any;
  created_at: string;
};

type AccessLog = {
  id: string;
  user_id: string | null;
  resource: string;
  action: string;
  record_id: string | null;
  ip: string | null;
  user_agent: string | null;
  metadata: any;
  created_at: string;
};

type AIUsageLog = {
  id: string;
  user_id: string | null;
  feature: string;
  duration_ms: number | null;
  success: boolean;
  error: string | null;
  created_at: string;
};

type BillingLog = {
  id: string;
  user_id: string | null;
  event: string;
  action: string | null;
  resource: string | null;
  metadata: any;
  ip: string | null;
  provider: string | null;
  created_at: string;
};

const TAB_LABELS: Record<LogType, string> = {
  system: "System",
  access: "PHI Access",
  ai_usage: "AI Usage",
  billing: "Billing",
};

export default function AdminLogsPage() {
  const { isAdmin, loading: roleLoading } = useRole();
  const [activeTab, setActiveTab] = useState<LogType>("system");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [aiLogs, setAILogs] = useState<AIUsageLog[]>([]);
  const [billingLogs, setBillingLogs] = useState<BillingLog[]>([]);

  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const [fromDate, setFromDate] = useState(thirtyDaysAgo);
  const [toDate, setToDate] = useState(today);

  useEffect(() => {
    if (!isAdmin) return;
    loadTab(activeTab);
  }, [activeTab, isAdmin]);

  async function loadTab(tab: LogType) {
    setLoading(true);

    if (tab === "system") {
      const { data } = await supabase
        .from("system_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setSystemLogs(data ?? []);
    }

    if (tab === "access") {
      const { data } = await supabase
        .from("access_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setAccessLogs(data ?? []);
    }

    if (tab === "ai_usage") {
      const { data } = await supabase
        .from("ai_usage_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setAILogs(data ?? []);
    }

    if (tab === "billing") {
      const { data } = await supabase
        .from("billing_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setBillingLogs(data ?? []);
    }

    setLoading(false);
  }

  async function handleExport(type: ComplianceExportType) {
    setExporting(true);
    try {
      const res = await fetch("/api/compliance/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          from: `${fromDate}T00:00:00.000Z`,
          to: `${toDate}T23:59:59.999Z`,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Export failed");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-logs-${fromDate}-to-${toDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed");
    } finally {
      setExporting(false);
    }
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
      <PageHeader title="Audit Log Dashboard">
        <p className="text-gray-500 text-sm">System-wide observability — admin only</p>
      </PageHeader>

      {/* COMPLIANCE EXPORT */}
      <Section title="Compliance Export">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["access", "ai_usage", "billing", "system"] as ComplianceExportType[]).map((type) => (
              <Button
                key={type}
                variant="outline"
                loading={exporting}
                onClick={() => handleExport(type)}
              >
                Export {type.replace("_", " ")} logs
              </Button>
            ))}
          </div>
        </div>
      </Section>

      {/* TABS */}
      <div className="flex gap-2 border-b border-gray-200">
        {(Object.keys(TAB_LABELS) as LogType[]).map((tab) => (
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

      {loading && <p className="text-gray-400 text-sm">Loading logs...</p>}

      {/* SYSTEM LOGS */}
      {!loading && activeTab === "system" && (
        <Section title={`System Logs (${systemLogs.length})`}>
          {systemLogs.length === 0 ? (
            <p className="text-gray-400 text-sm">No system logs found.</p>
          ) : (
            <div className="space-y-2">
              {systemLogs.map((log) => (
                <div key={log.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50 text-sm">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full mr-2 ${
                        log.type === "error" ? "bg-red-100 text-red-700"
                        : log.type === "ai" ? "bg-blue-100 text-blue-700"
                        : log.type === "billing" ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                      }`}>
                        {log.type}
                      </span>
                      <span className="font-medium text-gray-700">{log.event}</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                  {log.user_id && (
                    <p className="text-xs text-gray-400 mt-1">User: {log.user_id}</p>
                  )}
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <pre className="text-xs text-gray-500 mt-2 bg-white border border-gray-100 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ACCESS LOGS */}
      {!loading && activeTab === "access" && (
        <Section title={`PHI Access Logs (${accessLogs.length}) — HIPAA Audit Trail`}>
          {accessLogs.length === 0 ? (
            <p className="text-gray-400 text-sm">No access logs found.</p>
          ) : (
            <div className="space-y-2">
              {accessLogs.map((log) => (
                <div key={log.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50 text-sm">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <span className="font-medium text-gray-700">{log.resource}</span>
                      <span className="text-gray-400 mx-2">→</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        {log.action}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-gray-400">
                    {log.user_id && <span>User: {log.user_id}</span>}
                    {log.ip && <span>IP: {log.ip}</span>}
                    {log.record_id && <span>Record: {log.record_id}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* AI USAGE LOGS */}
      {!loading && activeTab === "ai_usage" && (
        <Section title={`AI Usage Logs (${aiLogs.length})`}>
          {aiLogs.length === 0 ? (
            <p className="text-gray-400 text-sm">No AI usage logs found.</p>
          ) : (
            <div className="space-y-2">
              {aiLogs.map((log) => (
                <div key={log.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50 text-sm">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        log.success ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>
                        {log.success ? "success" : "failed"}
                      </span>
                      <span className="font-medium text-gray-700">{log.feature}</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-gray-400">
                    {log.user_id && <span>User: {log.user_id}</span>}
                    {log.duration_ms != null && <span>{log.duration_ms}ms</span>}
                    {log.error && <span className="text-red-500">Error: {log.error}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* BILLING LOGS */}
      {!loading && activeTab === "billing" && (
        <Section title={`Billing Logs (${billingLogs.length})`}>
          {billingLogs.length === 0 ? (
            <p className="text-gray-400 text-sm">No billing logs found.</p>
          ) : (
            <div className="space-y-2">
              {billingLogs.map((log) => (
                <div key={log.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50 text-sm">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <span className="font-medium text-gray-700">{log.event}</span>
                      {log.action && (
                        <span className="text-xs text-gray-400 ml-2">({log.action})</span>
                      )}
                      {log.provider && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 ml-2">
                          {log.provider}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-gray-400">
                    {log.user_id && <span>User: {log.user_id}</span>}
                    {log.ip && <span>IP: {log.ip}</span>}
                    {log.resource && <span>Resource: {log.resource}</span>}
                  </div>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <pre className="text-xs text-gray-500 mt-2 bg-white border border-gray-100 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}