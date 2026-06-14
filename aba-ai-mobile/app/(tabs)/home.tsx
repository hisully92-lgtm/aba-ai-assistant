import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Modal,
  TouchableOpacity, Alert, ActivityIndicator, TextInput
} from "react-native";
import * as Location from "expo-location";
import { supabase } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";
import { getCachedClients } from "../../lib/offline";
import { router } from "expo-router";
import EVVClockIn from "../../components/EVVClockIn";
import { useEVV } from "../../lib/EVVContext";
import EVVClockOut from "../../components/EVVClockOut";

type Client = { id: string; full_name: string };
type ClientLocation = { id: string; name: string; address: string; city: string; state: string; latitude: number; longitude: number; is_primary: boolean };
type TimeEntry = { id: string; clock_in: string; clock_out: string | null; session_type: string; client_id: string | null; location_name: string | null };
type ScheduleEntry = {
  id: string;
  client_id: string;
  client_initials: string;
  start_time: string;
  end_time: string;
  session_type: string;
  address: string | null;
  is_telehealth: boolean;
  status: string;
};

const ADJUSTMENT_REASONS = [
  "App failed to open", "Forgot to start timer", "Forgot to end timer",
  "Client arrived late", "Session ran over", "Technical issues", "Other",
];

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function HomeScreen() {
  // ✅ Hooks called inside the component
  const { activeSession, elapsed, refreshSession } = useEVV();
  const [showEVVClockIn, setShowEVVClockIn] = useState(false);
  const [showEVVClockOut, setShowEVVClockOut] = useState(false);
    const [todaySchedule, setTodaySchedule] = useState<ScheduleEntry[]>([]);
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState("");
  const [userId, setUserId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [clockedIn, setClockedIn] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [todaySessions, setTodaySessions] = useState<any[]>([]);

  // CLOCK IN FLOW
  
  const [showClockInModal, setShowClockInModal] = useState(false);
  const [clockInStep, setClockInStep] = useState<"client" | "location" | "geofence" | "time" | "confirm">("client");
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

  // CLOCK OUT FLOW
  const [showClockOutModal, setShowClockOutModal] = useState(false);
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

    // Load clients
    let clientData: Client[] = [];
    try {
      const { data } = await supabase.from("clients").select("id, full_name")
        .eq("company_id", companyUser?.company_id);
      clientData = data ?? [];
    } catch {
      clientData = await getCachedClients();
    }
    setClients(clientData);

    // Load sessions, schedule, time entry
    let entryData = null;
    let sessionData: any[] = [];
    let scheduleData: any[] = [];
    try {
      const [{ data: entry }, { data: sessions }, { data: schedule }] = await Promise.all([
        supabase.from("time_entries").select("*")
          .eq("created_by", user.id).is("clock_out", null).limit(1).maybeSingle(),
        supabase.from("sessions").select("id, client_id, date, status, created_at")
          .eq("company_id", companyUser?.company_id).eq("date", today),
        supabase.from("schedule_entries").select("*")
          .eq("assigned_to", user.id).eq("date", today).order("start_time"),
      ]);
      entryData = entry;
      sessionData = sessions ?? [];
      scheduleData = schedule ?? [];
      console.log("Sessions:", sessions?.length, "Schedule:", schedule?.length);
    } catch (e) {
      console.log("Fetch error:", e);
    }

    setClockedIn(entryData ?? null);
    setTodaySessions(sessionData);
    setTodaySchedule(scheduleData);
    setLoading(false);
  }

  async function startClockInFlow() {
    setClockInStep("client");
    setSelectedClient(null);
    setSelectedLocation(null);
    setStartTime(new Date().toTimeString().slice(0, 5));
    setStartAdjusted(false);
    setStartReason("");
    setShowClockInModal(true);
  }

  async function selectClientForClockIn(client: Client) {
    setSelectedClient(client);
    const { data } = await supabase.from("client_locations").select("*")
      .eq("client_id", client.id).order("is_primary", { ascending: false });
    setClientLocations(data ?? []);
    setClockInStep("location");
  }

  async function selectLocation(location: ClientLocation) {
    setSelectedLocation(location);
    setClockInStep("geofence");
    setGeofenceStatus("checking");
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") { setGeofenceStatus("error"); return; }
    const pos = await Location.getCurrentPositionAsync({});
    const dist = getDistanceMeters(pos.coords.latitude, pos.coords.longitude, location.latitude, location.longitude);
    setCurrentCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    setGeofenceDistance(Math.round(dist));
    setGeofenceStatus(dist <= 300 ? "inside" : "outside");
  }

  async function confirmClockIn() {
    if (!selectedClient || !selectedLocation) return;
    setClockingIn(true);
    const clockInTime = new Date();
    if (startAdjusted) {
      const [h, m] = startTime.split(":").map(Number);
      clockInTime.setHours(h, m, 0, 0);
    }
    const { data } = await supabase.from("time_entries").insert({
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
    }).select().single();
    setShowClockInModal(false);
    setClockingIn(false);
  }

  async function confirmClockOut() {
    if (!clockedIn) return;
    setClockingOut(true);
    const clockOutTime = new Date();
    if (endAdjusted) {
      const [h, m] = endTime.split(":").map(Number);
      clockOutTime.setHours(h, m, 0, 0);
    }
    const duration = Math.floor((clockOutTime.getTime() - new Date(clockedIn.clock_in).getTime()) / 60000);
    await supabase.from("time_entries").update({
      clock_out: clockOutTime.toISOString(),
      duration_minutes: duration,
      end_time_adjusted: endAdjusted,
      end_adjustment_reason: endAdjusted ? endReason : null,
    }).eq("id", clockedIn.id);
    setClockedIn(null);
    setShowClockOutModal(false);
    setClockingOut(false);
    Alert.alert("Clocked out", `Session duration: ${Math.floor(duration / 60)}h ${duration % 60}m`);
    init();
  }

  function formatElapsed(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  const clientMap = new Map(clients.map(c => [c.id, c.full_name]));
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <AppHeader title="Home" />

      {/* GREETING */}
      <View style={styles.greetingCard}>
        <Text style={styles.greeting}>{greeting},</Text>
        <Text style={styles.name}>{userName || "Clinician"}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{role.toUpperCase()}</Text>
        </View>
      </View>

      {/* SESSION TIMER / EVV */}
<View style={styles.card}>
  <Text style={styles.cardTitle}>Visit Status</Text>
  {activeSession ? (
    <View style={styles.activeVisit}>
      <View style={styles.activeVisitHeader}>
        <View style={styles.activeDot} />
        <Text style={styles.activeVisitLabel}>Session in Progress</Text>
      </View>
      <Text style={styles.activeTimer}>{formatElapsed(elapsed)}</Text>
      <Text style={styles.activeClient}>👤 {activeSession.client_name}</Text>
      {activeSession.location_name && <Text style={styles.activeLocation}>📍 {activeSession.location_name}</Text>}
      <Text style={styles.activeStarted}>
        Started: {new Date(activeSession.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </Text>
      <TouchableOpacity style={styles.endVisitBtn} onPress={() => setShowEVVClockOut(true)}>
        <Text style={styles.endVisitBtnText}>⏹ End Visit (EVV)</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <View>
      <Text style={styles.noVisitText}>No active visit. Start your session below.</Text>
      <TouchableOpacity style={styles.startVisitBtn} onPress={() => setShowEVVClockIn(true)}>
        <Text style={styles.startVisitBtnText}>▶ Start Visit (EVV)</Text>
      </TouchableOpacity>
    </View>
  )}
</View>

<EVVClockIn
  visible={showEVVClockIn}
  onClose={() => setShowEVVClockIn(false)}
  onComplete={() => { setShowEVVClockIn(false); refreshSession(); init(); }}
  clients={clients}
  companyId={companyId}
  userId={userId}
/>

<EVVClockOut
  visible={showEVVClockOut}
  onClose={() => setShowEVVClockOut(false)}
  onComplete={() => { setShowEVVClockOut(false); init(); }}
  behaviorsCount={0}
  trialsCount={0}
/>

      {/* TODAY'S SCHEDULE */}
      {todaySchedule.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today's Schedule ({todaySchedule.length})</Text>
          {todaySchedule.map(s => (
            <View key={s.id} style={styles.scheduleRow}>
              <View style={styles.scheduleTime}>
                <Text style={styles.scheduleTimeText}>{s.start_time}</Text>
                <Text style={styles.scheduleTimeSub}>{s.end_time}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.scheduleClient}>{clientMap.get(s.client_id) ?? s.client_initials}</Text>
                <Text style={styles.scheduleMeta}>{s.session_type} {s.is_telehealth ? "📹" : "📍"}</Text>
                {s.address && <Text style={styles.scheduleAddr} numberOfLines={1}>{s.address}</Text>}
              </View>
              <View style={[styles.statusBadge, s.status === "completed" ? styles.statusGreen : styles.statusBlue]}>
                <Text style={styles.statusText}>{s.status}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* TODAY'S SESSIONS */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today's Sessions ({todaySessions.length})</Text>
        {todaySessions.length === 0 ? (
          <Text style={styles.empty}>No sessions recorded today.</Text>
        ) : (
          todaySessions.map(s => (
            <View key={s.id} style={styles.sessionRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sessionClient}>{clientMap.get(s.client_id) ?? "Unknown"}</Text>
                <Text style={styles.sessionMeta}>{s.date}</Text>
              </View>
              <View style={[styles.statusBadge, s.status === "completed" ? styles.statusGreen : styles.statusYellow]}>
                <Text style={styles.statusText}>{s.status}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* QUICK ACTIONS */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          {[
            { emoji: "📋", label: "New Session", action: () => router.push("/(tabs)/session") },
            { emoji: "📊", label: "Log Behavior", action: () => router.push("/(tabs)/session") },
            { emoji: "🎯", label: "Log Trial", action: () => router.push("/(tabs)/session") },
            { emoji: "💬", label: "Team Chat", action: () => router.push("/(tabs)/chat") },
          ].map(item => (
            <TouchableOpacity key={item.label} style={styles.quickItem} onPress={item.action}>
              <Text style={styles.quickEmoji}>{item.emoji}</Text>
              <Text style={styles.quickLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* CLOCK IN MODAL */}
      <Modal visible={showClockInModal} animationType="slide" transparent onRequestClose={() => setShowClockInModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalPanel}>
            {clockInStep === "client" && (
              <>
                <Text style={styles.modalTitle}>Select Client</Text>
                <Text style={styles.modalSub}>Who are you having a session with?</Text>
                <ScrollView style={{ maxHeight: 400 }}>
                  {clients.length === 0 && <Text style={styles.modalEmpty}>No clients found.</Text>}
                  {clients.map(c => (
                    <TouchableOpacity key={c.id} style={styles.modalRow} onPress={() => selectClientForClockIn(c)}>
                      <View style={styles.modalAvatar}><Text style={styles.modalAvatarText}>{c.full_name.charAt(0)}</Text></View>
                      <Text style={styles.modalRowText}>{c.full_name}</Text>
                      <Text style={styles.modalChevron}>›</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setShowClockInModal(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}

            {clockInStep === "location" && (
              <>
                <Text style={styles.modalTitle}>Select Location</Text>
                <Text style={styles.modalSub}>{selectedClient?.full_name} — where is the session?</Text>
                <ScrollView style={{ maxHeight: 400 }}>
                  {clientLocations.length === 0 ? (
                    <Text style={styles.modalEmpty}>No locations set up for this client.</Text>
                  ) : (
                    clientLocations.map(loc => (
                      <TouchableOpacity key={loc.id} style={styles.modalRow} onPress={() => selectLocation(loc)}>
                        <View style={styles.modalLocationIcon}>
                          <Text style={{ fontSize: 20 }}>{loc.is_primary ? "🏠" : "📍"}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.modalRowText}>{loc.name}</Text>
                          <Text style={styles.modalRowSub}>{loc.address}, {loc.city}</Text>
                        </View>
                        <Text style={styles.modalChevron}>›</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
                <TouchableOpacity style={styles.modalBack} onPress={() => setClockInStep("client")}>
                  <Text style={styles.modalBackText}>‹ Back</Text>
                </TouchableOpacity>
              </>
            )}

            {clockInStep === "geofence" && (
              <>
                <Text style={styles.modalTitle}>Location Check</Text>
                <Text style={styles.modalSub}>{selectedLocation?.name} — {selectedLocation?.address}</Text>
                <View style={styles.geofenceBox}>
                  {geofenceStatus === "checking" && <><ActivityIndicator color="#2563eb" size="large" /><Text style={styles.geofenceText}>Checking your location...</Text></>}
                  {geofenceStatus === "inside" && <><Text style={styles.geofenceEmoji}>✅</Text><Text style={[styles.geofenceText, { color: "#16a34a" }]}>You are at the session location</Text><Text style={styles.geofenceDist}>{geofenceDistance}m from address</Text></>}
                  {geofenceStatus === "outside" && <><Text style={styles.geofenceEmoji}>⚠️</Text><Text style={[styles.geofenceText, { color: "#d97706" }]}>You are {geofenceDistance}m away</Text><Text style={styles.geofenceDist}>Must be within 300m to clock in</Text></>}
                  {geofenceStatus === "error" && <><Text style={styles.geofenceEmoji}>❌</Text><Text style={[styles.geofenceText, { color: "#dc2626" }]}>Location access denied</Text></>}
                </View>
                <View style={styles.modalBtns}>
                  {(geofenceStatus === "inside" || geofenceStatus === "outside") && (
                    <TouchableOpacity style={styles.modalPrimary} onPress={() => setClockInStep("time")}>
                      <Text style={styles.modalPrimaryText}>{geofenceStatus === "inside" ? "Continue →" : "Override & Continue →"}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.modalBack} onPress={() => setClockInStep("location")}>
                    <Text style={styles.modalBackText}>‹ Back</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {clockInStep === "time" && (
              <>
                <Text style={styles.modalTitle}>Start Time</Text>
                <Text style={styles.modalSub}>Confirm or adjust your session start time</Text>
                <View style={styles.timeBox}>
                  <Text style={styles.timeLabel}>Start Time</Text>
                  <TextInput style={styles.timeInput} value={startTime}
                    onChangeText={t => { setStartTime(t); setStartAdjusted(true); }}
                    placeholder="HH:MM" keyboardType="numbers-and-punctuation" />
                  <Text style={styles.timeHint}>Current time: {new Date().toTimeString().slice(0, 5)}</Text>
                </View>
                {startAdjusted && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.timeLabel}>Reason for adjustment</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                      {ADJUSTMENT_REASONS.map(r => (
                        <TouchableOpacity key={r} style={[styles.reasonChip, startReason === r && styles.reasonChipActive]} onPress={() => setStartReason(r)}>
                          <Text style={[styles.reasonChipText, startReason === r && styles.reasonChipTextActive]}>{r}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
                <View style={styles.modalBtns}>
                  <TouchableOpacity style={styles.modalPrimary} onPress={() => setClockInStep("confirm")}>
                    <Text style={styles.modalPrimaryText}>Continue →</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalBack} onPress={() => setClockInStep("geofence")}>
                    <Text style={styles.modalBackText}>‹ Back</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {clockInStep === "confirm" && (
              <>
                <Text style={styles.modalTitle}>Confirm Clock In</Text>
                <View style={styles.confirmBox}>
                  <View style={styles.confirmRow}><Text style={styles.confirmLabel}>Client</Text><Text style={styles.confirmValue}>{selectedClient?.full_name}</Text></View>
                  <View style={styles.confirmRow}><Text style={styles.confirmLabel}>Location</Text><Text style={styles.confirmValue}>{selectedLocation?.name}</Text></View>
                  <View style={styles.confirmRow}><Text style={styles.confirmLabel}>Address</Text><Text style={styles.confirmValue}>{selectedLocation?.address}, {selectedLocation?.city}</Text></View>
                  <View style={styles.confirmRow}><Text style={styles.confirmLabel}>Start Time</Text><Text style={styles.confirmValue}>{startTime} {startAdjusted ? "⚠️ Adjusted" : "✓"}</Text></View>
                  {startAdjusted && startReason && <View style={styles.confirmRow}><Text style={styles.confirmLabel}>Reason</Text><Text style={styles.confirmValue}>{startReason}</Text></View>}
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmLabel}>Geofence</Text>
                    <Text style={[styles.confirmValue, { color: geofenceStatus === "inside" ? "#16a34a" : "#d97706" }]}>
                      {geofenceStatus === "inside" ? `✓ Verified (${geofenceDistance}m)` : `⚠️ Outside (${geofenceDistance}m)`}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={[styles.modalPrimary, clockingIn && { opacity: 0.6 }]} onPress={confirmClockIn} disabled={clockingIn}>
                  {clockingIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalPrimaryText}>✓ Clock In</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalBack} onPress={() => setClockInStep("time")}>
                  <Text style={styles.modalBackText}>‹ Back</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* CLOCK OUT MODAL */}
      <Modal visible={showClockOutModal} animationType="slide" transparent onRequestClose={() => setShowClockOutModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalPanel}>
            <Text style={styles.modalTitle}>Clock Out</Text>
            <Text style={styles.modalSub}>Session with {clientMap.get(clockedIn?.client_id ?? "") ?? "Unknown"}</Text>
            <View style={styles.timeBox}>
              <Text style={styles.timeLabel}>End Time</Text>
              <TextInput style={styles.timeInput} value={endTime}
                onChangeText={t => { setEndTime(t); setEndAdjusted(true); }}
                placeholder="HH:MM" keyboardType="numbers-and-punctuation" />
              <Text style={styles.timeHint}>Current time: {new Date().toTimeString().slice(0, 5)}</Text>
            </View>
            {endAdjusted && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.timeLabel}>Reason for adjustment</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  {ADJUSTMENT_REASONS.map(r => (
                    <TouchableOpacity key={r} style={[styles.reasonChip, endReason === r && styles.reasonChipActive]} onPress={() => setEndReason(r)}>
                      <Text style={[styles.reasonChipText, endReason === r && styles.reasonChipTextActive]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            <TouchableOpacity style={[styles.clockOutConfirmBtn, clockingOut && { opacity: 0.6 }]} onPress={confirmClockOut} disabled={clockingOut}>
              {clockingOut ? <ActivityIndicator color="#fff" /> : <Text style={styles.clockOutConfirmText}>⏹ Confirm Clock Out</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowClockOutModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
    endVisitBtn: { marginTop: 14, backgroundColor: "#dc2626", paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, alignItems: "center", width: "100%" },
    endVisitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  greetingCard: { backgroundColor: "#1a2234", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  greeting: { fontSize: 14, color: "#94a3b8" },
  name: { fontSize: 26, fontWeight: "800", color: "#fff", marginTop: 2 },
  roleBadge: { marginTop: 8, backgroundColor: "#2563eb", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  roleText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  card: { margin: 16, marginBottom: 0, backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 14 },
  timer: { fontSize: 52, fontWeight: "900", color: "#2563eb", fontVariant: ["tabular-nums"] },
  timerSub: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  clockOutBtn: { marginTop: 16, backgroundColor: "#dc2626", paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  clockOutText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  clockInBtn: { backgroundColor: "#2563eb", paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  clockInText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  scheduleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", gap: 10 },
  scheduleTime: { width: 48, alignItems: "center" },
  scheduleTimeText: { fontSize: 13, fontWeight: "700", color: "#111827" },
  scheduleTimeSub: { fontSize: 10, color: "#9ca3af" },
  scheduleClient: { fontSize: 14, fontWeight: "600", color: "#111827" },
  scheduleMeta: { fontSize: 12, color: "#6b7280", marginTop: 1 },
  scheduleAddr: { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  sessionRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  sessionClient: { fontSize: 14, fontWeight: "600", color: "#111827" },
  sessionMeta: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusGreen: { backgroundColor: "#dcfce7" },
  statusYellow: { backgroundColor: "#fef9c3" },
  statusBlue: { backgroundColor: "#eff6ff" },
  statusText: { fontSize: 11, fontWeight: "600", color: "#374151" },
  empty: { fontSize: 13, color: "#9ca3af", textAlign: "center", paddingVertical: 16 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickItem: { width: "47%", backgroundColor: "#f9fafb", borderRadius: 12, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#f3f4f6" },
  quickEmoji: { fontSize: 28, marginBottom: 6 },
  quickLabel: { fontSize: 12, fontWeight: "600", color: "#374151", textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalPanel: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: "85%" },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#111827", marginBottom: 4 },
  modalSub: { fontSize: 13, color: "#6b7280", marginBottom: 16 },
  modalRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", gap: 12 },
  modalAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center" },
  modalAvatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  modalLocationIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  modalRowText: { flex: 1, fontSize: 15, fontWeight: "600", color: "#111827" },
  modalRowSub: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  modalChevron: { fontSize: 22, color: "#d1d5db" },
  modalEmpty: { textAlign: "center", color: "#9ca3af", paddingVertical: 20, fontSize: 14 },
  modalBtns: { marginTop: 16, gap: 8 },
  modalPrimary: { backgroundColor: "#2563eb", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  modalPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  modalBack: { paddingVertical: 12, alignItems: "center" },
  modalBackText: { color: "#6b7280", fontSize: 14 },
  modalCancel: { paddingVertical: 12, alignItems: "center", marginTop: 8 },
  modalCancelText: { color: "#dc2626", fontSize: 14, fontWeight: "600" },
  geofenceBox: { alignItems: "center", paddingVertical: 24, backgroundColor: "#f9fafb", borderRadius: 16, marginBottom: 8 },
  geofenceEmoji: { fontSize: 48, marginBottom: 12 },
  geofenceText: { fontSize: 16, fontWeight: "700", color: "#111827", textAlign: "center" },
  geofenceDist: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  timeBox: { backgroundColor: "#f9fafb", borderRadius: 12, padding: 16, marginBottom: 8 },
  timeLabel: { fontSize: 12, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", marginBottom: 8 },
  timeInput: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, fontSize: 24, fontWeight: "700", color: "#111827", textAlign: "center" },
  timeHint: { fontSize: 11, color: "#9ca3af", marginTop: 6, textAlign: "center" },
  reasonChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#fff", marginRight: 8 },
  reasonChipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  reasonChipText: { fontSize: 12, color: "#374151" },
  reasonChipTextActive: { color: "#fff", fontWeight: "600" },
  confirmBox: { backgroundColor: "#f9fafb", borderRadius: 12, padding: 16, marginBottom: 16, gap: 10 },
  confirmRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  confirmLabel: { fontSize: 12, color: "#6b7280", fontWeight: "600", flex: 1 },
  confirmValue: { fontSize: 13, color: "#111827", fontWeight: "600", flex: 2, textAlign: "right" },
  clockOutConfirmBtn: { backgroundColor: "#dc2626", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 16 },
  clockOutConfirmText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  activeVisit: { alignItems: "center", paddingVertical: 8 },
activeVisitHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
activeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#16a34a" },
activeVisitLabel: { fontSize: 13, fontWeight: "600", color: "#16a34a" },
activeTimer: { fontSize: 52, fontWeight: "900", color: "#2563eb", fontVariant: ["tabular-nums"] },
activeClient: { fontSize: 15, fontWeight: "600", color: "#111827", marginTop: 4 },
activeLocation: { fontSize: 13, color: "#6b7280", marginTop: 2 },
activeStarted: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
activeHint: { fontSize: 11, color: "#9ca3af", marginTop: 8, textAlign: "center", fontStyle: "italic" },
noVisitText: { fontSize: 13, color: "#9ca3af", textAlign: "center", marginBottom: 14 },
startVisitBtn: { backgroundColor: "#16a34a", paddingVertical: 16, borderRadius: 14, alignItems: "center" },
startVisitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});