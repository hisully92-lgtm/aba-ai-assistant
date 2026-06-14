"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";

type Client = { id: string; full_name: string };
type BehaviorTrend = {
  behavior_name: string;
  severity_label: string | null;
  severity_color: string | null;
  date: string;
  frequency: number;
};
type BehaviorSummary = {
  behavior_name: string;
  total: number;
  sessions: number;
  avg_per_session: number;
  color: string;
};

export default function BehaviorAnalyticsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState<BehaviorTrend[]>([]);
  const [summaries, setSummaries] = useState<BehaviorSummary[]>([]);
  const [dateRange, setDateRange] = useState("30");
  const [companyId, setCompanyId] = useState("");

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedClient) loadData(); }, [selectedClient, dateRange]); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const { data: companyUser } = await supabase
      .from("company_users").select("company_id")
      .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
    setCompanyId(companyUser?.company_id ?? "");
    const { data } = await supabase.from("clients").select("id, full_name")
      .eq("company_id", companyUser?.company_id).order("full_name");
    setClients(data ?? []);
  }

  async function loadData() {
    setLoading(true);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(dateRange));

    const { data } = await supabase
      .from("behavior_data")
      .select(`
        frequency,
        severity_label,
        severity_level_id,
        recorded_at,
        custom_behaviors(name),
        behavior_severity_levels(color)
      `)
      .eq("client_id", selectedClient)
      .gte("recorded_at", startDate.toISOString())
      .order("recorded_at");

    if (!data) { setLoading(false); return; }

    // Build trends
    const trendMap: Record<string, BehaviorTrend> = {};
    data.forEach((d: any) => {
      const date = new Date(d.recorded_at).toISOString().split("T")[0];
      const key = `${d.custom_behaviors?.name}-${d.severity_label ?? "none"}-${date}`;
      if (trendMap[key]) {
        trendMap[key].frequency += d.frequency;
      } else {
        trendMap[key] = {
          behavior_name: d.custom_behaviors?.name ?? "Unknown",
          severity_label: d.severity_label,
          severity_color: d.behavior_severity_levels?.color ?? "#dc2626",
          date,
          frequency: d.frequency,
        };
      }
    });
    setTrends(Object.values(trendMap));

    // Build summaries
    const summaryMap: Record<string, BehaviorSummary> = {};
    const sessionDates = new Set<string>();
    data.forEach((d: any) => {
      const date = new Date(d.recorded_at).toISOString().split("T")[0];
      sessionDates.add(date);
      const name = d.custom_behaviors?.name ?? "Unknown";
      if (summaryMap[name]) {
        summaryMap[name].total += d.frequency;
      } else {
        summaryMap[name] = {
          behavior_name: name,
          total: d.frequency,
          sessions: 0,
          avg_per_session: 0,
          color: d.behavior_severity_levels?.color ?? "#dc2626",
        };
      }
    });
    const totalSessions = sessionDates.size || 1;
    Object.values(summaryMap).forEach(s => {
      s.avg_per_session = Math.round((s.total / totalSessions) * 10) / 10;
    });
    setSummaries(Object.values(summaryMap).sort((a, b) => b.total - a.total));
    setLoading(false);
  }

  // Get unique dates for chart
  const dates = [...new Set(trends.map(t => t.date))].sort();
  const behaviors = [...new Set(trends.map(t => t.behavior_name))];
  const maxFreq = Math.max(...trends.map(t => t.frequency), 1);

  return (
    <div className="space-y-6">
      <PageHeader title="Behavior Analytics" />

      <div className="flex gap-3 flex-wrap items-center">
        <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">Select client...</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
        <select value={dateRange} onChange={e => setDateRange(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="60">Last 60 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      {!selectedClient && (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
          <p className="text-4xl mb-3">🧠</p>
          <p className="text-gray-600 font-medium">Select a client to view behavior analytics</p>
        </div>
      )}

      {selectedClient && loading && (
        <div className="text-center py-16">
          <div className="animate-spin text-4xl">⏳</div>
          <p className="text-gray-400 mt-3">Loading behavior data...</p>
        </div>
      )}

      {selectedClient && !loading && trends.length === 0 && (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-gray-600 font-medium">No behavior data recorded yet</p>
          <p className="text-gray-400 text-sm mt-1">Start recording behaviors during sessions to see trends here.</p>
        </div>
      )}

      {selectedClient && !loading && trends.length > 0 && (
        <>
          {/* SUMMARY CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {summaries.slice(0, 4).map(s => (
              <div key={s.behavior_name} className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="w-3 h-3 rounded-full mb-2" style={{ backgroundColor: s.color }} />
                <p className="text-xs text-gray-500 truncate">{s.behavior_name}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{s.total}</p>
                <p className="text-xs text-gray-400">total incidents</p>
                <p className="text-xs text-gray-500 mt-1">{s.avg_per_session}/session avg</p>
              </div>
            ))}
          </div>

          {/* FREQUENCY CHART */}
          <Section title="Frequency Over Time">
            <div className="overflow-x-auto">
              <div style={{ minWidth: Math.max(dates.length * 40, 400) }}>
                {behaviors.map(behavior => {
                  const behaviorColor = trends.find(t => t.behavior_name === behavior)?.severity_color ?? "#dc2626";
                  const dataPoints = dates.map(date => {
                    const entry = trends.find(t => t.behavior_name === behavior && t.date === date);
                    return entry?.frequency ?? 0;
                  });
                  return (
                    <div key={behavior} className="mb-6">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: behaviorColor }} />
                        <p className="text-sm font-medium text-gray-700">{behavior}</p>
                      </div>
                      <div className="flex items-end gap-1" style={{ height: 100 }}>
                        {dataPoints.map((freq, i) => (
                          <div key={i} className="flex flex-col items-center gap-1 flex-1">
                            <div
                              className="w-full rounded-t-sm transition-all"
                              style={{
                                height: freq > 0 ? Math.max((freq / maxFreq) * 80, 4) : 2,
                                backgroundColor: freq > 0 ? behaviorColor : "#f3f4f6",
                                opacity: freq > 0 ? 1 : 0.3,
                              }}
                            />
                            {freq > 0 && <span className="text-xs text-gray-500">{freq}</span>}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-1 mt-1">
                        {dates.map((date, i) => (
                          <div key={i} className="flex-1 text-center">
                            <span className="text-xs text-gray-300">{date.slice(5)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Section>

          {/* SUMMARY TABLE */}
          <Section title="Behavior Summary">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Behavior</th>
                    <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Total</th>
                    <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Avg/Session</th>
                    <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map(s => {
                    const pct = Math.min((s.total / (summaries[0]?.total || 1)) * 100, 100);
                    return (
                      <tr key={s.behavior_name} className="border-b border-gray-50">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                            <span className="font-medium text-gray-800">{s.behavior_name}</span>
                          </div>
                        </td>
                        <td className="text-right py-3 font-bold text-gray-800">{s.total}</td>
                        <td className="text-right py-3 text-gray-500">{s.avg_per_session}</td>
                        <td className="py-3 pl-4">
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}