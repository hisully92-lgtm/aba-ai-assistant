import { useState } from "react";
import {
  View, Text, StyleSheet, Modal, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator, Alert
} from "react-native";
import * as Location from "expo-location";
import { supabase } from "../lib/supabase";
import { useEVV } from "../lib/EVVContext";

type Client = { id: string; full_name: string };
type ClientLocation = { id: string; name: string; address: string; city: string; state: string; latitude: number; longitude: number; is_primary: boolean };

const ADJUSTMENT_REASONS = [
  "App failed to open", "Forgot to start timer", "Client arrived early",
  "Started session before clocking in", "Technical issues", "Other",
];

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
  clients: Client[];
  companyId: string;
  userId: string;
};

type Step = "client" | "location" | "geofence" | "time" | "confirm";

export default function EVVClockIn({ visible, onClose, onComplete, clients, companyId, userId }: Props) {
  const { setActiveSession } = useEVV();
  const [step, setStep] = useState<Step>("client");
  const [saving, setSaving] = useState(false);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientLocations, setClientLocations] = useState<ClientLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<ClientLocation | null>(null);
  const [geofenceStatus, setGeofenceStatus] = useState<"checking" | "inside" | "outside" | "error">("checking");
  const [geofenceDistance, setGeofenceDistance] = useState<number | null>(null);
  const [currentLat, setCurrentLat] = useState<number | null>(null);
  const [currentLon, setCurrentLon] = useState<number | null>(null);
  const [locationChecking, setLocationChecking] = useState(false);
  const [startTime, setStartTime] = useState(new Date().toTimeString().slice(0, 5));
  const [startAdjusted, setStartAdjusted] = useState(false);
  const [startReason, setStartReason] = useState("");

  async function selectClient(client: Client) {
    setSelectedClient(client);
    const { data } = await supabase.from("client_locations").select("*")
      .eq("client_id", client.id).order("is_primary", { ascending: false });
    setClientLocations(data ?? []);
    setStep("location");
  }

  async function selectLocation(location: ClientLocation) {
    setSelectedLocation(location);
    setStep("geofence");
    setGeofenceStatus("checking");
    setLocationChecking(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setGeofenceStatus("error"); setLocationChecking(false); return; }
      const pos = await Location.getCurrentPositionAsync({});
      setCurrentLat(pos.coords.latitude);
      setCurrentLon(pos.coords.longitude);
      const dist = getDistanceMeters(pos.coords.latitude, pos.coords.longitude, location.latitude, location.longitude);
      setGeofenceDistance(Math.round(dist));
      setGeofenceStatus(dist <= 300 ? "inside" : "outside");
    } catch {
      setGeofenceStatus("error");
    }
    setLocationChecking(false);
  }

  async function confirmClockIn() {
    if (!selectedClient || !selectedLocation) return;
    setSaving(true);

    const clockInTime = new Date();
    if (startAdjusted) {
      const [h, m] = startTime.split(":").map(Number);
      clockInTime.setHours(h, m, 0, 0);
    }

    try {
      const { data } = await supabase.from("time_entries").insert({
        client_id: selectedClient.id,
        clock_in: clockInTime.toISOString(),
        session_type: "Direct Therapy",
        latitude: currentLat,
        longitude: currentLon,
        created_by: userId,
        location_id: selectedLocation.id,
        location_name: selectedLocation.name,
        geofence_verified: geofenceStatus === "inside",
        geofence_distance: geofenceDistance,
        evv_start_lat: currentLat,
        evv_start_lon: currentLon,
        start_time_adjusted: startAdjusted,
        start_adjustment_reason: startAdjusted ? startReason : null,
      }).select("*, clients(full_name)").single();

      if (data) {
        setActiveSession({
          id: data.id,
          client_id: data.client_id,
          client_name: (data.clients as any)?.full_name ?? selectedClient.full_name,
          location_name: data.location_name,
          location_id: data.location_id,
          clock_in: data.clock_in,
          start_lat: currentLat,
          start_lon: currentLon,
          geofence_verified: geofenceStatus === "inside",
          start_time_adjusted: startAdjusted,
          start_adjustment_reason: startAdjusted ? startReason : null,
        });
      }

      reset();
      onComplete();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
    setSaving(false);
  }

  function reset() {
    setStep("client");
    setSelectedClient(null);
    setSelectedLocation(null);
    setClientLocations([]);
    setGeofenceStatus("checking");
    setGeofenceDistance(null);
    setCurrentLat(null);
    setCurrentLon(null);
    setStartTime(new Date().toTimeString().slice(0, 5));
    setStartAdjusted(false);
    setStartReason("");
  }

  const stepIndex = (["client", "location", "geofence", "time", "confirm"] as Step[]).indexOf(step);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { reset(); onClose(); }} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Start Visit — EVV</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* PROGRESS */}
        <View style={styles.progress}>
          {[0, 1, 2, 3, 4].map(i => (
            <View key={i} style={[styles.progressDot, stepIndex === i && styles.progressDotActive, stepIndex > i && styles.progressDotDone]} />
          ))}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>

          {/* STEP 1 — CLIENT */}
          {step === "client" && (
            <>
              <Text style={styles.stepTitle}>👤 Select Client</Text>
              <Text style={styles.stepSub}>Who are you visiting today?</Text>
              {clients.length === 0 && <Text style={styles.empty}>No clients found.</Text>}
              {clients.map(c => (
                <TouchableOpacity key={c.id} style={styles.listRow} onPress={() => selectClient(c)}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{c.full_name.charAt(0)}</Text></View>
                  <Text style={styles.listRowText}>{c.full_name}</Text>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* STEP 2 — LOCATION */}
          {step === "location" && (
            <>
              <Text style={styles.stepTitle}>📍 Select Location</Text>
              <Text style={styles.stepSub}>{selectedClient?.full_name} — where is today's session?</Text>
              {clientLocations.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.empty}>No locations set up for this client.</Text>
                  <Text style={styles.emptySub}>Ask your BCBA to add locations in the web portal.</Text>
                </View>
              ) : (
                clientLocations.map(loc => (
                  <TouchableOpacity key={loc.id} style={styles.listRow} onPress={() => selectLocation(loc)}>
                    <Text style={styles.locationIcon}>{loc.is_primary ? "🏠" : "📍"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listRowText}>{loc.name}</Text>
                      <Text style={styles.listRowSub}>{loc.address}, {loc.city}, {loc.state}</Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                ))
              )}
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep("client")}>
                <Text style={styles.backBtnText}>‹ Back</Text>
              </TouchableOpacity>
            </>
          )}

          {/* STEP 3 — GEOFENCE */}
          {step === "geofence" && (
            <>
              <Text style={styles.stepTitle}>🛰️ Location Verification</Text>
              <Text style={styles.stepSub}>{selectedLocation?.name} — {selectedLocation?.address}</Text>

              <View style={styles.geofenceBox}>
                {locationChecking && <><ActivityIndicator color="#2563eb" size="large" /><Text style={styles.geofenceText}>Checking your location...</Text></>}
                {!locationChecking && geofenceStatus === "inside" && (
                  <>
                    <Text style={styles.geofenceEmoji}>✅</Text>
                    <Text style={[styles.geofenceText, { color: "#16a34a" }]}>You are at the session location</Text>
                    <Text style={styles.geofenceSub}>{geofenceDistance}m from address</Text>
                  </>
                )}
                {!locationChecking && geofenceStatus === "outside" && (
                  <>
                    <Text style={styles.geofenceEmoji}>⚠️</Text>
                    <Text style={[styles.geofenceText, { color: "#d97706" }]}>You are {geofenceDistance}m away</Text>
                    <Text style={styles.geofenceSub}>Outside 300m radius — you can still continue</Text>
                  </>
                )}
                {!locationChecking && geofenceStatus === "error" && (
                  <>
                    <Text style={styles.geofenceEmoji}>❌</Text>
                    <Text style={[styles.geofenceText, { color: "#dc2626" }]}>Could not verify location</Text>
                  </>
                )}
              </View>

              {!locationChecking && (
                <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep("time")}>
                  <Text style={styles.primaryBtnText}>
                    {geofenceStatus === "inside" ? "Continue →" : "Override & Continue →"}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep("location")}>
                <Text style={styles.backBtnText}>‹ Back</Text>
              </TouchableOpacity>
            </>
          )}

          {/* STEP 4 — START TIME */}
          {step === "time" && (
            <>
              <Text style={styles.stepTitle}>⏰ Confirm Start Time</Text>
              <Text style={styles.stepSub}>Verify or adjust when the session started</Text>

              <View style={styles.timeCard}>
                <Text style={styles.timeCardLabel}>Start Time</Text>
                <TextInput
                  style={styles.timeInput}
                  value={startTime}
                  onChangeText={t => { setStartTime(t); setStartAdjusted(true); }}
                  keyboardType="numbers-and-punctuation"
                />
                <Text style={styles.timeHint}>Current time: {new Date().toTimeString().slice(0, 5)}</Text>
              </View>

              {startAdjusted && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.fieldLabel}>Reason for adjustment *</Text>
                  {ADJUSTMENT_REASONS.map(r => (
                    <TouchableOpacity key={r}
                      style={[styles.reasonOption, startReason === r && styles.reasonOptionActive]}
                      onPress={() => setStartReason(r)}>
                      <Text style={[styles.reasonText, startReason === r && styles.reasonTextActive]}>{r}</Text>
                      {startReason === r && <Text style={{ color: "#2563eb" }}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep("confirm")}>
                <Text style={styles.primaryBtnText}>Continue →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep("geofence")}>
                <Text style={styles.backBtnText}>‹ Back</Text>
              </TouchableOpacity>
            </>
          )}

          {/* STEP 5 — CONFIRM */}
          {step === "confirm" && (
            <>
              <Text style={styles.stepTitle}>✅ Confirm Visit Start</Text>
              <Text style={styles.stepSub}>Review details before clocking in</Text>

              <View style={styles.confirmCard}>
                <Row label="Client" value={selectedClient?.full_name ?? ""} />
                <Row label="Location" value={selectedLocation?.name ?? ""} />
                <Row label="Address" value={`${selectedLocation?.address}, ${selectedLocation?.city}`} />
                <Row label="Start Time" value={`${startTime}${startAdjusted ? " ⚠️ Adjusted" : " ✓"}`} />
                {startAdjusted && startReason && <Row label="Reason" value={startReason} />}
                <Row
                  label="Geofence"
                  value={geofenceStatus === "inside" ? `✅ Verified (${geofenceDistance}m)` : geofenceStatus === "outside" ? `⚠️ Outside (${geofenceDistance}m)` : "— Not checked"}
                  valueColor={geofenceStatus === "inside" ? "#16a34a" : "#d97706"}
                />
              </View>

              <TouchableOpacity
                style={[styles.startBtn, saving && { opacity: 0.6 }]}
                onPress={confirmClockIn}
                disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.startBtnText}>▶ Start Visit</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep("time")}>
                <Text style={styles.backBtnText}>‹ Back</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.confirmRow}>
      <Text style={styles.confirmLabel}>{label}</Text>
      <Text style={[styles.confirmValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: { backgroundColor: "#1a2234", paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  closeBtnText: { color: "#fff", fontSize: 18 },
  progress: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#e5e7eb" },
  progressDotActive: { backgroundColor: "#2563eb", width: 24 },
  progressDotDone: { backgroundColor: "#16a34a" },
  stepTitle: { fontSize: 22, fontWeight: "800", color: "#111827", marginBottom: 6 },
  stepSub: { fontSize: 14, color: "#6b7280", marginBottom: 24 },
  listRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "#e5e7eb", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 18 },
  listRowText: { flex: 1, fontSize: 15, fontWeight: "600", color: "#111827" },
  listRowSub: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  locationIcon: { fontSize: 24 },
  chevron: { fontSize: 24, color: "#d1d5db" },
  empty: { fontSize: 14, color: "#9ca3af", textAlign: "center", paddingVertical: 20 },
  emptySub: { fontSize: 12, color: "#d1d5db", textAlign: "center", marginTop: 4 },
  emptyBox: { alignItems: "center", paddingVertical: 20 },
  geofenceBox: { backgroundColor: "#fff", borderRadius: 16, padding: 24, alignItems: "center", marginBottom: 20, borderWidth: 1, borderColor: "#e5e7eb", gap: 8 },
  geofenceEmoji: { fontSize: 48 },
  geofenceText: { fontSize: 16, fontWeight: "700", color: "#111827", textAlign: "center" },
  geofenceSub: { fontSize: 13, color: "#6b7280", textAlign: "center" },
  timeCard: { backgroundColor: "#fff", borderRadius: 14, padding: 20, marginBottom: 16, alignItems: "center", borderWidth: 1, borderColor: "#e5e7eb" },
  timeCardLabel: { fontSize: 12, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", marginBottom: 12 },
  timeInput: { fontSize: 36, fontWeight: "900", color: "#111827", textAlign: "center", borderWidth: 0, padding: 0, fontVariant: ["tabular-nums"] },
  timeHint: { fontSize: 12, color: "#9ca3af", marginTop: 8 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5 },
  reasonOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 6, backgroundColor: "#fff" },
  reasonOptionActive: { backgroundColor: "#eff6ff", borderColor: "#2563eb" },
  reasonText: { fontSize: 13, color: "#374151" },
  reasonTextActive: { color: "#2563eb", fontWeight: "600" },
  confirmCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#e5e7eb", gap: 8 },
  confirmRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f9fafb" },
  confirmLabel: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  confirmValue: { fontSize: 13, fontWeight: "600", color: "#111827", flex: 1, textAlign: "right" },
  primaryBtn: { backgroundColor: "#2563eb", paddingVertical: 16, borderRadius: 14, alignItems: "center", marginBottom: 10 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  startBtn: { backgroundColor: "#16a34a", paddingVertical: 16, borderRadius: 14, alignItems: "center", marginBottom: 10 },
  startBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  backBtn: { paddingVertical: 12, alignItems: "center" },
  backBtnText: { color: "#6b7280", fontSize: 14 },
});