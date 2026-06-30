import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from "expo-audio";
import * as Notifications from "expo-notifications";
import { AppState, AppStateStatus } from "react-native";

export type SoundOption = "chime" | "bell" | "ding" | "soft" | "none";

export type Timer = {
  id: string;
  label: string;
  startedAt: number;
  durationSeconds: number | null;
  running: boolean;
  elapsed: number;
  alerted: boolean;
  notificationId?: string;
};

type TimerContextType = {
  timers: Timer[];
  sound: SoundOption;
  setSound: (s: SoundOption) => void;
  addTimer: (label: string, durationSeconds?: number) => string;
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

const SOUND_FILES: Record<SoundOption, any> = {
  chime: require("../assets/sounds/mixkit-page-forward-single-chime-1107.wav"),
  bell: require("../assets/sounds/mixkit-happy-bells-notification-937.wav"),
  ding: require("../assets/sounds/mixkit-positive-notification-951.wav"),
  soft: require("../assets/sounds/mixkit-musical-reveal-961.wav"),
  none: null,
};

// Audio mode is configured ONCE at module load / app start.
// expo-audio's setAudioModeAsync uses different option names than the old
// expo-av API: playsInSilentMode (no iOS suffix), interruptionMode as a string.
let audioModeConfigured = false;
async function ensureAudioMode() {
  if (audioModeConfigured) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    });
    audioModeConfigured = true;
    console.log("[audio] mode configured successfully");
  } catch (e) {
    console.log("[audio] mode setup error:", e);
  }
}

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [timers, setTimers] = useState<Timer[]>([]);
  const [sound, setSound] = useState<SoundOption>("chime");
  const soundRef = useRef<SoundOption>("chime");
  const silentPlayerRef = useRef<AudioPlayer | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const timersRef = useRef<Timer[]>([]);

  useEffect(() => { soundRef.current = sound; }, [sound]);
  useEffect(() => { timersRef.current = timers; }, [timers]);

  useEffect(() => {
    ensureAudioMode();
  }, []);

  // The real alert sound. Pauses the silent keep-alive player FIRST so the
  // two players never fight for the same audio session simultaneously —
  // this was the root cause of silent alert sounds under expo-av.
  const playAlert = useCallback(async (soundOption: SoundOption) => {
    console.log("[playAlert] called with:", soundOption);
    if (soundOption === "none") return;
    try {
      await ensureAudioMode();

      if (silentPlayerRef.current) {
        try {
          silentPlayerRef.current.pause();
          console.log("[playAlert] silent loop paused");
        } catch (e) {
          console.log("[playAlert] pause silent loop error:", e);
        }
      }

      const alertPlayer = createAudioPlayer(SOUND_FILES[soundOption]);
      alertPlayer.volume = 1.0;
      console.log("[playAlert] player created, volume:", alertPlayer.volume, "playing...");
      alertPlayer.play();

      // expo-audio doesn't auto-reset or auto-unload; poll for completion
      // then release and resume the silent loop.
      const checkInterval = setInterval(() => {
        if (alertPlayer.currentStatus?.didJustFinish || !alertPlayer.playing) {
          if (alertPlayer.currentStatus?.didJustFinish) {
            console.log("[playAlert] playback finished");
            clearInterval(checkInterval);
            alertPlayer.release();
            if (silentPlayerRef.current) {
              try {
                silentPlayerRef.current.play();
              } catch (e) {
                console.log("[playAlert] resume silent loop error:", e);
              }
            }
          }
        }
      }, 200);

      // Safety timeout in case didJustFinish never fires (matches typical
      // alert sound lengths of 1-3s; clears interval and releases regardless)
      setTimeout(() => {
        clearInterval(checkInterval);
        try {
          alertPlayer.release();
        } catch {}
      }, 5000);
    } catch (e) {
      console.log("[playAlert] error:", e);
    }
  }, []);

  useEffect(() => {
    const hasRunningTimers = timers.some(t => t.running && t.durationSeconds !== null);
    if (hasRunningTimers) {
      startSilentLoop();
    } else {
      stopSilentLoop();
    }
    return () => { stopSilentLoop(); };
  }, [timers]);

  async function startSilentLoop() {
    if (silentPlayerRef.current) return;
    try {
      await ensureAudioMode();
      const player = createAudioPlayer(SOUND_FILES["chime"]);
      player.loop = true;
      player.volume = 0.01;
      player.play();
      silentPlayerRef.current = player;
    } catch (e) {
      console.log("[audio] silent loop start error:", e);
    }
  }

  function stopSilentLoop() {
    if (!silentPlayerRef.current) return;
    try {
      silentPlayerRef.current.pause();
      silentPlayerRef.current.release();
      silentPlayerRef.current = null;
    } catch (e) {
      console.log("[audio] silent loop stop error:", e);
    }
  }

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
        timersRef.current.forEach(t => {
          if (t.alerted && t.notificationId) {
            cancelTimerNotification(t.notificationId);
          }
        });
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        let changed = false;
        const next = prev.map(t => {
          if (!t.running) return t;
          const elapsed = Math.floor((Date.now() - t.startedAt) / 1000);
          if (elapsed === t.elapsed) return t;
          changed = true;
          if (t.durationSeconds !== null && t.durationSeconds - elapsed <= 0 && !t.alerted) {
            playAlert(soundRef.current);
            cancelTimerNotification(t.notificationId);
            return { ...t, elapsed, alerted: true };
          }
          return { ...t, elapsed };
        });
        return changed ? next : prev;
      });
    }, 500);
    return () => clearInterval(interval);
  }, [playAlert]);

  const addTimer = useCallback((label: string, durationSeconds?: number): string => {
    const id = `timer-${Date.now()}`;
    const timer: Timer = {
      id, label,
      startedAt: Date.now(),
      durationSeconds: durationSeconds ?? null,
      running: true, elapsed: 0, alerted: false,
    };
    if (durationSeconds) {
      scheduleTimerNotification(label, durationSeconds).then(notificationId => {
        if (notificationId) {
          setTimers(prev => prev.map(t => t.id === id ? { ...t, notificationId } : t));
        }
      });
    }
    setTimers(prev => [...prev, timer]);
    return id;
  }, []);

  const removeTimer = useCallback((id: string) => {
    setTimers(prev => {
      const timer = prev.find(t => t.id === id);
      cancelTimerNotification(timer?.notificationId);
      return prev.filter(t => t.id !== id);
    });
  }, []);

  const pauseTimer = useCallback((id: string) => {
    setTimers(prev => prev.map(t => {
      if (t.id !== id) return t;
      cancelTimerNotification(t.notificationId);
      return { ...t, running: false, notificationId: undefined };
    }));
  }, []);

  const resumeTimer = useCallback((id: string) => {
    setTimers(prev => prev.map(t => {
      if (t.id !== id) return t;
      const newStartedAt = Date.now() - t.elapsed * 1000;
      const remaining = t.durationSeconds ? t.durationSeconds - t.elapsed : null;
      if (remaining && remaining > 0) {
        scheduleTimerNotification(t.label, remaining).then(notificationId => {
          if (notificationId) {
            setTimers(prev2 => prev2.map(t2 => t2.id === id ? { ...t2, notificationId } : t2));
          }
        });
      }
      return { ...t, running: true, startedAt: newStartedAt, notificationId: undefined };
    }));
  }, []);

  const resetTimer = useCallback((id: string) => {
    setTimers(prev => prev.map(t => {
      if (t.id !== id) return t;
      cancelTimerNotification(t.notificationId);
      if (t.durationSeconds) {
        scheduleTimerNotification(t.label, t.durationSeconds).then(notifId => {
          if (notifId) {
            setTimers(prev2 => prev2.map(t2 => t2.id === id ? { ...t2, notificationId: notifId } : t2));
          }
        });
      }
      return { ...t, startedAt: Date.now(), elapsed: 0, running: true, alerted: false, notificationId: undefined };
    }));
  }, []);

  return (
    <TimerContext.Provider value={{ timers, sound, setSound, addTimer, removeTimer, pauseTimer, resumeTimer, resetTimer }}>
      {children}
    </TimerContext.Provider>
  );
}

async function scheduleTimerNotification(label: string, durationSeconds: number): Promise<string | undefined> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return undefined;
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Timer Complete",
        body: `${label} timer has finished!`,
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: durationSeconds,
      },
    });
    return notificationId;
  } catch (e) {
    console.log("Schedule notification error:", e);
    return undefined;
  }
}

async function cancelTimerNotification(notificationId?: string) {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (e) {
    console.log("Cancel notification error:", e);
  }
}
