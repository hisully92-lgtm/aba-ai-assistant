import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Audio } from "expo-av";
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

async function playAlert(soundOption: SoundOption) {
  if (soundOption === "none") return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
    });
    const { sound } = await Audio.Sound.createAsync(SOUND_FILES[soundOption]);
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate(status => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch (e) {
    console.log("Sound error:", e);
  }
}

async function scheduleTimerNotification(label: string, durationSeconds: number): Promise<string | undefined> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return undefined;
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Timer Complete",
        body: `${label} timer has finished!`,
        sound: true,
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

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [timers, setTimers] = useState<Timer[]>([]);
  const [sound, setSound] = useState<SoundOption>("chime");
  const soundRef = useRef<SoundOption>("chime");
  const silentSoundRef = useRef<Audio.Sound | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const timersRef = useRef<Timer[]>([]);

  useEffect(() => { soundRef.current = sound; }, [sound]);
  useEffect(() => { timersRef.current = timers; }, [timers]);

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
    });
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
    if (silentSoundRef.current) return;
    try {
      const { sound: silentSound } = await Audio.Sound.createAsync(
        SOUND_FILES["chime"],
        { isLooping: true, volume: 0.001 }
      );
      await silentSound.playAsync();
      silentSoundRef.current = silentSound;
    } catch (e) {
      console.log("Silent loop error:", e);
    }
  }

  async function stopSilentLoop() {
    if (!silentSoundRef.current) return;
    try {
      await silentSoundRef.current.stopAsync();
      await silentSoundRef.current.unloadAsync();
      silentSoundRef.current = null;
    } catch (e) {
      console.log("Stop silent loop error:", e);
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
  }, []);

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
