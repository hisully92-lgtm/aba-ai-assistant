"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

type Stats = {
  totalClients: number;
  totalSessions: number;
  totalBehaviors: number;
  totalPrograms: number;
  masteredPrograms: number;
  completedSessions: number;
  averageSessionsPerClient: number;
  activeClients: number;
};

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sessionTrend, setSessionTrend] = useState<{ month: string; sessions: number; completed: number }[]>([]);
  const [behaviorBreakdown, setBehaviorBreakdown] = useState<{ name: string; count: number }[]>([]);
  const [programProgress, setProgramProgress] = useState<{ name: string; mastered: number; active: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("6m");

  useEffect(() => { init(); }, [dateRange]);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const monthsBack = dateRange === "3m" ? 3 : dateRange === "6m" ? 6 : 12;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);
    const startStr = startDate.toISOString().split("T")[0];

    const [
      { count: clientCount },
      { count: sessionCount },
      { count: behaviorCount },
      { count: programCount },
      { data: sessionData },
      { data: behaviorData },
      { data: programData },
      { data: recentSessions },
    ] = await Promise.all([
      supabase.from("clients").select("*", { count: "exact", head: true }).eq("created_by", user.id),
      supabase.from("sessions").select("*", { count: "exact", head: true }).eq("created_by", user.id),
      supabase.from("behaviors").select("*", { count: "exact", head: true }).eq("created_by", user.id),
      supabase.from("programs").select("*", { count: "exact", head: true }).eq("created_by", user.id),
      supabase.from("sessions").select("date, status, created_at").eq("created_by", user.id).gte("created_at", startStr),
      supabase.from("behaviors").select("behavior_name, created_at").eq("created_by", user.id).gte("created_at", startStr),
      supabase.from("programs").select("program_name, trial_data, mastery_criteria, created_at").eq("created_by", user.id),
      supabase.from("sessions").select("client_id").eq("created_by", user.id).eq("status", "completed").gte("created_at", startStr),
    ]);

    // SESSION TREND
    const monthlyMap = new Map<string, { sessions: number; completed: number }>();
    (sessionData ?? []).forEach((s: any) => {
      const month = (s.date ?? s.created_at).slice(0, 7);
      const existing = monthlyMap.get(month) ?? { sessions: 0, completed: 0 };
      monthlyMap.set(month, {
        sessions: existing.sessions + 1,
        completed: existing.completed + (s.status === "completed" ? 1 : 0),
      });
    });
    const trend = Array.from(monthlyMap.entries()).map(([month, data]) => ({ month, ...data })).sort((a, b) => a.month.localeCompare(b.month));
    setSessionTrend(trend);

    // BEHAVIOR BREAKDOWN
    const behaviorMap = new Map<string, number>();
    (behaviorData ?? []).forEach((b: any) => {
      behaviorMap.set(b.behavior_name, (behaviorMap.get(b.behavior_name) ?? 0) + 1);
    });
    setBehaviorBreakdown(Array.from(behaviorMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8));

    // PROGRAM PROGRESS
    const programMap = new Map<string, { mastered: number; active: number }>();
    (programData ?? []).forEach((p: any) => {
      const name = p.program_name;
      const existing = programMap.get(name) ?? { mastered: 0, active: 0 };
      const pctMatch = p.trial_data?.match(/(\d+)/);
      const pct = pctMatch ? parseInt(pctMatch[1]) : 0;
      const masteryMatch = p.mastery_criteria?.match(/(\d+)%/);
      const mastery = masteryMatch ? parseInt(masteryMatch[1]) : 80;
      const isMastered = pct >= mastery && pct > 0;
      programMap.set(name, {
        mastered: existing.mastered + (isMastered ? 1 : 0),
        active: existing.active + (!isMastered ? 1 : 0),
      });
    });
    setProgramProgress(Array.from(programMap.entries()).map(([name, data]) => ({ name, ...data })).slice(0, 8));

    // ACTIVE CLIENTS
    const activeClientIds = new Set((recentSessions ?? []).map((s: any) => s.client_id));

    // MASTERED PROGRAMS
    const mastered = (programData ?? []).filter((p: any) => {
      const pctMatch = p.trial_data?.match(/(\d+)/);
      const pct = pctMatch ? parseInt(pctMatch[1]) : 0;
      const masteryMatch = p.mastery_criteria?.match(/(\d+)%/);
      const mastery = masteryMatch ? parseInt(masteryMatch[1]) : 80;
      return pct >= mastery && pct > 0;
    }).length;

    const completedCount = (sessionData ?? []).filter((s: any) => s.status === "completed").length;

    setStats({
      totalClients: clientCount ?? 0,
      totalSessions: sessionCount ?? 0,
      totalBehaviors: behaviorCount ?? 0,
      totalPrograms: programCount ?? 0,
      masteredPrograms: mastered,
      completedSessions: completedCount,
      averageSessionsPerClient: clientCount ? Math.round((sessionCount ?? 0) / clientCount) : 0,
      activeClients: activeClientIds.size,
    });

    setLoading(false);
  }

  const COLORS = ["#2563eb", "#16a34a", "#dc2626", "#f97316", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b"];

  const pieData = stats ? [
    { name: "Completed", value: stats.completedSessions, color: "#16a34a" },
    { name: "Other", value: stats.totalSessions - stats.completedSessions, color: "#e5e7eb" },
  ] : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics Dashboard">
        <div className="flex gap-1 border border-gray-200 rounded-lg p-1">
          {["3m", "6m", "12m"].map((r) => (
            <button key={r} onClick={() => setDateRange(r)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${dateRange === r ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700"}`}>
              {r}
            </button>
          ))}
        </div>
      </PageHeader>

      {loading && <p className="text-gray-400 text-sm">Loading analytics...</p>}

      {stats && (
        <>
          {/* KEY METRICS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Clients", value: stats.totalClients, sub: `${stats.activeClients} active`, color: "text-blue-600" },
              { label: "Total Sessions", value: stats.totalSessions, sub: `${stats.completedSessions} completed`, color: "text-green-600" },
              { label: "Programs", value: stats.totalPrograms, sub: `${stats.masteredPrograms} mastered`, color: "text-purple-600" },
              { label: "Behaviors Logged", value: stats.totalBehaviors, sub: `${stats.averageSessionsPerClient} sessions/client avg`, color: "text-red-500" },
            ].map((stat) => (
              <div key={stat.label} className="border rounded-xl p-4 bg-white">
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-gray-400 mt-1">{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* SESSION TREND */}
          {sessionTrend.length > 0 && (
            <Section title="Session Trend">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={sessionTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="sessions" stroke="#2563eb" strokeWidth={2} name="Total" dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="completed" stroke="#16a34a" strokeWidth={2} name="Completed" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </Section>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* BEHAVIOR BREAKDOWN */}
            {behaviorBreakdown.length > 0 && (
              <Section title="Top Behaviors">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={behaviorBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#dc2626" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Section>
            )}

            {/* SESSION COMPLETION */}
            <Section title="Session Completion Rate">
              <div className="flex items-center gap-6">
                <PieChart width={160} height={160}>
                  <Pie data={pieData} cx={75} cy={75} innerRadius={45} outerRadius={70} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
                <div className="space-y-3">
                  <div>
                    <p className="text-3xl font-bold text-green-600">
                      {stats.totalSessions ? Math.round((stats.completedSessions / stats.totalSessions) * 100) : 0}%
                    </p>
                    <p className="text-xs text-gray-500">Completion Rate</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-600">✅ {stats.completedSessions} completed</p>
                    <p className="text-xs text-gray-600">📋 {stats.totalSessions} total</p>
                    <p className="text-xs text-gray-600">👥 {stats.activeClients} active clients</p>
                  </div>
                </div>
              </div>
            </Section>
          </div>

          {/* PROGRAM PROGRESS */}
          {programProgress.length > 0 && (
            <Section title="Program Mastery by Type">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={programProgress}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="mastered" fill="#16a34a" name="Mastered" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="active" fill="#2563eb" name="Active" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-400 mt-2 text-center">Green = Mastered · Blue = Active</p>
            </Section>
          )}
        </>
      )}
    </div>
  );
}