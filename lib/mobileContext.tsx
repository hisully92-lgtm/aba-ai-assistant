"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase/client";

/* ---------------- TIMERS ---------------- */
export type SoundOption = "chime" | "bell" | "ding" | "soft" | "none";

const SOUND_FILES: Record<Exclude<SoundOption, "none">, string> = {
  chime: "/sounds/mixkit-page-forward-single-chime-1107.wav",
  bell: "/sounds/mixkit-happy-bells-notification-937.wav",
  ding: "/sounds/mixkit-positive-notification-951.wav",
  soft: "/sounds/mixkit-musical-reveal-961.wav",
};

function playAlert(sound: SoundOption) {
  if (sound === "none") return;
  try {
    const audio = new Audio(SOUND_FILES[sound]);
    audio.volume = 1.0;
    audio.play().catch(e => console.log("Audio play blocked:", e));
  } catch (e) {
    console.log("Play alert sound error:", e);
  }
}

type Timer = { id: string; label: string; elapsed: number; running: boolean; durationSeconds: number | null; alerted: boolean };
type TimerContextType = {
  timers: Timer[];
  sound: SoundOption;
  setSound: (s: SoundOption) => void;
  addTimer: (label: string, durationSeconds: number | null) => void;
  pauseTimer: (id: string) => void;
  resumeTimer: (id: string) => void;
  resetTimer: (id: string) => void;
  removeTimer: (id: string) => void;
};
const TimerContext = createContext<TimerContextType | null>(null);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [timers, setTimers] = useState<Timer[]>([]);
  const [sound, setSound] = useState<SoundOption>("chime");
  const soundRef = useRef<SoundOption>("chime");

  useEffect(() => { soundRef.current = sound; }, [sound]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => prev.map(t => {
        if (!t.running) return t;
        const newElapsed = t.elapsed + 1;
        if (t.durationSeconds !== null && t.durationSeconds - newElapsed <= 0 && !t.alerted) {
          playAlert(soundRef.current);
          return { ...t, elapsed: newElapsed, alerted: true };
        }
        return { ...t, elapsed: newElapsed };
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const addTimer = useCallback((label: string, durationSeconds: number | null) => {
    setTimers(prev => [...prev, { id: crypto.randomUUID(), label, elapsed: 0, running: true, durationSeconds, alerted: false }]);
  }, []);
  const pauseTimer = useCallback((id: string) => setTimers(prev => prev.map(t => t.id === id ? { ...t, running: false } : t)), []);
  const resumeTimer = useCallback((id: string) => setTimers(prev => prev.map(t => t.id === id ? { ...t, running: true } : t)), []);
  const resetTimer = useCallback((id: string) => setTimers(prev => prev.map(t => t.id === id ? { ...t, elapsed: 0, alerted: false, running: true } : t)), []);
  const removeTimer = useCallback((id: string) => setTimers(prev => prev.filter(t => t.id !== id)), []);

  return (
    <TimerContext.Provider value={{ timers, sound, setSound, addTimer, pauseTimer, resumeTimer, resetTimer, removeTimer }}>
      {children}
    </TimerContext.Provider>
  );
}
export function useTimers() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimers must be used within TimerProvider");
  return ctx;
}

/* ---------------- EVV / ACTIVE SESSION ---------------- */
type ActiveSession = { id: string; client_name: string; location_name: string | null; clock_in: string } | null;
type EVVContextType = {
  activeSession: ActiveSession;
  elapsed: number;
  refreshSession: () => void;
};
const EVVContext = createContext<EVVContextType | null>(null);

export function EVVProvider({ children }: { children: React.ReactNode }) {
  const [activeSession, setActiveSession] = useState<ActiveSession>(null);
  const [elapsed, setElapsed] = useState(0);
  const tickRef = useRef<any>(null);

  const refreshSession = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data: entry } = await supabase
      .from("time_entries")
      .select("id, clock_in, client_id, location_name")
      .eq("created_by", user.id)
      .is("clock_out", null)
      .limit(1)
      .maybeSingle();

    if (!entry) { setActiveSession(null); return; }

    const { data: client } = await supabase.from("clients").select("full_name").eq("id", entry.client_id).limit(1).maybeSingle();

    setActiveSession({
      id: entry.id,
      client_name: client?.full_name ?? "Client",
      location_name: entry.location_name,
      clock_in: entry.clock_in,
    });
  }, []);

  useEffect(() => { refreshSession(); }, [refreshSession]);

  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (activeSession) {
      const start = new Date(activeSession.clock_in).getTime();
      tickRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(tickRef.current);
  }, [activeSession]);

  return (
    <EVVContext.Provider value={{ activeSession, elapsed, refreshSession }}>
      {children}
    </EVVContext.Provider>
  );
}
export function useEVV() {
  const ctx = useContext(EVVContext);
  if (!ctx) throw new Error("useEVV must be used within EVVProvider");
  return ctx;
}