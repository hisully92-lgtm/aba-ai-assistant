"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useEVV } from "@/lib/mobileContext";
import AppShell from "@/components/app/AppShell";

type Client = { id: string; full_name: string };
type ClientLocation = { id: string; name: string; address: string; city: string; state: string; latitude: number; longitude: number; is_primary: boolean };
type ScheduleEntry = { id: string; client_id: string; client_initials: string; start_time: string; end_time: string; session_type: string; address: string | null; is_telehealth: boolean; status: string };

const ADJUSTMENT_REASONS = ["App failed to open", "Forgot to start timer", "Forgot to end timer", "Client arrived late", "Session ran over", "Technical issues", "Other"];

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmt(seconds: number) {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function HomePage() {
  const router = useRouter();
  const { activeSession, elapsed, refreshSession } = useEVV();

  const [userName, setUserName] = useState("");
  const [role, setRole] = useState("");
  const [userId, setUserId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [todaySessions, setTodaySessions] = useState<any[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<ScheduleEntry[]>([]);

  // CLOCK IN
  const [showClockIn, setShowClockIn] = useState(false);
  const [step, setStep] = useState<"client" | "location" | "geofence" | "time" | "confirm">("client");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientLocations, setClientLocations] = useState<ClientLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<ClientLocation | null>(null);
  const [geofenceStatus, setGeofenceStatus] = useState<"checking" | "inside" | "outside" | "error">("checking");
  const [geofenceDistance, setGeofenceDistance] = useState<number | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [startTime, setStartTime] = useState(new Date().toTimeString().slice(0, 5));
  const [startAdjusted, setStartAdjusted] = useState(false);
  const [startReason, setStartReason] = useState("");
  const [clockingIn, setClockingIn] = useState(false);

  // CLOCK OUT
  const [showClockOut, setShowClockOut] = useState(false);
  const [endTime, setEndTime] = useState(new Date().toTimeString().slice(0, 5));
  const [endAdjusted, setEndAdjusted] = useState(false);
  const [endReason, setEndReason] = useState("");
  const [clockingOut, setClockingOut] = useState(false);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const [{ data: profile }, { data: companyUser }] = await Promise.all([
      supabase.from("profiles").select("full_name, role").eq("id", user.id).single(),
      supabase.from("company_users").select("company_id, role").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle(),
    ]);

    setUserName(profile?.full_name ?? "");
    setRole(companyUser?.role ?? profile?.role ?? "");
    setCompanyId(companyUser?.company_id ?? "");

    const today = new Date().toISOString().split("T")[0];
    const { data: clientData } = await supabase.from("clients").select("id, full_name").eq("company_id", companyUser?.company_id);
    setClients(clientData ?? []);

    const [{ data: sessions }, { data: schedule }] = await Promise.all([
      supabase.from("sessions").select("id, client_id, date, status, created_at").eq("company_id", companyUser?.company_id).eq("date", today),
      supabase.from("schedule_entries").select("*").eq("assigned_to", user.id).eq("date", today).order("start_time"),
    ]);
    setTodaySessions(sessions ?? []);
    setTodaySchedule(schedule ?? []);
    setLoading(false);
  }

  function startClockInFlow() {
    setStep("client");
    setSelectedClient(null);
    setSelectedLocation(null);
    setStartTime(new Date().toTimeString().slice(0, 5));
    setStartAdjusted(false);
    setStartReason("");
    setShowClockIn(true);
  }

  async function selectClientForClockIn(client: Client) {
    setSelectedClient(client);
    const { data } = await supabase.from("client_locations").select("*").eq("client_id", client.id).order("is_primary", { ascending: false });
    setClientLocations(data ?? []);
    setStep("location");
  }

  function selectLocation(location: ClientLocation) {
    setSelectedLocation(location);
    setStep("geofence");
    setGeofenceStatus("checking");
    if (!navigator.geolocation) { setGeofenceStatus("error"); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const dist = getDistanceMeters(pos.coords.latitude, pos.coords.longitude, location.latitude, location.longitude);
        setCurrentCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGeofenceDistance(Math.round(dist));
        setGeofenceStatus(dist <= 300 ? "inside" : "outside");
      },
      () => setGeofenceStatus("error"),
      { enableHighAccuracy: true }
    );
  }

  async function confirmClockIn() {
    if (!selectedClient || !selectedLocation) return;
    setClockingIn(true);
    const clockInTime = new Date();
    if (startAdjusted) {
      const [h, m] = startTime.split(":").map(Number);
      clockInTime.setHours(h, m, 0, 0);
    }
    await supabase.from("time_entries").insert({
      client_id: selectedClient.id,
      clock_in: clockInTime.toISOString(),
      session_type: "Direct Therapy",
      latitude: currentCoords?.lat ?? null,
      longitude: currentCoords?.lon ?? null,
      created_by: userId,
      location_id: selectedLocation.id,
      location_name: selectedLocation.name,
      geofence_verified: geofenceStatus === "inside",
      geofence_distance: geofenceDistance,
      start_time_adjusted: startAdjusted,
      start_adjustment_reason: startAdjusted ? startReason : null,
    });
    setShowClockIn(false);
    setClockingIn(false);
    refreshSession();
    init();
  }

  async function confirmClockOut() {
    if (!activeSession) return;
    setClockingOut(true);
    const clockOutTime = new Date();
    if (endAdjusted) {
      const [h, m] = endTime.split(":").map(Number);
      clockOutTime.setHours(h, m, 0, 0);
    }
    const duration = Math.floor((clockOutTime.getTime() - new Date(activeSession.clock_in).getTime()) / 60000);
    await supabase.from("time_entries").update({
      clock_out: clockOutTime.toISOString(),
      duration_minutes: duration,
      end_time_adjusted: endAdjusted,
      end_adjustment_reason: endAdjusted ? endReason : null,
    }).eq("id", activeSession.id);
    setShowClockOut(false);
    setClockingOut(false);
    alert("Clocked out. Session duration: " + Math.floor(duration / 60) + "h " + (duration % 60) + "m");
    refreshSession();
    init();
  }

  const clientMap = new Map(clients.map(c => [c.id, c.full_name]));
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  if (loading) {
    return <AppShell title="Home"><div className="flex justify-center py-20"><p className="text-gray-400 text-sm">Loading...</p></div></AppShell>;
  }

  return (
    <AppShell title="Home">
      {/* GREETING */}
      <div className="px-6 pt-4 pb-6" style={{ backgroundColor: "#1a2234" }}>
        <p className="text-sm" style={{ color: "#94a3b8" }}>{greeting},</p>
        <p className="text-2xl font-extrabold text-white mt-0.5">{userName || "Clinician"}</p>
        <span className="inline-block mt-2 text-white text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: "#2563eb" }}>
          {role.toUpperCase()}
        </span>
      </div>

      {/* VISIT STATUS */}
      <div className="mx-4 mt-4 bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-sm font-bold text-gray-900 mb-3.5">Visit Status</p>
        {activeSession ? (
          <div className="flex flex-col items-center py-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#16a34a" }} />
              <span className="text-[13px] font-semibold" style={{ color: "#16a34a" }}>Session in Progress</span>
            </div>
            <p className="text-5xl font-black tabular-nums" style={{ color: "#2563eb" }}>{fmt(elapsed)}</p>
            <p className="text-[15px] font-semibold text-gray-900 mt-1">👤 {activeSession.client_name}</p>
            {activeSession.location_name && <p className="text-[13px] text-gray-500 mt-0.5">📍 {activeSession.location_name}</p>}
            <p className="text-xs text-gray-400 mt-0.5">
              Started: {new Date(activeSession.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
            <button onClick={() => setShowClockOut(true)} className="mt-3.5 w-full text-white font-bold py-3.5 rounded-xl" style={{ backgroundColor: "#dc2626" }}>
              ⏹ End Visit (EVV)
            </button>
          </div>
        ) : (
          <div>
            <p className="text-[13px] text-gray-400 text-center mb-3.5">No active visit. Start your session below.</p>
            <button onClick={startClockInFlow} className="w-full text-white font-bold py-4 rounded-xl" style={{ backgroundColor: "#16a34a" }}>
              ▶ Start Visit (EVV)
            </button>
          </div>
        )}
      </div>

      {/* TODAY'S SCHEDULE */}
      {todaySchedule.length > 0 && (
        <div className="mx-4 mt-4 bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-bold text-gray-900 mb-3.5">Today&apos;s Schedule ({todaySchedule.length})</p>
          {todaySchedule.map(s => (
            <div key={s.id} className="flex items-center gap-2.5 py-2.5 border-b border-gray-100 last:border-0">
              <div className="w-12 text-center">
                <p className="text-[13px] font-bold text-gray-900">{s.start_time}</p>
                <p className="text-[10px] text-gray-400">{s.end_time}</p>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{clientMap.get(s.client_id) ?? s.client_initials}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.session_type} {s.is_telehealth ? "📹" : "📍"}</p>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: s.status === "completed" ? "#dcfce7" : "#eff6ff", color: "#374151" }}>
                {s.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* TODAY'S SESSIONS */}
      <div className="mx-4 mt-4 bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-sm font-bold text-gray-900 mb-3.5">Today&apos;s Sessions ({todaySessions.length})</p>
        {todaySessions.length === 0 ? (
          <p className="text-[13px] text-gray-400 text-center py-4">No sessions recorded today.</p>
        ) : (
          todaySessions.map(s => (
            <div key={s.id} className="flex items-center py-2.5 border-b border-gray-100 last:border-0">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{clientMap.get(s.client_id) ?? "Unknown"}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.date}</p>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: s.status === "completed" ? "#dcfce7" : "#fef9c3", color: "#374151" }}>
                {s.status}
              </span>
            </div>
          ))
        )}
      </div>

      {/* QUICK ACTIONS */}
      <div className="mx-4 mt-4 mb-4 bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-sm font-bold text-gray-900 mb-3.5">Quick Actions</p>
        <div className="flex flex-wrap gap-2.5">
          {[
            { emoji: "📋", label: "New Session", path: "/app/session" },
            { emoji: "📊", label: "Log Behavior", path: "/app/session" },
            { emoji: "🎯", label: "Log Trial", path: "/app/session" },
            { emoji: "💬", label: "Team Chat", path: "/app/chat" },
          ].map(item => (
            <button key={item.label} onClick={() => router.push(item.path)}
              className="flex-1 min-w-[47%] flex flex-col items-center bg-gray-50 border border-gray-100 rounded-xl py-4">
              <span className="text-2xl mb-1.5">{item.emoji}</span>
              <span className="text-xs font-semibold text-gray-700 text-center">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* CLOCK IN MODAL */}
      {showClockIn && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="w-full bg-white rounded-t-3xl p-6 pb-10 max-h-[85vh] overflow-y-auto">
            {step === "client" && (
              <>
                <p className="text-xl font-extrabold text-gray-900">Select Client</p>
                <p className="text-[13px] text-gray-500 mb-4">Who are you having a session with?</p>
                <div className="max-h-96 overflow-y-auto">
                  {clients.length === 0 && <p className="text-center text-gray-400 py-5">No clients found.</p>}
                  {clients.map(c => (
                    <button key={c.id} onClick={() => selectClientForClockIn(c)} className="flex items-center gap-3 py-3.5 border-b border-gray-100 w-full text-left">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: "#2563eb" }}>{c.full_name.charAt(0)}</div>
                      <span className="flex-1 text-[15px] font-semibold text-gray-900">{c.full_name}</span>
                      <span className="text-gray-300 text-xl">›</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowClockIn(false)} className="w-full py-3 text-red-600 font-semibold mt-2">Cancel</button>
              </>
            )}

            {step === "location" && (
              <>
                <p className="text-xl font-extrabold text-gray-900">Select Location</p>
                <p className="text-[13px] text-gray-500 mb-4">{selectedClient?.full_name} — where is the session?</p>
                <div className="max-h-96 overflow-y-auto">
                  {clientLocations.length === 0 ? (
                    <p className="text-center text-gray-400 py-5">No locations set up for this client.</p>
                  ) : clientLocations.map(loc => (
                    <button key={loc.id} onClick={() => selectLocation(loc)} className="flex items-center gap-3 py-3.5 border-b border-gray-100 w-full text-left">
                      <span className="text-xl w-10 text-center">{loc.is_primary ? "🏠" : "📍"}</span>
                      <div className="flex-1">
                        <p className="text-[15px] font-semibold text-gray-900">{loc.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{loc.address}, {loc.city}</p>
                      </div>
                      <span className="text-gray-300 text-xl">›</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => setStep("client")} className="w-full py-3 text-gray-500 mt-2">‹ Back</button>
              </>
            )}

            {step === "geofence" && (
              <>
                <p className="text-xl font-extrabold text-gray-900">Location Check</p>
                <p className="text-[13px] text-gray-500 mb-4">{selectedLocation?.name} — {selectedLocation?.address}</p>
                <div className="flex flex-col items-center py-6 bg-gray-50 rounded-2xl mb-2">
                  {geofenceStatus === "checking" && <p className="text-sm text-gray-500">Checking your location...</p>}
                  {geofenceStatus === "inside" && <><p className="text-5xl mb-3">✅</p><p className="text-base font-bold" style={{ color: "#16a34a" }}>You are at the session location</p><p className="text-[13px] text-gray-500 mt-1">{geofenceDistance}m from address</p></>}
                  {geofenceStatus === "outside" && <><p className="text-5xl mb-3">⚠️</p><p className="text-base font-bold" style={{ color: "#d97706" }}>You are {geofenceDistance}m away</p><p className="text-[13px] text-gray-500 mt-1">Must be within 300m to clock in</p></>}
                  {geofenceStatus === "error" && <><p className="text-5xl mb-3">❌</p><p className="text-base font-bold" style={{ color: "#dc2626" }}>Location access denied</p></>}
                </div>
                {(geofenceStatus === "inside" || geofenceStatus === "outside") && (
                  <button onClick={() => setStep("time")} className="w-full text-white font-bold py-3.5 rounded-xl mb-2" style={{ backgroundColor: "#2563eb" }}>
                    {geofenceStatus === "inside" ? "Continue →" : "Override & Continue →"}
                  </button>
                )}
                <button onClick={() => setStep("location")} className="w-full py-3 text-gray-500">‹ Back</button>
              </>
            )}

            {step === "time" && (
              <>
                <p className="text-xl font-extrabold text-gray-900">Start Time</p>
                <p className="text-[13px] text-gray-500 mb-4">Confirm or adjust your session start time</p>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">Start Time</p>
                  <input value={startTime} onChange={e => { setStartTime(e.target.value); setStartAdjusted(true); }}
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-2xl font-bold text-center" placeholder="HH:MM" />
                  <p className="text-[11px] text-gray-400 text-center mt-1.5">Current time: {new Date().toTimeString().slice(0, 5)}</p>
                </div>
                {startAdjusted && (
                  <div className="mt-3">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Reason for adjustment</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {ADJUSTMENT_REASONS.map(r => (
                        <button key={r} onClick={() => setStartReason(r)}
                          className="px-3 py-2 rounded-full border text-xs whitespace-nowrap"
                          style={startReason === r ? { backgroundColor: "#2563eb", borderColor: "#2563eb", color: "#fff" } : { borderColor: "#d1d5db", color: "#374151" }}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={() => setStep("confirm")} className="w-full text-white font-bold py-3.5 rounded-xl mt-4 mb-2" style={{ backgroundColor: "#2563eb" }}>Continue →</button>
                <button onClick={() => setStep("geofence")} className="w-full py-3 text-gray-500">‹ Back</button>
              </>
            )}

            {step === "confirm" && (
              <>
                <p className="text-xl font-extrabold text-gray-900 mb-4">Confirm Clock In</p>
                <div className="bg-gray-50 rounded-xl p-4 space-y-2.5 mb-4">
                  <div className="flex justify-between"><span className="text-xs font-semibold text-gray-500">Client</span><span className="text-[13px] font-semibold text-gray-900">{selectedClient?.full_name}</span></div>
                  <div className="flex justify-between"><span className="text-xs font-semibold text-gray-500">Location</span><span className="text-[13px] font-semibold text-gray-900">{selectedLocation?.name}</span></div>
                  <div className="flex justify-between"><span className="text-xs font-semibold text-gray-500">Address</span><span className="text-[13px] font-semibold text-gray-900 text-right">{selectedLocation?.address}, {selectedLocation?.city}</span></div>
                  <div className="flex justify-between"><span className="text-xs font-semibold text-gray-500">Start Time</span><span className="text-[13px] font-semibold text-gray-900">{startTime} {startAdjusted ? "⚠️ Adjusted" : "✓"}</span></div>
                  {startAdjusted && startReason && <div className="flex justify-between"><span className="text-xs font-semibold text-gray-500">Reason</span><span className="text-[13px] font-semibold text-gray-900">{startReason}</span></div>}
                  <div className="flex justify-between">
                    <span className="text-xs font-semibold text-gray-500">Geofence</span>
                    <span className="text-[13px] font-semibold" style={{ color: geofenceStatus === "inside" ? "#16a34a" : "#d97706" }}>
                      {geofenceStatus === "inside" ? "✓ Verified (" + geofenceDistance + "m)" : "⚠️ Outside (" + geofenceDistance + "m)"}
                    </span>
                  </div>
                </div>
                <button onClick={confirmClockIn} disabled={clockingIn} className="w-full text-white font-bold py-3.5 rounded-xl disabled:opacity-60" style={{ backgroundColor: "#2563eb" }}>
                  {clockingIn ? "..." : "✓ Clock In"}
                </button>
                <button onClick={() => setStep("time")} className="w-full py-3 text-gray-500">‹ Back</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* CLOCK OUT MODAL */}
      {showClockOut && activeSession && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="w-full bg-white rounded-t-3xl p-6 pb-10">
            <p className="text-xl font-extrabold text-gray-900">Clock Out</p>
            <p className="text-[13px] text-gray-500 mb-4">Session with {activeSession.client_name}</p>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">End Time</p>
              <input value={endTime} onChange={e => { setEndTime(e.target.value); setEndAdjusted(true); }}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-2xl font-bold text-center" placeholder="HH:MM" />
              <p className="text-[11px] text-gray-400 text-center mt-1.5">Current time: {new Date().toTimeString().slice(0, 5)}</p>
            </div>
            {endAdjusted && (
              <div className="mt-3">
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Reason for adjustment</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {ADJUSTMENT_REASONS.map(r => (
                    <button key={r} onClick={() => setEndReason(r)}
                      className="px-3 py-2 rounded-full border text-xs whitespace-nowrap"
                      style={endReason === r ? { backgroundColor: "#2563eb", borderColor: "#2563eb", color: "#fff" } : { borderColor: "#d1d5db", color: "#374151" }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button onClick={confirmClockOut} disabled={clockingOut} className="w-full text-white font-bold py-3.5 rounded-xl mt-4 disabled:opacity-60" style={{ backgroundColor: "#dc2626" }}>
              {clockingOut ? "..." : "⏹ Confirm Clock Out"}
            </button>
            <button onClick={() => setShowClockOut(false)} className="w-full py-3 text-red-600 font-semibold mt-1">Cancel</button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
