"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import AppShell from "@/components/app/AppShell";

type Session = { id: string; date: string | null; status: string; behaviors_observed: string | null; programs_targeted: string | null; notes: string | null; created_at: string };
type HomeProgram = { id: string; title: string; description: string; frequency: string | null; created_at: string };

export default function ParentPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [homePrograms, setHomePrograms] = useState<HomeProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"sessions" | "programs" | "progress">("sessions");

  const attendanceTotal = sessions.length;
  const attendanceCompleted = sessions.filter(s => s.status === "completed").length;
  const attendanceRate = attendanceTotal ? Math.round((attendanceCompleted / attendanceTotal) * 100) : 0;

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const [{ data: sessionData }, { data: programData }] = await Promise.all([
      supabase.from("sessions").select("id, date, status, behaviors_observed, programs_targeted, notes, created_at").order("created_at", { ascending: false }).limit(20),
      supabase.from("home_programs").select("*").eq("parent_user_id", user.id).order("created_at", { ascending: false }),
    ]);
    setSessions(sessionData ?? []);
    setHomePrograms(programData ?? []);
    setLoading(false);
  }

  if (loading) {
    return <AppShell title="Parent Portal"><div className="flex justify-center py-20"><p className="text-gray-400 text-sm">Loading...</p></div></AppShell>;
  }

  return (
    <AppShell title="Parent Portal">
      <div className="pb-10">
        {/* STATS */}
        <div className="flex bg-white py-4 border-b border-gray-100">
          <div className="flex-1 text-center">
            <p className="text-2xl font-black" style={{ color: "#2563eb" }}>{attendanceTotal}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Sessions</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-2xl font-black" style={{ color: "#16a34a" }}>{attendanceRate}%</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Attendance</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-2xl font-black" style={{ color: "#7c3aed" }}>{homePrograms.length}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Home Programs</p>
          </div>
        </div>

        {/* TABS */}
        <div className="flex bg-white border-b border-gray-100">
          {(["sessions", "programs", "progress"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className="flex-1 py-3 text-center border-b-2" style={{ borderColor: activeTab === tab ? "#2563eb" : "transparent" }}>
              <span className="text-[13px]" style={{ color: activeTab === tab ? "#2563eb" : "#9ca3af", fontWeight: activeTab === tab ? 700 : 400 }}>
                {tab === "sessions" ? "Sessions" : tab === "programs" ? "Home Programs" : "Progress"}
              </span>
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === "sessions" && (
            sessions.length === 0 ? (
              <div className="flex flex-col items-center py-12">
                <p className="text-4xl mb-2.5">📋</p><p className="text-sm text-gray-400">No sessions recorded yet.</p>
              </div>
            ) : sessions.map(s => (
              <div key={s.id} className="bg-white rounded-xl p-3.5 mb-2.5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-semibold text-gray-900 flex-1">
                    {s.date ? new Date(s.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : new Date(s.created_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.status === "completed" ? "#dcfce7" : "#fef9c3", color: "#374151" }}>{s.status}</span>
                </div>
                {s.behaviors_observed && <p className="text-[13px] text-gray-500 mb-1"><span className="font-semibold text-gray-700">Behaviors: </span>{s.behaviors_observed}</p>}
                {s.programs_targeted && <p className="text-[13px] text-gray-500 mb-1"><span className="font-semibold text-gray-700">Programs: </span>{s.programs_targeted}</p>}
                {s.notes && <p className="text-xs text-gray-400 italic mt-1">{s.notes}</p>}
              </div>
            ))
          )}

          {activeTab === "programs" && (
            homePrograms.length === 0 ? (
              <div className="flex flex-col items-center py-12">
                <p className="text-4xl mb-2.5">🏠</p><p className="text-sm text-gray-400">No home programs yet.</p>
                <p className="text-xs text-gray-300 mt-1 text-center">Your BCBA will add home practice programs here.</p>
              </div>
            ) : homePrograms.map(p => (
              <div key={p.id} className="bg-white rounded-xl p-3.5 mb-2.5 shadow-sm">
                <p className="text-[15px] font-bold text-gray-900 mb-1">{p.title}</p>
                {p.frequency && <p className="text-xs mb-1.5" style={{ color: "#2563eb" }}>📅 {p.frequency}</p>}
                <p className="text-[13px] text-gray-500 leading-relaxed">{p.description}</p>
              </div>
            ))
          )}

          {activeTab === "progress" && (
            <div>
              <div className="bg-white rounded-xl p-4 mb-2.5">
                <p className="text-[13px] font-bold text-gray-700 mb-2">Attendance Rate</p>
                <p className="text-4xl font-black mb-2" style={{ color: "#16a34a" }}>{attendanceRate}%</p>
                <div className="h-2.5 bg-gray-100 rounded-full mb-1.5">
                  <div className="h-2.5 rounded-full" style={{ backgroundColor: "#16a34a", width: `${attendanceRate}%` }} />
                </div>
                <p className="text-xs text-gray-400">{attendanceCompleted} of {attendanceTotal} sessions completed</p>
              </div>
              <div className="bg-white rounded-xl p-4">
                <p className="text-[13px] font-bold text-gray-700 mb-2">Recent Programs</p>
                {[...new Set(sessions.flatMap(s => (s.programs_targeted ?? "").split(", ").filter(Boolean)))].slice(0, 6).map(p => (
                  <span key={p} className="inline-block text-xs font-medium px-3 py-1.5 rounded-full mr-1.5 mb-1.5" style={{ backgroundColor: "#eff6ff", color: "#2563eb" }}>{p}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
