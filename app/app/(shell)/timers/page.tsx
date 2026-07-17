"use client";

import { useState } from "react";
import { useTimers, SoundOption } from "@/lib/mobileContext";
import AppShell from "@/components/app/AppShell";

function fmt(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function TimersPage() {
  const { timers, addTimer, removeTimer, pauseTimer, resumeTimer, resetTimer, sound, setSound } = useTimers();
  const [showSound, setShowSound] = useState(false);
  const SOUND_OPTIONS: { value: SoundOption; label: string; desc: string }[] = [
    { value: "chime", label: "🎵 Chime", desc: "Three ascending notes" },
    { value: "bell", label: "🔔 Bell", desc: "Long resonant tone" },
    { value: "ding", label: "✨ Ding", desc: "Short bright tone" },
    { value: "soft", label: "🌊 Soft", desc: "Low gentle tone" },
    { value: "none", label: "🔇 Silent", desc: "No sound" },
  ];
  const [label, setLabel] = useState("");
  const [hrs, setHrs] = useState("");
  const [mins, setMins] = useState("");
  const [secs, setSecs] = useState("");
  const [countdown, setCountdown] = useState(true);

  function handleAdd() {
    if (!label.trim()) { alert("Please enter a timer name."); return; }
    const totalSecs = countdown ? (parseInt(hrs || "0") * 3600) + (parseInt(mins || "0") * 60) + parseInt(secs || "0") : 0;
    addTimer(label.trim(), countdown && totalSecs > 0 ? totalSecs : null);
    setLabel(""); setHrs(""); setMins(""); setSecs("");
  }

  return (
    <AppShell title="Timers">
      <div className="flex justify-end px-4 pt-3">
        <button onClick={() => setShowSound(s => !s)} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: "#1a2234", color: "#94a3b8" }}>
          🔔 Sound
        </button>
      </div>

      {showSound && (
        <div className="mx-4 mt-2 bg-white rounded-2xl p-4 shadow-md">
          <p className="text-base font-bold text-gray-900 mb-3">Timer Sound</p>
          {SOUND_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => { setSound(opt.value); setShowSound(false); }} className="w-full flex items-center justify-between py-3 border-b border-gray-100 text-left">
              <div>
                <p className="text-sm font-semibold text-gray-700">{opt.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
              </div>
              {sound === opt.value && <span className="text-lg font-bold" style={{ color: "#2563eb"}}>✓</span>}
            </button>
          ))}
          <button onClick={() => setShowSound(false)} className="w-full text-center pt-3 text-gray-500 text-sm">Close</button>
        </div>
      )}

      <div className="pb-10">
        {/* NEW TIMER */}
        <div className="m-4 bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-base font-bold text-gray-900 mb-3.5">New Timer</p>
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Timer name (e.g. Bathroom Break)"
            className="w-full border border-gray-300 rounded-lg px-3.5 py-3 text-sm text-gray-900 mb-3.5" />

          <div className="flex gap-5 mb-3.5">
            <button onClick={() => setCountdown(true)} className="flex items-center gap-2">
              <span className="w-4.5 h-4.5 rounded-full border-2" style={{ width: 18, height: 18, borderColor: countdown ? "#2563eb" : "#d1d5db", backgroundColor: countdown ? "#2563eb" : "transparent" }} />
              <span className="text-sm text-gray-700">Countdown</span>
            </button>
            <button onClick={() => setCountdown(false)} className="flex items-center gap-2">
              <span style={{ width: 18, height: 18, borderRadius: 9, border: "2px solid", borderColor: !countdown ? "#2563eb" : "#d1d5db", backgroundColor: !countdown ? "#2563eb" : "transparent" }} />
              <span className="text-sm text-gray-700">Stopwatch</span>
            </button>
          </div>

          {countdown && (
            <div className="flex gap-2.5 mb-3.5">
              {[["Hours", hrs, setHrs], ["Minutes", mins, setMins], ["Seconds", secs, setSecs]].map(([lbl, val, set]: any) => (
                <div key={lbl} className="flex-1">
                  <p className="text-[11px] text-gray-400 mb-1">{lbl}</p>
                  <input value={val} onChange={e => set(e.target.value)} placeholder="0" maxLength={2}
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-2.5 text-base text-gray-900 text-center" />
                </div>
              ))}
            </div>
          )}

          <button onClick={handleAdd} disabled={!label.trim()} className="w-full text-white font-bold py-3.5 rounded-xl disabled:opacity-60" style={{ backgroundColor: "#2563eb" }}>
            Start Timer
          </button>
        </div>

        {/* ACTIVE TIMERS */}
        <div className="px-4">
          <p className="text-[15px] font-bold text-gray-900 mb-3">Active Timers ({timers.length})</p>
          {timers.length === 0 ? (
            <p className="text-sm text-gray-400">No timers running. Start one above.</p>
          ) : (
            timers.map(timer => {
              const isCountdown = timer.durationSeconds !== null;
              const remaining = isCountdown ? Math.max(0, timer.durationSeconds! - timer.elapsed) :null;
              const display = isCountdown ? fmt(remaining!) : fmt(timer.elapsed);
              const done = isCountdown && remaining === 0;
              const urgent = isCountdown && remaining !== null && remaining <= 30 && remaining > 0;
              const progress = isCountdown && timer.durationSeconds ? ((timer.durationSeconds - (remaining ?? 0)) / timer.durationSeconds) * 100 : 0;

              return (
                <div key={timer.id} className="bg-white rounded-2xl p-4 mb-2.5 border"
                  style={{ backgroundColor: done ? "#f9fafb" : urgent ? "#fef2f2" : "#fff", borderColor: urgent ? "#fca5a5" : done ? "#d1d5db" : "#e5e7eb" }}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold text-gray-700 flex-1">{timer.label}</span>
                    <span className="text-3xl font-black tabular-nums" style={{ color: done ? "#9ca3af" : urgent ? "#dc2626" : "#111827" }}>{done ? "DONE" : display}</span>
                  </div>
                  {isCountdown && !done && (
                    <div className="h-1.5 bg-gray-200 rounded-full mb-1.5">
                      <div className="h-1.5 rounded-full" style={{ backgroundColor: urgent ? "#dc2626" : "#2563eb", width: `${progress}%` }} />
                    </div>
                  )}
                  {isCountdown && !done && (
                    <p className="text-[11px] text-gray-400 mb-2.5">{timer.running ? "Running" : "Paused"} · {fmt(remaining!)} remaining</p>
                  )}
                  <div className="flex gap-1.5">
                    {timer.running && !done ? (
                      <button onClick={() => pauseTimer(timer.id)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: "#fef9c3", color: "#854d0e" }}>⏸ Pause</button>
                    ) : !done ? (
                      <button onClick={() => resumeTimer(timer.id)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: "#dcfce7", color: "#166534" }}>▶ Resume</button>
                    ) : null}
                    <button onClick={() => resetTimer(timer.id)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: "#eff6ff", color: "#1d4ed8" }}>↺ Reset</button>
                    <button onClick={() => removeTimer(timer.id)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}>✕ Stop</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
