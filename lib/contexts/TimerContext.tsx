"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

export type TimerType = "session" | "bathroom" | "dra" | "activity" | "custom";

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

function playAlert() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.0);
  } catch {}
}

const STORAGE_KEY = "aba_timers";

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
  } catch {
    return [];
  }
}

function saveToStorage(timers: Timer[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
  } catch {}
}

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [timers, setTimers] = useState<Timer[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const saved = loadFromStorage();
    setTimers(saved);
  }, []);

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
              playAlert();
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
      running: true,
      elapsed: 0,
      alerted: false,
    };
    setTimers(prev => {
      const next = [...prev, timer];
      saveToStorage(next);
      return next;
    });
    return id;
  }, []);

  const removeTimer = useCallback((id: string) => {
    setTimers(prev => {
      const next = prev.filter(t => t.id !== id);
      saveToStorage(next);
      return next;
    });
  }, []);

  const pauseTimer = useCallback((id: string) => {
    setTimers(prev => {
      const next = prev.map(t => t.id === id ? { ...t, running: false } : t);
      saveToStorage(next);
      return next;
    });
  }, []);

  const resumeTimer = useCallback((id: string) => {
    setTimers(prev => {
      const next = prev.map(t => {
        if (t.id !== id) return t;
        const newStart = Date.now() - t.elapsed * 1000;
        return { ...t, running: true, startedAt: newStart };
      });
      saveToStorage(next);
      return next;
    });
  }, []);

  const resetTimer = useCallback((id: string) => {
    setTimers(prev => {
      const next = prev.map(t =>
        t.id === id
          ? { ...t, startedAt: Date.now(), elapsed: 0, running: true, alerted: false }
          : t
      );
      saveToStorage(next);
      return next;
    });
  }, []);

  return (
    <TimerContext.Provider value={{ timers, addTimer, removeTimer, pauseTimer, resumeTimer, resetTimer }}>
      {children}
    </TimerContext.Provider>
  );
}