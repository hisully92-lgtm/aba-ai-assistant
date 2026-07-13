"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useTimers, useEVV } from "@/lib/mobileContext";

function fmt(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const TABS = [
  { emoji: "🏠", label: "Home", path: "/app/home" },
  { emoji: "📅", label: "Cal", path: "/app/schedule" },
  { emoji: "📋", label: "Session", path: "/app/session" },
  { emoji: "📝", label: "Notes", path: "/app/notes" },
  { emoji: "💬", label: "Chat", path: "/app/chat" },
  { emoji: "🎥", label: "Video", path: "/app/telehealth" },
  { emoji: "👨‍👧", label: "Parent", path: "/app/parent" },
];

const DRAWER_ITEMS = [
  { emoji: "⏱️", label: "Time Entry", path: "/app/timeentry" },
  { emoji: "👤", label: "Profile & Settings", path: "/app/profile" },
  { emoji: "🏠", label: "Home", path: "/app/home" },
  { emoji: "📅", label: "Schedule", path: "/app/schedule" },
  { emoji: "📋", label: "Session", path: "/app/session" },
  { emoji: "📝", label: "Notes", path: "/app/notes" },
  { emoji: "💬", label: "Team Chat", path: "/app/chat" },
  { emoji: "🎥", label: "Telehealth", path: "/app/telehealth" },
  { emoji: "👨‍👩‍👧", label: "Parent Portal", path: "/app/parent" },
];

export default function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const { timers, pauseTimer, resumeTimer, resetTimer, removeTimer } = useTimers();
  const { activeSession, elapsed } = useEVV();

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const runningTimers = timers.filter(t => t.running);

  async function handleLogout() {
    if (!confirm("Log out?")) return;
    setLoggingOut(true);
    setDrawerOpen(false);
    await supabase.auth.signOut();
    router.replace("/app");
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0f172a" }}>
      {/* HEADER */}
      <div className="flex items-center justify-between px-5 py-4" style={{ backgroundColor: "#1a2234" }}>
        <button onClick={() => setDrawerOpen(true)} className="w-9 h-9 flex items-center justify-center text-white text-xl">☰</button>
        <span className="text-white font-extrabold text-lg">{title}</span>
        <button onClick={() => setTimerOpen(true)} className="w-9 h-9 flex items-center justify-center relative text-xl">
          ⏱️
          {runningTimers.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {runningTimers.length}
            </span>
          )}
        </button>
      </div>

      {/* ACTIVE SESSION BANNER */}
      {activeSession && (
        <button onClick={() => router.push("/app/home")} className="flex items-center justify-between px-4 py-2.5 w-full" style={{ backgroundColor: "#16a34a" }}>
          <div className="text-left">
            <p className="text-xs font-bold text-white">⏱️ {activeSession.client_name}</p>
            <p className="text-[11px]" style={{ color: "#bbf7d0" }}>{activeSession.location_name ?? "Session in progress"} · {fmt(elapsed)}</p>
          </div>
          <span className="bg-white text-xs font-extrabold px-3 py-1.5 rounded-full" style={{ color: "#16a34a" }}>END VISIT</span>
        </button>
      )}

      {!isOnline && (
        <div className="text-center text-xs font-medium py-1.5" style={{ backgroundColor: "#7c2d12", color: "#fed7aa" }}>
          You&apos;re offline — some features may be limited
        </div>
      )}

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto pb-20">{children}</div>

      {/* BOTTOM TAB BAR */}
      <div className="fixed bottom-0 left-0 right-0 flex items-center justify-around py-2" style={{ backgroundColor: "#1a2234", height: 70 }}>
        {TABS.map(tab => {
          const focused = pathname === tab.path;
          return (
            <button key={tab.path} onClick={() => router.push(tab.path)} className="flex flex-col items-center gap-0.5">
              <span className="text-xl">{tab.emoji}</span>
              <span className="text-[10px]" style={{ color: focused ? "#2563eb" : "#9ca3af", fontWeight: focused ? 600 : 400 }}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* DRAWER */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={() => setDrawerOpen(false)}>
          <div className="w-72 h-full pt-14 flex flex-col" style={{ backgroundColor: "#1a2234" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-5 pb-6 border-b" style={{ borderColor: "#2a3a54" }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-black text-xl" style={{ backgroundColor: "#2563eb" }}>A</div>
              <span className="text-white font-black text-xl">ABA AI</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {DRAWER_ITEMS.map(item => (
                <button key={item.label} onClick={() => { setDrawerOpen(false); router.push(item.path); }}
                  className="flex items-center gap-3.5 px-5 py-3.5 border-b w-full text-left" style={{ borderColor: "#2a3a54" }}>
                  <span className="text-xl">{item.emoji}</span>
                  <span className="text-sm font-medium" style={{ color: "#e2e8f0" }}>{item.label}</span>
                </button>
              ))}
            </div>
            <button onClick={handleLogout} disabled={loggingOut} className="m-4 py-4 rounded-xl text-white font-bold text-sm" style={{ backgroundColor: "#dc2626" }}>
              {loggingOut ? "..." : "🚪 Log Out"}
            </button>
          </div>
        </div>
      )}

      {/* TIMER OVERLAY */}
      {timerOpen && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={() => setTimerOpen(false)}>
          <div className="w-full bg-white rounded-t-3xl p-5 pb-10 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-extrabold text-gray-900">⏱️ Active Timers</span>
              <button onClick={() => setTimerOpen(false)} className="text-gray-400 text-lg p-1">✕</button>
            </div>
            {timers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm font-semibold text-gray-600">No timers running.</p>
                <p className="text-xs text-gray-400 mt-1">Start timers from the Timers screen.</p>
              </div>
            ) : (
              timers.map(timer => {
                const isCountdown = timer.durationSeconds !== null;
                const remaining = isCountdown ? Math.max(0, timer.durationSeconds! - timer.elapsed) : null;
                const display = isCountdown ? fmt(remaining!) : fmt(timer.elapsed);
                const done = isCountdown && remaining === 0;
                return (
                  <div key={timer.id} className="rounded-xl p-3.5 mb-2.5 border" style={{ backgroundColor: done ? "#f3f4f6" : "#f9fafb", borderColor: "#e5e7eb" }}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-gray-700">{timer.label}</span>
                      <span className="text-2xl font-black text-gray-900 tabular-nums">{done ? "DONE" : display}</span>
                    </div>
                    <div className="flex gap-1.5">
                      {timer.running && !done ? (
                        <button onClick={() => pauseTimer(timer.id)} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: "#fef9c3", color: "#854d0e" }}>⏸ Pause</button>
                      ) : !done ? (
                        <button onClick={() => resumeTimer(timer.id)} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: "#dcfce7", color: "#166534" }}>▶ Resume</button>
                      ) : null}
                      <button onClick={() => resetTimer(timer.id)} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: "#eff6ff", color: "#1d4ed8" }}>↺ Reset</button>
                      <button onClick={() => removeTimer(timer.id)} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}>✕</button>
                    </div>
                  </div>
                );
              })
            )}
            <button onClick={() => { setTimerOpen(false); router.push("/app/timers"); }} className="w-full py-3.5 rounded-xl text-white font-bold text-sm mt-3" style={{ backgroundColor: "#2563eb" }}>
              + Add New Timer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
