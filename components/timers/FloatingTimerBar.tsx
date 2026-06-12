"use client";

import { useState, useRef, useEffect } from "react";
import { useTimers, Timer, TimerType, SoundOption } from "@/lib/contexts/TimerContext";

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

const SOUND_OPTIONS: { value: SoundOption; label: string; desc: string }[] = [
  { value: "chime",  label: "🎵 Chime",    desc: "Three ascending notes" },
  { value: "bell",   label: "🔔 Bell",     desc: "Long resonant tone" },
  { value: "ding",   label: "✨ Ding",     desc: "Short bright tone" },
  { value: "soft",   label: "🌊 Soft",     desc: "Low gentle tone" },
  { value: "none",   label: "🔇 Silent",   desc: "No sound" },
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
  const { timers, addTimer, sound, setSound, visible, setVisible } = useTimers();
  const [minimized, setMinimized] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showSound, setShowSound] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customMins, setCustomMins] = useState("");
  const [customCountdown, setCustomCountdown] = useState(true);

  // Draggable state
  const [pos, setPos] = useState({ x: window.innerWidth - 200, y: window.innerHeight - 80 });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
    }
    function onMouseUp() { dragging.current = false; }
    function onTouchMove(e: TouchEvent) {
      if (!dragging.current) return;
      const t = e.touches[0];
      setPos({ x: t.clientX - offset.current.x, y: t.clientY - offset.current.y });
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onMouseUp);
    };
  }, []);

  function startDrag(e: React.MouseEvent | React.TouchEvent) {
    dragging.current = true;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    offset.current = { x: clientX - pos.x, y: clientY - pos.y };
  }

  if (!visible) return null;

  // Minimized — small bubble
  if (minimized) {
    return (
      <div
        ref={barRef}
        style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 9999, cursor: "grab" }}
        onMouseDown={startDrag}
        onTouchStart={startDrag}
      >
        <button
          onClick={() => setMinimized(false)}
          className="bg-gray-900/90 backdrop-blur text-white rounded-full w-12 h-12 flex items-center justify-center shadow-2xl text-lg border border-white/10 hover:bg-gray-800 transition-all"
        >
          {timers.length > 0 ? (
            <span className="text-xs font-bold">⏱{timers.length}</span>
          ) : "⏱️"}
        </button>
      </div>
    );
  }

  function handleAddCustom() {
    if (!customLabel.trim()) return;
    const secs = customCountdown && customMins ? parseInt(customMins) * 60 : undefined;
    addTimer(customLabel.trim(), "custom", secs);
    setCustomLabel(""); setCustomMins(""); setShowAdd(false);
  }

  return (
    <div
      ref={barRef}
      style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 9999, maxWidth: "95vw" }}
    >
      {/* DRAG HANDLE + TIMER BAR */}
      <div className="flex flex-col items-end gap-2">
        <div
          className="flex items-center gap-2 flex-wrap bg-gray-900/90 backdrop-blur rounded-2xl px-3 py-2 shadow-2xl cursor-grab active:cursor-grabbing"
          onMouseDown={startDrag}
          onTouchStart={startDrag}
        >
          {/* Drag grip */}
          <span className="text-gray-500 text-xs select-none">⠿</span>

          {timers.map(t => <TimerChip key={t.id} timer={t} />)}

          <button
            onClick={(e) => { e.stopPropagation(); setShowAdd(s => !s); }}
            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors">
            {showAdd ? "✕" : "+ Add"}
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); setShowSound(s => !s); }}
            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
            title="Sound settings">
            🔔
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); setMinimized(true); }}
            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
            title="Minimize">
            —
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); setVisible(false); }}
            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
            title="Close">
            ✕
          </button>
        </div>

        {/* SOUND PICKER */}
        {showSound && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 w-64">
            <p className="text-sm font-semibold text-gray-700 mb-3">Timer Sound</p>
            <div className="flex flex-col gap-2">
              {SOUND_OPTIONS.map(opt => (
                <button key={opt.value}
                  onClick={() => { setSound(opt.value); setShowSound(false); }}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${sound === opt.value ? "bg-blue-50 border border-blue-200 text-blue-700" : "hover:bg-gray-50 text-gray-700"}`}>
                  <span>{opt.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{opt.desc}</span>
                  {sound === opt.value && <span className="text-blue-500">✓</span>}
                </button>
              ))}
            </div>
            <button onClick={() => setShowSound(false)} className="w-full mt-3 py-1.5 text-xs text-gray-400 hover:text-gray-600">Close</button>
          </div>
        )}

        {/* ADD TIMER */}
        {showAdd && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 w-72">
            <p className="text-sm font-semibold text-gray-700 mb-3">New Timer</p>
            <input
              type="text"
              value={customLabel}
              onChange={e => setCustomLabel(e.target.value)}
              placeholder="Timer name (e.g. Bathroom Break)"
              className="w-full border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div className="flex gap-3 mb-3">
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
                placeholder="Minutes (e.g. 5)"
                className="w-full border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            )}
            <button
              onClick={handleAddCustom}
              disabled={!customLabel.trim()}
              className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors">
              Start Timer
            </button>
            <button onClick={() => setShowAdd(false)} className="w-full mt-2 py-1.5 text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}