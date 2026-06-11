"use client";

import { useState } from "react";
import { useTimers, Timer, TimerType } from "@/lib/contexts/TimerContext";

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

const PRESETS = [
  { label: "Bathroom", type: "bathroom" as TimerType, seconds: 300 },
  { label: "DRA/SIB",  type: "dra"      as TimerType, seconds: null },
  { label: "Activity", type: "activity" as TimerType, seconds: 600 },
  { label: "Session",  type: "session"  as TimerType, seconds: null },
];

function fmt(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function TimerChip({ timer }: { timer: Timer }) {
  const { removeTimer, pauseTimer, resumeTimer, resetTimer } = useTimers();
  const [expanded, setExpanded] = useState(false);

  const isCountdown = timer.durationSeconds !== null;
  const remaining = isCountdown ? Math.max(0, timer.durationSeconds! - timer.elapsed) : null;
  const display = isCountdown ? fmt(remaining!) : fmt(timer.elapsed);
  const urgent = isCountdown && remaining !== null && remaining <= 30 && remaining > 0;
  const done = isCountdown && remaining === 0;
  const color = TYPE_COLORS[timer.type];

  return (
    <div className={`relative flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-white text-xs font-mono transition-all
      ${done ? "bg-gray-500 animate-pulse" : urgent ? "bg-red-600 animate-pulse" : color}`}>
      <span>{TYPE_ICONS[timer.type]}</span>
      <button onClick={() => setExpanded(e => !e)} className="flex flex-col items-start leading-tight">
        <span className="text-[10px] opacity-75 font-sans font-medium leading-none mb-0.5">{timer.label}</span>
        <span className={`font-mono font-bold ${done ? "text-red-200" : ""}`}>
          {done ? "DONE" : display}
        </span>
      </button>

      {expanded && (
        <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-xl p-3 z-50 flex flex-col gap-2 min-w-[160px]">
          <p className="text-xs font-semibold text-gray-700">{timer.label}</p>
          <p className="text-2xl font-mono font-bold text-gray-800 text-center">
            {done ? "⏰ Done!" : display}
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {timer.running && !done ? (
              <button onClick={() => pauseTimer(timer.id)}
                className="flex-1 text-xs py-1.5 bg-yellow-100 text-yellow-700 rounded-lg font-medium">
                ⏸ Pause
              </button>
            ) : !done ? (
              <button onClick={() => resumeTimer(timer.id)}
                className="flex-1 text-xs py-1.5 bg-green-100 text-green-700 rounded-lg font-medium">
                ▶ Resume
              </button>
            ) : null}
            <button onClick={() => resetTimer(timer.id)}
              className="flex-1 text-xs py-1.5 bg-blue-100 text-blue-700 rounded-lg font-medium">
              ↺ Reset
            </button>
            <button onClick={() => { removeTimer(timer.id); setExpanded(false); }}
              className="flex-1 text-xs py-1.5 bg-red-100 text-red-700 rounded-lg font-medium">
              ✕ Stop
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FloatingTimerBar() {
  const { timers, addTimer } = useTimers();
  const [showAdd, setShowAdd] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customMins, setCustomMins] = useState("");
  const [customCountdown, setCustomCountdown] = useState(true);

  if (timers.length === 0 && !showAdd) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setShowAdd(true)}
          className="bg-white border border-gray-200 shadow-lg rounded-full px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-2 transition-all">
          ⏱️ Timers
        </button>
      </div>
    );
  }

  function handleAddCustom() {
    if (!customLabel.trim()) return;
    const secs = customCountdown && customMins ? parseInt(customMins) * 60 : undefined;
    addTimer(customLabel.trim(), "custom", secs);
    setCustomLabel("");
    setCustomMins("");
    setShowAdd(false);
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
      {timers.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap justify-center bg-gray-900/90 backdrop-blur rounded-2xl px-3 py-2 shadow-2xl max-w-[95vw]">
          {timers.map(t => <TimerChip key={t.id} timer={t} />)}
          <button
            onClick={() => setShowAdd(s => !s)}
            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors">
            {showAdd ? "✕" : "+ Add"}
          </button>
        </div>
      )}

      {showAdd && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 w-80">
          <p className="text-sm font-semibold text-gray-700 mb-3">Start a Timer</p>

          <div className="grid grid-cols-2 gap-2 mb-3">
            {PRESETS.map(p => (
              <button key={p.label}
                onClick={() => { addTimer(p.label, p.type, p.seconds ?? undefined); setShowAdd(false); }}
                className={`text-xs px-3 py-2.5 rounded-xl text-white font-medium flex items-center gap-1.5 ${TYPE_COLORS[p.type]}`}>
                {TYPE_ICONS[p.type]}
                <span>{p.label}</span>
                {p.seconds && <span className="opacity-75">({p.seconds / 60}m)</span>}
              </button>
            ))}
          </div>

          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-500 mb-2 font-medium">Custom Timer</p>
            <input
              type="text"
              value={customLabel}
              onChange={e => setCustomLabel(e.target.value)}
              placeholder="Timer name (e.g. Transition)"
              className="w-full border rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div className="flex gap-2 mb-2">
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input type="radio" checked={customCountdown} onChange={() => setCustomCountdown(true)} />
                Countdown
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input type="radio" checked={!customCountdown} onChange={() => setCustomCountdown(false)} />
                Stopwatch
              </label>
            </div>
            {customCountdown && (
              <input
                type="number"
                value={customMins}
                onChange={e => setCustomMins(e.target.value)}
                placeholder="Minutes"
                className="w-full border rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            )}
            <button
              onClick={handleAddCustom}
              disabled={!customLabel.trim()}
              className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors">
              Start Timer
            </button>
          </div>

          <button onClick={() => setShowAdd(false)}
            className="w-full mt-2 py-1.5 text-xs text-gray-400 hover:text-gray-600">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}