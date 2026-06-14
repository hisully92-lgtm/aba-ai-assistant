"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";

type Client = { id: string; full_name: string };
type TargetSummary = {
  target_id: string;
  program_name: string;
  target_name: string;
  total_trials: number;
  correct: number;
  prompted: number;
  incorrect: number;
  no_response: number;
  pct_correct: number;
  mastered: boolean;
};
type TargetTrend = {
  target_name: string;
  date: string;
  pct_correct: number;
  total: number;
};

export default function SkillAnalyticsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [loading, setLoading] = useState(false);
  const [summaries, setSummaries] = useState<TargetSummary[]>([]);
  const [trends, setTrends] = useState<TargetTrend[]>([]);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [dateRange, setDateRange] = useState("30");

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedClient) loadData(); }, [selectedClient, dateRange]); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const { data: companyUser } = await supabase
      .from("company_users").select("company_id")
      .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
    const { data } = await supabase.from("clients").select("id, full_name")
      .eq("company_id", companyUser?.company_id).order("full_name");
    setClients(data ?? []);
  }

  async function loadData() {
    setLoading(true);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(dateRange));

    const { data } = await supabase
      .from("skill_trial_data")
      .select(`
        result,
        recorded_at,
        target_id,
        skill_targets(program_name, target_name),
        mastery_criteria:skill_targets(mastery_criteria)
      `)
      .eq("client_id", selectedClient)
      .gte("recorded_at", startDate.toISOString())
      .order("recorded_at");

    if (!data) { setLoading(false); return; }

    // Build summaries
    const summaryMap: Record<string, TargetSummary> = {};
    data.forEach((d: any) => {
      const id = d.target_id;
      if (!summaryMap[id]) {
        summaryMap[id] = {
          target_id: id,
          program_name: d.skill_targets?.program_name ?? "",
          target_name: d.skill_targets?.target_name ?? "",
          total_trials: 0, correct: 0, prompted: 0, incorrect: 0, no_response: 0,
          pct_correct: 0, mastered: false,
        };
      }
      summaryMap[id].total_trials++;
      if (d.result === "correct") summaryMap[id].correct++;
      else if (d.result === "prompted") summaryMap[id].prompted++;
      else if (d.result === "incorrect") summaryMap[id].incorrect++;
      else if (d.result === "no_response") summaryMap[id].no_response++;
    });

    Object.values(summaryMap).forEach(s => {
      s.pct_correct = s.total_trials > 0 ? Math.round((s.correct / s.total_trials) * 100) : 0;
      s.mastered = s.pct_correct >= 80 && s.total_trials >= 10;
    });
    setSummaries(Object.values(summaryMap).sort((a, b) => b.pct_correct - a.pct_correct));

    // Build trends by date
    const trendMap: Record<string, { correct: number; total: number }> = {};
    data.forEach((d: any) => {
      const date = new Date(d.recorded_at).toISOString().split("T")[0];
      const key = `${d.target_id}-${date}`;
      if (!trendMap[key]) trendMap[key] = { correct: 0, total: 0 };
      trendMap[key].total++;
      if (d.result === "correct") trendMap[key].correct++;
    });

    const trendList: TargetTrend[] = Object.entries(trendMap).map(([key, val]) => {
      const [targetId, date] = key.split("-");
      const target = summaryMap[targetId];
      return {
        target_name: target?.target_name ?? "",
        date,
        pct_correct: Math.round((val.correct / val.total) * 100),
        total: val.total,
      };
    });
    setTrends(trendList.sort((a, b) => a.date.localeCompare(b.date)));
    if (summaryMap[Object.keys(summaryMap)[0]]) {
      setSelectedTarget(Object.keys(summaryMap)[0]);
    }
    setLoading(false);
  }

  const selectedSummary = summaries.find(s => s.target_id === selectedTarget);
  const selectedTrends = trends.filter(t => t.target_name === selectedSummary?.target_name);
  const dates = [...new Set(selectedTrends.map(t => t.date))].sort();

  return (
    <div className="space-y-6">
      <PageHeader title="Skill Acquisition Analytics" />

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
          <p className="text-4xl mb-3">🎯</p>
          <p className="text-gray-600 font-medium">Select a client to view skill analytics</p>
        </div>
      )}

      {selectedClient && loading && (
        <div className="text-center py-16">
          <div className="animate-spin text-4xl">⏳</div>
          <p className="text-gray-400 mt-3">Loading skill data...</p>
        </div>
      )}

      {selectedClient && !loading && summaries.length === 0 && (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
          <p className="text-4xl mb-3">🎯</p>
          <p className="text-gray-600 font-medium">No skill trial data yet</p>
          <p className="text-gray-400 text-sm mt-1">Start recording trials during sessions to see progress here.</p>
        </div>
      )}

      {selectedClient && !loading && summaries.length > 0 && (
        <>
          {/* MASTERY STATUS */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <p className="text-xs text-green-600 font-semibold uppercase">Mastered</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{summaries.filter(s => s.mastered).length}</p>
              <p className="text-xs text-green-500">targets at 80%+</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-xs text-blue-600 font-semibold uppercase">In Progress</p>
              <p className="text-3xl font-bold text-blue-700 mt-1">{summaries.filter(s => !s.mastered && s.pct_correct >= 50).length}</p>
              <p className="text-xs text-blue-500">targets at 50-79%</p>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
              <p className="text-xs text-orange-600 font-semibold uppercase">Emerging</p>
              <p className="text-3xl font-bold text-orange-700 mt-1">{summaries.filter(s => s.pct_correct < 50).length}</p>
              <p className="text-xs text-orange-500">targets below 50%</p>
            </div>
          </div>

          {/* TARGET SELECTOR */}
          <Section title="Target Progress">
            <div className="flex flex-wrap gap-2 mb-6">
              {summaries.map(s => (
                <button key={s.target_id}
                  onClick={() => setSelectedTarget(s.target_id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    selectedTarget === s.target_id
                      ? "bg-purple-600 text-white border-purple-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-purple-300"
                  }`}>
                  {s.mastered ? "✓ " : ""}{s.target_name}
                </button>
              ))}
            </div>

            {selectedSummary && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-xs text-gray-400">{selectedSummary.program_name}</p>
                    <p className="font-semibold text-gray-800">{selectedSummary.target_name}</p>
                  </div>
                  {selectedSummary.mastered && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">✓ Mastered</span>
                  )}
                </div>

                {/* ACCURACY BAR */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-gray-500">Overall Accuracy</span>
                    <span className="text-xs font-bold text-gray-800">{selectedSummary.pct_correct}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div className="h-3 rounded-full transition-all"
                      style={{
                        width: `${selectedSummary.pct_correct}%`,
                        backgroundColor: selectedSummary.pct_correct >= 80 ? "#16a34a" : selectedSummary.pct_correct >= 50 ? "#2563eb" : "#f59e0b"
                      }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-gray-400">{selectedSummary.total_trials} total trials</span>
                    <span className="text-xs text-gray-400">Mastery: 80%</span>
                  </div>
                </div>

                {/* TRIAL BREAKDOWN */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Correct", value: selectedSummary.correct, color: "#16a34a" },
                    { label: "Prompted", value: selectedSummary.prompted, color: "#d97706" },
                    { label: "Incorrect", value: selectedSummary.incorrect, color: "#dc2626" },
                    { label: "No Response", value: selectedSummary.no_response, color: "#6b7280" },
                  ].map(item => (
                    <div key={item.label} className="text-center p-3 rounded-xl border border-gray-100">
                      <p className="text-lg font-bold" style={{ color: item.color }}>{item.value}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>

                {/* TREND CHART */}
                {selectedTrends.length > 1 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Daily Accuracy Trend</p>
                    <div className="flex items-end gap-1" style={{ height: 100 }}>
                      {dates.map(date => {
                        const entry = selectedTrends.find(t => t.date === date);
                        const pct = entry?.pct_correct ?? 0;
                        return (
                          <div key={date} className="flex flex-col items-center gap-1 flex-1">
                            <span className="text-xs text-gray-500">{pct}%</span>
                            <div className="w-full rounded-t-sm"
                              style={{
                                height: Math.max((pct / 100) * 70, 2),
                                backgroundColor: pct >= 80 ? "#16a34a" : pct >= 50 ? "#2563eb" : "#f59e0b",
                              }} />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-1 mt-1">
                      {dates.map(date => (
                        <div key={date} className="flex-1 text-center">
                          <span className="text-xs text-gray-300">{date.slice(5)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* ALL TARGETS TABLE */}
          <Section title="All Targets">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Target</th>
                    <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Trials</th>
                    <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Correct</th>
                    <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Accuracy</th>
                    <th className="text-center py-2 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map(s => (
                    <tr key={s.target_id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedTarget(s.target_id)}>
                      <td className="py-3">
                        <p className="font-medium text-gray-800">{s.target_name}</p>
                        <p className="text-xs text-gray-400">{s.program_name}</p>
                      </td>
                      <td className="text-right py-3 text-gray-600">{s.total_trials}</td>
                      <td className="text-right py-3 text-gray-600">{s.correct}</td>
                      <td className="py-3 pl-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-100 rounded-full h-2">
                            <div className="h-2 rounded-full"
                              style={{
                                width: `${s.pct_correct}%`,
                                backgroundColor: s.pct_correct >= 80 ? "#16a34a" : s.pct_correct >= 50 ? "#2563eb" : "#f59e0b"
                              }} />
                          </div>
                          <span className="text-xs font-semibold text-gray-700">{s.pct_correct}%</span>
                        </div>
                      </td>
                      <td className="text-center py-3">
                        {s.mastered ? (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">Mastered</span>
                        ) : s.pct_correct >= 50 ? (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">In Progress</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">Emerging</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}