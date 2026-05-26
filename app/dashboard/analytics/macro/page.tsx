"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

type Client = { id: string; full_name: string; diagnosis: string | null };

export default function MacroTrendPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [range, setRange] = useState("6m");

  const [masteryVelocity, setMasteryVelocity] = useState<{ month: string; mastered: number; cumulative: number }[]>([]);
  const [behaviorTrend, setBehaviorTrend] = useState<{ month: string; frequency: number }[]>([]);
  const [sessionAttendance, setSessionAttendance] = useState<{ month: string; completed: number; cancelled: number; rate: number }[]>([]);
  const [promptTrend, setPromptTrend] = useState<{ date: string; level: number; label: string }[]>([]);

  const [summary, setSummary] = useState({
    totalMastered: 0,
    avgMasteryPerMonth: 0,
    behaviorReduction: 0,
    attendanceRate: 0,
    promptProgress: "",
  });

  useEffect(() => { init(); }, []);
  useEffect(() => { if (selectedClientId) loadClientData(); }, [selectedClientId, range]);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const { data } = await supabase.from("clients").select("id, full_name, diagnosis").eq("created_by", user.id);
    setClients(data ?? []);
    setLoading(false);
  }

  async function loadClientData() {
    setDataLoading(true);
    const monthsBack = range === "3m" ? 3 : range === "6m" ? 6 : range === "12m" ? 12 : 24;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);
    const startStr = startDate.toISOString().split("T")[0];

    const [{ data: programs }, { data: behaviors }, { data: sessions }, { data: promptLogs }] = await Promise.all([
      supabase.from("programs").select("program_name, trial_data, mastery_criteria, created_at").eq("client_id", selectedClientId).gte("created_at", startStr),
      supabase.from("behaviors").select("behavior_name, frequency, created_at").eq("client_id", selectedClientId).gte("created_at", startStr),
      supabase.from("sessions").select("date, status, created_at").eq("client_id", selectedClientId).gte("created_at", startStr),
      supabase.from("prompt_fading_logs").select("session_date, current_prompt_level").eq("client_id", selectedClientId).gte("session_date", startStr).order("session_date"),
    ]);

    // MASTERY VELOCITY
    const masteryByMonth = new Map<string, number>();
    (programs ?? []).forEach((p: any) => {
      const pctMatch = p.trial_data?.match(/(\d+)/);
      const pct = pctMatch ? parseInt(pctMatch[1]) : 0;
      const masteryMatch = p.mastery_criteria?.match(/(\d+)%/);
      const mastery = masteryMatch ? parseInt(masteryMatch[1]) : 80;
      if (pct >= mastery && pct > 0) {
        const month = p.created_at.slice(0, 7);
        masteryByMonth.set(month, (masteryByMonth.get(month) ?? 0) + 1);
      }
    });

    let cumulative = 0;
    const velocityData = Array.from(masteryByMonth.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => {
      cumulative += count;
      return { month, mastered: count, cumulative };
    });
    setMasteryVelocity(velocityData);

    // BEHAVIOR TREND
    const behaviorByMonth = new Map<string, number>();
    (behaviors ?? []).forEach((b: any) => {
      const month = b.created_at.slice(0, 7);
      behaviorByMonth.set(month, (behaviorByMonth.get(month) ?? 0) + (b.frequency ?? 1));
    });
    setBehaviorTrend(Array.from(behaviorByMonth.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([month, frequency]) => ({ month, frequency })));

    // SESSION ATTENDANCE
    const sessionByMonth = new Map<string, { completed: number; cancelled: number }>();
    (sessions ?? []).forEach((s: any) => {
      const month = (s.date ?? s.created_at).slice(0, 7);
      const existing = sessionByMonth.get(month) ?? { completed: 0, cancelled: 0 };
      sessionByMonth.set(month, {
        completed: existing.completed + (s.status === "completed" ? 1 : 0),
        cancelled: existing.cancelled + (s.status === "cancelled" ? 1 : 0),
      });
    });
    const attendanceData = Array.from(sessionByMonth.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([month, data]) => ({
      month,
      ...data,
      rate: data.completed + data.cancelled > 0 ? Math.round((data.completed / (data.completed + data.cancelled)) * 100) : 0,
    }));
    setSessionAttendance(attendanceData);

    // PROMPT TREND
    const PROMPT_LEVELS_SHORT: Record<string, number> = {
      "Full Physical (FP)": 1, "Partial Physical (PP)": 2, "Model (M)": 3,
      "Gesture (G)": 4, "Positional (P)": 5, "Vocal (V)": 6, "Independent (I)": 7,
    };
    setPromptTrend((promptLogs ?? []).map((l: any) => ({
      date: l.session_date,
      level: PROMPT_LEVELS_SHORT[l.current_prompt_level] ?? 0,
      label: l.current_prompt_level,
    })));

    // SUMMARY
    const totalMastered = cumulative;
    const avgPerMonth = velocityData.length ? (totalMastered / velocityData.length).toFixed(1) : "0";
    const firstBehavior = behaviorTrend[0]?.frequency ?? 0;
    const lastBehavior = behaviorTrend[behaviorTrend.length - 1]?.frequency ?? 0;
    const reduction = firstBehavior > 0 ? Math.round(((firstBehavior - lastBehavior) / firstBehavior) * 100) : 0;
    const avgAttendance = attendanceData.length ? Math.round(attendanceData.reduce((a, b) => a + b.rate, 0) / attendanceData.length) : 0;
    const firstPrompt = promptLogs?.[0]?.current_prompt_level ?? "";
    const lastPrompt = promptLogs?.[promptLogs.length - 1]?.current_prompt_level ?? "";

    setSummary({
      totalMastered,
      avgMasteryPerMonth: parseFloat(avgPerMonth),
      behaviorReduction: reduction,
      attendanceRate: avgAttendance,
      promptProgress: firstPrompt && lastPrompt ? `${firstPrompt} → ${lastPrompt}` : "No data",
    });

    setDataLoading(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Macro-Trend Reporting">
        <div className="flex gap-2">
          <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">Select client...</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <div className="flex gap-1 border border-gray-200 rounded-lg p-1">
            {["3m", "6m", "12m", "24m"].map((r) => (
              <button key={r} onClick={() => setRange(r)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${range === r ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700"}`}>
                {r}
              </button>
            ))}
          </div>
        </div>
      </PageHeader>

      {!selectedClientId && (
        <Section title="Select a Client">
          <p className="text-gray-400 text-sm">Choose a client above to view their macro-trend data.</p>
        </Section>
      )}

      {selectedClientId && dataLoading && (
        <div className="flex items-center gap-3 py-8">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading trend data...</p>
        </div>
      )}

      {selectedClientId && !dataLoading && (
        <>
          {/* SUMMARY CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Skills Mastered", value: summary.totalMastered, color: "text-green-600" },
              { label: "Skills/Month", value: summary.avgMasteryPerMonth, color: "text-blue-600" },
              { label: "Behavior Reduction", value: `${summary.behaviorReduction}%`, color: summary.behaviorReduction > 0 ? "text-green-600" : "text-red-500" },
              { label: "Attendance Rate", value: `${summary.attendanceRate}%`, color: "text-purple-600" },
              { label: "Prompt Progress", value: summary.promptProgress, color: "text-orange-600", small: true },
            ].map((stat) => (
              <div key={stat.label} className="border rounded-xl p-4 text-center bg-white">
                <p className={`${stat.small ? "text-xs" : "text-2xl"} font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* MASTERY VELOCITY */}
          {masteryVelocity.length > 0 && (
            <Section title="Skill Mastery Velocity">
              <p className="text-xs text-gray-400 mb-3">Cumulative skills mastered over time — steeper = faster progress</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={masteryVelocity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="cumulative" stroke="#16a34a" fill="#dcfce7" strokeWidth={2} name="Cumulative" />
                  <Line type="monotone" dataKey="mastered" stroke="#2563eb" strokeWidth={2} name="Per Month" dot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </Section>
          )}

          {/* BEHAVIOR TREND */}
          {behaviorTrend.length > 0 && (
            <Section title="Behavior Frequency Trend">
              <p className="text-xs text-gray-400 mb-3">Lower is better — track sustained reduction over time</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={behaviorTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="frequency" stroke="#dc2626" fill="#fee2e2" strokeWidth={2} name="Frequency" />
                </AreaChart>
              </ResponsiveContainer>
            </Section>
          )}

          {/* ATTENDANCE TREND */}
          {sessionAttendance.length > 0 && (
            <Section title="Session Attendance Rate">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={sessionAttendance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v) => [`${v}%`, "Attendance"]} />
                  <Line type="monotone" dataKey="rate" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} name="Rate" />
                </LineChart>
              </ResponsiveContainer>
            </Section>
          )}

          {/* PROMPT TREND */}
          {promptTrend.length > 1 && (
            <Section title="Prompt Level Progression">
              <p className="text-xs text-gray-400 mb-3">Higher = more independent (7 = Independent)</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={promptTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={[1, 7]} ticks={[1, 2, 3, 4, 5, 6, 7]} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v, n, props) => [props.payload?.label ?? v, "Prompt Level"]} />
                  <Line type="monotone" dataKey="level" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </Section>
          )}

          {masteryVelocity.length === 0 && behaviorTrend.length === 0 && sessionAttendance.length === 0 && (
            <Section title="No Data">
              <p className="text-gray-400 text-sm">No trend data available for this client in the selected time range.</p>
            </Section>
          )}
        </>
      )}
    </div>
  );
}