import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";

export type ActiveSession = {
  id: string;
  client_id: string;
  client_name: string;
  location_name: string | null;
  location_id: string | null;
  clock_in: string;
  start_lat: number | null;
  start_lon: number | null;
  geofence_verified: boolean;
  start_time_adjusted: boolean;
  start_adjustment_reason: string | null;
};

type EVVContextType = {
  activeSession: ActiveSession | null;
  setActiveSession: (s: ActiveSession | null) => void;
  refreshSession: () => Promise<void>;
  elapsed: number;
};

const EVVContext = createContext<EVVContextType | null>(null);

export function useEVV() {
  const ctx = useContext(EVVContext);
  if (!ctx) throw new Error("useEVV must be used within EVVProvider");
  return ctx;
}

export function EVVProvider({ children }: { children: React.ReactNode }) {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    refreshSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeSession) { setElapsed(0); return; }
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(activeSession.clock_in).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const refreshSession = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase
      .from("time_entries")
      .select("*, clients(full_name)")
      .eq("created_by", user.id)
      .is("clock_out", null)
      .limit(1)
      .maybeSingle();

    if (data) {
      setActiveSession({
        id: data.id,
        client_id: data.client_id,
        client_name: (data.clients as any)?.full_name ?? "Unknown",
        location_name: data.location_name,
        location_id: data.location_id,
        clock_in: data.clock_in,
        start_lat: data.latitude,
        start_lon: data.longitude,
        geofence_verified: data.geofence_verified,
        start_time_adjusted: data.start_time_adjusted,
        start_adjustment_reason: data.start_adjustment_reason,
      });
    } else {
      setActiveSession(null);
    }
  }, []);

  return (
    <EVVContext.Provider value={{ activeSession, setActiveSession, refreshSession, elapsed }}>
      {children}
    </EVVContext.Provider>
  );
}