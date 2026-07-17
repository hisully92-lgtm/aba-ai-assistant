"use client";

import { useState } from "react";
import { useTimers, Timer, TimerType, SoundOption } from "@/lib/contexts/TimerContext";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";

const TYPE_COLORS: Record<TimerType, string> = {
  session:  "bg-blue-600",
  bathroom: "bg-yellow-500",
  dra:      "bg-red-600",
  activity: "bg-purple-600",
  custom:   "bg-gray-600",
};

const TYPE_ICONS: Record<TimerType, string> = {
  session:  "📋",
  bathroom: "🚻",
  dra:      "🔴",
  activity: "⏱️",
  custom:   "⏰",
};

const SOUND_OPTIONS: { value: SoundOption; label: string }[] = [
  { value: "chime", label: "🎵 Chime" },
  { value: "bell",  label: "🔔 Bell" },
  { value: "ding",  label: "✨ Ding" },
  { value: "soft",  label: "🌊 Soft" },
  { value: "none",  label: "🔇 Silent" },
];

function fmt(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function TimersPage() {
  const { timers, addTimer, removeTimer, pauseTimer, resumeTimer, resetTimer, sound, setSound } = useTimers();
  const [label, setLabel] = useState("");
  const [hrs, setHrs] = useState("");
  const [mins, setMins] = useState("");
  const [secs, setSecs] = useState("");
  const [countdown, setCountdown] = useState(true);

  function handleAdd() {
    if (!label.trim()) return;
    const totalSecs = countdown
      ? (parseInt(hrs || "0") * 3600) + (parseInt(mins || "0") * 60) + parseInt(secs || "0")
      : undefined;
    addTimer(label.trim(), "custom", totalSecs && totalSecs > 0 ? totalSecs : undefined);
    setLabel(""); setHrs(""); setMins(""); setSecs("");
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Timers">
        <p className="text-sm text-gray-500">Timers run in the background across all pages.</p>
      </PageHeader>

      {/* ADD TIMER */}
      <Section title="New Timer">
        <div className="space-y-4">
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Timer name (e.g. Bathroom Break, Session, DRA)"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="radio" checked={countdown} onChange={() => setCountdown(true)} />
              Countdown
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="radio" checked={!countdown} onChange={() => setCountdown(false)} />
              Stopwatch
            </label>
          </div>

          {countdown && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Hours</label>
                <input type="number" min="0" max="23" value={hrs}
                  onChange={e => setHrs(e.target.value)} placeholder="0"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Minutes</label>
                <input type="number" min="0" max="59" value={mins}
                  onChange={e => setMins(e.target.value)} placeholder="0"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Seconds</label>
                <input type="number" min="0" max="59" value={secs}
                  onChange={e => setSecs(e.target.value)} placeholder="0"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>
          )}

          <button
            onClick={handleAdd}
            disabled={!label.trim()}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors">
            Start Timer
          </button>
        </div>
      </Section>

      {/* SOUND SETTINGS */}
      <Section title="Alert Sound">
        <div className="flex gap-2 flex-wrap">
          {SOUND_OPTIONS.map(opt => (
            <button key={opt.value}
              onClick={() => setSound(opt.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                sound === opt.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </Section>

      {/* ACTIVE TIMERS */}
      <Section title={`Active Timers (${timers.length})`}>
        {timers.length === 0 ? (
          <p className="text-gray-400 text-sm">No timers running. Start one above.</p>
        ) : (
          <div className="space-y-3">
            {timers.map(timer => {
              const isCountdown = timer.durationSeconds !== null;
              const remaining = isCountdown ? Math.max(0, timer.durationSeconds! - timer.elapsed) :null;
              const display = isCountdown ? fmt(remaining!) : fmt(timer.elapsed);
              const done = isCountdown && remaining === 0;
              const urgent = isCountdown && remaining !== null && remaining <= 30 && remaining > 0;

              return (
                <div key={timer.id} className={`border rounded-2xl p-4 ${done ? "border-gray-300 bg-gray-50" : urgent ? "border-red-300 bg-red-50" : "border-gray-100 bg-white"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg ${TYPE_COLORS[timer.type]}`}>
                        {TYPE_ICONS[timer.type]}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{timer.label}</p>
                        <p className={`text-2xl font-mono font-bold ${done ? "text-gray-400" : urgent ? "text-red-600" : "text-gray-800"}`}>
                          {done ? "DONE" : display}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      {timer.running && !done ? (
                        <button onClick={() => pauseTimer(timer.id)}
                          className="px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg text-xs font-medium">
                          ⏸ Pause
                        </button>
                      ) : !done ? (
                        <button onClick={() => resumeTimer(timer.id)}
                          className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                          ▶ Resume
                        </button>
                      ) : null}
                      <button onClick={() => resetTimer(timer.id)}
                        className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                        ↺ Reset
                      </button>
                      <button onClick={() => removeTimer(timer.id)}
                        className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium">
                        ✕ Stop
                      </button>
                    </div>
                  </div>

                  {isCountdown && !done && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>{timer.running ? "Running" : "Paused"}</span>
                        <span>{remaining !== null ? fmt(remaining) : ""} remaining</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${urgent ? "bg-red-500" : "bg-blue-500"}`}
                          style={{ width: `${Math.max(0, ((timer.durationSeconds! - (remaining ?? 0)) / timer.durationSeconds!) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
