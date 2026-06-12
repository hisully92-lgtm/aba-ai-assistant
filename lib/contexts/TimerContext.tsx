"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

export type TimerType = "session" | "bathroom" | "dra" | "activity" | "custom";
export type SoundOption = "chime" | "bell" | "ding" | "soft" | "none";

export type Timer = {
  id: string;
  label: string;
  type: TimerType;
  startedAt: number;
  durationSeconds: number | null;
  running: boolean;
  elapsed: number;
  alerted: boolean;
};

type TimerContextType = {
  timers: Timer[];
  sound: SoundOption;
  setSound: (s: SoundOption) => void;
  visible: boolean;
  setVisible: (v: boolean | ((prev: boolean) => boolean)) => void;
  addTimer: (label: string, type: TimerType, durationSeconds?: number) => string;
  removeTimer: (id: string) => void;
  pauseTimer: (id: string) => void;
  resumeTimer: (id: string) => void;
  resetTimer: (id: string) => void;
};

const TimerContext = createContext<TimerContextType | null>(null);

export function useTimers() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimers must be used within TimerProvider");
  return ctx;
}

function playSound(sound: SoundOption) {
  try {
    if (sound === "none") return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    if (sound === "chime") {
      [523, 659, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.connect(gain);
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.25);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.25 + 0.6);
        osc.start(ctx.currentTime + i * 0.25);
        osc.stop(ctx.currentTime + i * 0.25 + 0.6);
      });
    } else if (sound === "bell") {
      const osc = ctx.createOscillator();
      osc.connect(gain);
      osc.type = "sine";
      osc.frequency.value = 440;
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.0);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 2.0);
    } else if (sound === "ding") {
      const osc = ctx.createOscillator();
      osc.connect(gain);
      osc.type = "triangle";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.8);
    } else if (sound === "soft") {
      const osc = ctx.createOscillator();
      osc.connect(gain);
      osc.type = "sine";
      osc.frequency.value = 330;
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.5);
    }
  } catch {}
}

const STORAGE_KEY = "aba_timers";
const SOUND_KEY = "aba_timer_sound";

function loadFromStorage(): Timer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: Timer[] = JSON.parse(raw);
    return parsed.map(t => {
      if (!t.running) return t;
      const elapsed = Math.floor((Date.now() - t.startedAt) / 1000);
      return { ...t, elapsed };
    });
  } catch { return []; }
}

function saveToStorage(timers: Timer[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(timers)); } catch {}
}

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [timers, setTimers] = useState<Timer[]>([]);
  const [sound, setSound] = useState<SoundOption>("chime");
  const [visible, setVisible] = useState(true);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialized = useRef(false);
  const soundRef = useRef<SoundOption>("chime");

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setTimers(loadFromStorage());
    const saved = localStorage.getItem(SOUND_KEY) as SoundOption;
    if (saved) { setSound(saved); soundRef.current = saved; }
  }, []);

  useEffect(() => {
    soundRef.current = sound;
    try { localStorage.setItem(SOUND_KEY, sound); } catch {}
  }, [sound]);

  useEffect(() => {
    tickRef.current = setInterval(() => {
      setTimers(prev => {
        let changed = false;
        const next = prev.map(t => {
          if (!t.running) return t;
          const elapsed = Math.floor((Date.now() - t.startedAt) / 1000);
          if (elapsed === t.elapsed) return t;
          changed = true;
          if (t.durationSeconds !== null) {
            const remaining = t.durationSeconds - elapsed;
            if (remaining <= 0 && !t.alerted) {
              playSound(soundRef.current);
              return { ...t, elapsed, alerted: true };
            }
          }
          return { ...t, elapsed };
        });
        if (!changed) return prev;
        saveToStorage(next);
        return next;
      });
    }, 500);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setTimers(prev => prev.map(t => {
          if (!t.running) return t;
          return { ...t, elapsed: Math.floor((Date.now() - t.startedAt) / 1000) };
        }));
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const addTimer = useCallback((label: string, type: TimerType, durationSeconds?: number): string => {
    const id = `timer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const timer: Timer = {
      id, label, type,
      startedAt: Date.now(),
      durationSeconds: durationSeconds ?? null,
      running: true, elapsed: 0, alerted: false,
    };
    setTimers(prev => { const next = [...prev, timer]; saveToStorage(next); return next; });
    return id;
  }, []);

  const removeTimer = useCallback((id: string) => {
    setTimers(prev => { const next = prev.filter(t => t.id !== id); saveToStorage(next); return next; });
  }, []);

  const pauseTimer = useCallback((id: string) => {
    setTimers(prev => { const next = prev.map(t => t.id === id ? { ...t, running: false } : t); saveToStorage(next); return next; });
  }, []);

  const resumeTimer = useCallback((id: string) => {
    setTimers(prev => {
      const next = prev.map(t => {
        if (t.id !== id) return t;
        return { ...t, running: true, startedAt: Date.now() - t.elapsed * 1000 };
      });
      saveToStorage(next); return next;
    });
  }, []);

  const resetTimer = useCallback((id: string) => {
    setTimers(prev => {
      const next = prev.map(t => t.id === id ? { ...t, startedAt: Date.now(), elapsed: 0, running: true, alerted: false } : t);
      saveToStorage(next); return next;
    });
  }, []);

  return (
    <TimerContext.Provider value={{ timers, sound, setSound, visible, setVisible, addTimer, removeTimer, pauseTimer, resumeTimer, resetTimer }}>
      {children}
    </TimerContext.Provider>
  );
}