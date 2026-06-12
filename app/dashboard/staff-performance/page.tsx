"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

type Profile = { id: string; full_name: string | null; role: string | null };
type StaffStats = {
  id: string;
  name: string;
  role: string;
  sessions: number;
  behaviors: number;
  supervisionHours: number;
  fidelityAvg: number;
  lastActive: string;
};

export default function StaffPerformancePage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [staffStats, setStaffStats] = useState<StaffStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [fidelityTrend, setFidelityTrend] = useState<{ date: string; score: number }[]>([]);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: profileData } = await supabase.from("profiles").select("id, full_name, role");
    setProfiles(profileData ?? []);

    const stats: StaffStats[] = await Promise.all(
      (profileData ?? []).map(async (p: any) => {
        const [{ count: sessionCount }, { count: behaviorCount }, { data: supervisionData }, { data: fidelityData }] = await Promise.all([
          supabase.from("sessions").select("*", { count: "exact", head: true }).eq("created_by", p.id),
          supabase.from("behaviors").select("*", { count: "exact", head: true }).eq("created_by", p.id),
          supabase.from("supervision_logs").select("duration_minutes").eq("supervisee_id", p.id),
          supabase.from("program_fidelity").select("overall_score").eq("staff_id", p.id),
        ]);

        const totalSupervisionMins = (supervisionData ?? []).reduce((a: number, b: any) => a + (b.duration_minutes ?? 0), 0);
        const avgFidelity = fidelityData?.length ? Math.round((fidelityData as any[]).reduce((a, b) => a + b.overall_score, 0) / fidelityData.length) : 0;

        const { data: lastSession } = await supabase.from("sessions").select("created_at").eq("created_by", p.id).order("created_at", { ascending: false }).limit(1).single();

        return {
          id: p.id,
          name: p.full_name ?? "Unknown",
          role: p.role ?? "Unknown",
          sessions: sessionCount ?? 0,
          behaviors: behaviorCount ?? 0,
          supervisionHours: parseFloat((totalSupervisionMins / 60).toFixed(1)),
          fidelityAvg: avgFidelity,
          lastActive: lastSession?.created_at ? new Date(lastSession.created_at).toLocaleDateString() : "Never",
        };
      })
    );

    setStaffStats(stats.sort((a, b) => b.sessions - a.sessions));
    setLoading(false);
  }

  async function loadFidelityTrend(staffId: string) {
    setSelectedStaffId(staffId);
    const { data } = await supabase.from("program_fidelity").select("session_date, overall_score").eq("staff_id", staffId).order("session_date", { ascending: true }).limit(20);
    setFidelityTrend((data ?? []).map((d: any) => ({ date: d.session_date, score: d.overall_score })));
  }

  function roleBadge(role: string) {
    if (role === "supervisor" || role === "clinical_director") return "bg-blue-100 text-blue-700";
    if (role === "admin") return "bg-purple-100 text-purple-700";
    if (role === "clinician" || role === "rbt") return "bg-green-100 text-green-700";
    return "bg-gray-100 text-gray-600";
  }

  const sessionData = staffStats.map((s) => ({ name: s.name.split(" ")[0], sessions: s.sessions }));

  return (
    <div className="space-y-6">
      <PageHeader title="Staff Performance">
        <p className="text-gray-500 text-sm">Overview of team activity and clinical metrics.</p>
      </PageHeader>

      {loading && <p className="text-gray-400 text-sm">Loading staff data...</p>}

      {/* SUMMARY CHART */}
      {!loading && staffStats.length > 0 && (
        <Section title="Sessions by Staff Member">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sessionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="sessions" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* STAFF CARDS */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {staffStats.map((s) => (
            <div key={s.id} className={`border rounded-xl p-4 bg-white cursor-pointer hover:shadow-md transition-shadow ${selectedStaffId === s.id ? "border-blue-300" : "border-gray-100"}`}
              onClick={() => loadFidelityTrend(s.id)}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold text-gray-800">{s.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${roleBadge(s.role)}`}>{s.role}</span>
                </div>
                <p className="text-xs text-gray-400">Last active: {s.lastActive}</p>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="border rounded-lg p-2">
                  <p className="text-lg font-bold text-blue-600">{s.sessions}</p>
                  <p className="text-xs text-gray-500">Sessions</p>
                </div>
                <div className="border rounded-lg p-2">
                  <p className="text-lg font-bold text-red-500">{s.behaviors}</p>
                  <p className="text-xs text-gray-500">Behaviors</p>
                </div>
                <div className="border rounded-lg p-2">
                  <p className="text-lg font-bold text-green-600">{s.supervisionHours}h</p>
                  <p className="text-xs text-gray-500">Supervision</p>
                </div>
                <div className="border rounded-lg p-2">
                  <p className={`text-lg font-bold ${s.fidelityAvg >= 80 ? "text-green-600" : s.fidelityAvg >= 60 ? "text-yellow-600" : "text-red-500"}`}>
                    {s.fidelityAvg > 0 ? `${s.fidelityAvg}%` : "—"}
                  </p>
                  <p className="text-xs text-gray-500">Fidelity</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FIDELITY TREND */}
      {selectedStaffId && fidelityTrend.length >= 2 && (
        <Section title={`Fidelity Trend — ${staffStats.find((s) => s.id === selectedStaffId)?.name}`}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={fidelityTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => [`${v}%`, "Fidelity"]} />
              <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Section>
      )}
    </div>
  );
}