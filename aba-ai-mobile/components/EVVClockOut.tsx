import { useState, useRef } from "react";
import {
  View, Text, StyleSheet, Modal, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator, Alert, Switch
} from "react-native";
import * as Location from "expo-location";
import SignatureCanvas from "react-native-signature-canvas";
import { supabase } from "../lib/supabase";
import { useEVV } from "../lib/EVVContext";

const GUARDIAN_UNAVAILABLE_REASONS = [
  "Parent/Guardian not present",
  "Parent/Guardian refused to sign",
  "App technical failure",
  "Language barrier",
  "Child only — no guardian required",
  "Telehealth session",
  "Other",
];

const END_TIME_REASONS = [
  "App failed to open",
  "Forgot to end session",
  "Session ran over",
  "Technical issues",
  "Other",
];

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmt(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
  behaviorsCount: number;
  trialsCount: number;
};

type Step = "location" | "time" | "summary" | "rbt_signature" | "guardian_signature" | "confirm";

export default function EVVClockOut({ visible, onClose, onComplete, behaviorsCount, trialsCount }: Props) {
  const { activeSession, setActiveSession, elapsed } = useEVV();
  const [step, setStep] = useState<Step>("location");
  const [saving, setSaving] = useState(false);

  // Location
  const [endLat, setEndLat] = useState<number | null>(null);
  const [endLon, setEndLon] = useState<number | null>(null);
  const [endGeofenceVerified, setEndGeofenceVerified] = useState(false);
  const [endDistance, setEndDistance] = useState<number | null>(null);
  const [locationChecking, setLocationChecking] = useState(false);
  const [locationChecked, setLocationChecked] = useState(false);

  // Time
  const [endTime, setEndTime] = useState(new Date().toTimeString().slice(0, 5));
  const [endAdjusted, setEndAdjusted] = useState(false);
  const [endReason, setEndReason] = useState("");
  const [endNotes, setEndNotes] = useState("");

  // Signatures
  const [rbtSignature, setRbtSignature] = useState<string | null>(null);
  const [guardianSignature, setGuardianSignature] = useState<string | null>(null);
  const [guardianUnavailable, setGuardianUnavailable] = useState(false);
  const [guardianUnavailableReason, setGuardianUnavailableReason] = useState("");
  const rbtSigRef = useRef<any>(null);
  const guardianSigRef = useRef<any>(null);

  async function checkEndLocation() {
    setLocationChecking(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location required", "Please allow location access.");
        setLocationChecking(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setEndLat(pos.coords.latitude);
      setEndLon(pos.coords.longitude);

      if (activeSession?.start_lat && activeSession?.start_lon) {
        const dist = getDistanceMeters(
          pos.coords.latitude, pos.coords.longitude,
          activeSession.start_lat, activeSession.start_lon
        );
        setEndDistance(Math.round(dist));
        setEndGeofenceVerified(dist <= 300);
      }
      setLocationChecked(true);
    } catch (e) {
      Alert.alert("Error", "Could not get location.");
    }
    setLocationChecking(false);
  }

  async function completeEVV() {
    if (!activeSession) return;
    if (!guardianUnavailable && !guardianSignature) {
      Alert.alert("Signature Required", "Please get the parent/guardian signature or mark them as unavailable.");
      return;
    }
    if (guardianUnavailable && !guardianUnavailableReason) {
      Alert.alert("Reason Required", "Please select a reason why the guardian could not sign.");
      return;
    }

    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const today = new Date().toISOString().split("T")[0];
    const endDateTime = new Date();
if (endAdjusted) {
  // supports "YYYY-MM-DD HH:MM" or "YYYY-MM-DDTHH:MM" or just "HH:MM"
  const dtMatch = endTime.match(/^(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2})$/);
  const timeMatch = endTime.match(/^(\d{2}):(\d{2})$/);
  if (dtMatch) {
    endDateTime.setFullYear(Number(dtMatch[1]), Number(dtMatch[2]) - 1, Number(dtMatch[3]));
    endDateTime.setHours(Number(dtMatch[4]), Number(dtMatch[5]), 0, 0);
  } else if (timeMatch) {
    endDateTime.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
  }
}

    const duration = Math.floor((endDateTime.getTime() - new Date(activeSession.clock_in).getTime()) / 60000);

    try {
      // Update time_entries with EVV data
      await supabase.from("time_entries").update({
        clock_out: endDateTime.toISOString(),
        duration_minutes: duration,
        evv_end_lat: endLat,
        evv_end_lon: endLon,
        evv_end_geofence_verified: endGeofenceVerified,
        evv_end_distance: endDistance,
        end_time_adjusted: endAdjusted,
        end_adjustment_reason: endAdjusted ? endReason : null,
        end_notes: endNotes || null,
        rbt_signature: rbtSignature,
        rbt_signed_at: rbtSignature ? new Date().toISOString() : null,
        guardian_signature: guardianSignature,
        guardian_signed_at: guardianSignature ? new Date().toISOString() : null,
        guardian_unavailable: guardianUnavailable,
        guardian_unavailable_reason: guardianUnavailable ? guardianUnavailableReason : null,
        evv_complete: true,
        evv_completed_at: new Date().toISOString(),
      }).eq("id", activeSession.id);

      // Create EVV record
      await supabase.from("evv_records").insert({
        company_id: (await supabase.from("company_users").select("company_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle()).data?.company_id,
        time_entry_id: activeSession.id,
        client_id: activeSession.client_id,
        rbt_id: user.id,
        date: today,
        actual_start: activeSession.clock_in,
        actual_end: endDateTime.toISOString(),
        start_lat: activeSession.start_lat,
        start_lon: activeSession.start_lon,
        start_geofence_verified: activeSession.geofence_verified,
        end_lat: endLat,
        end_lon: endLon,
        end_geofence_verified: endGeofenceVerified,
        end_geofence_distance: endDistance,
        start_time_adjusted: activeSession.start_time_adjusted,
        start_adjustment_reason: activeSession.start_adjustment_reason,
        end_time_adjusted: endAdjusted,
        end_adjustment_reason: endAdjusted ? endReason : null,
        rbt_signature: rbtSignature,
        rbt_signed_at: rbtSignature ? new Date().toISOString() : null,
        guardian_signature: guardianSignature,
        guardian_signed_at: guardianSignature ? new Date().toISOString() : null,
        guardian_unavailable: guardianUnavailable,
        guardian_unavailable_reason: guardianUnavailable ? guardianUnavailableReason : null,
        session_duration_minutes: duration,
        behaviors_recorded: behaviorsCount,
        trials_recorded: trialsCount,
        location_name: activeSession.location_name,
        evv_status: "complete",
      });

      setActiveSession(null);
      setSaving(false);
      onComplete();

      Alert.alert(
        "✅ Visit Complete",
        `EVV record saved.\nDuration: ${Math.floor(duration / 60)}h ${duration % 60}m\n\nYou can now submit a time entry for billing.`,
        [{ text: "OK" }]
      );
    } catch (e: any) {
      Alert.alert("Error", e.message);
      setSaving(false);
    }
  }

  function resetModal() {
    setStep("location");
    setLocationChecked(false);
    setEndLat(null); setEndLon(null);
    setEndGeofenceVerified(false); setEndDistance(null);
    setEndTime(new Date().toTimeString().slice(0, 5));
    setEndAdjusted(false); setEndReason(""); setEndNotes("");
    setRbtSignature(null); setGuardianSignature(null);
    setGuardianUnavailable(false); setGuardianUnavailableReason("");
  }

  if (!activeSession) return null;

  const startDt = new Date(activeSession.clock_in);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { resetModal(); onClose(); }} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>End Visit — EVV</Text>
          <View style={styles.headerRight} />
        </View>

        {/* PROGRESS STEPS */}
        <View style={styles.steps}>
          {(["location", "time", "summary", "rbt_signature", "guardian_signature", "confirm"] as Step[]).map((s, i) => (
            <View key={s} style={[styles.stepDot, step === s && styles.stepDotActive,
              (["location", "time", "summary", "rbt_signature", "guardian_signature", "confirm"] as Step[]).indexOf(step) > i && styles.stepDotDone]} />
          ))}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>

          {/* STEP 1 — END LOCATION */}
          {step === "location" && (
            <View>
              <Text style={styles.stepTitle}>📍 Verify End Location</Text>
              <Text style={styles.stepSubtitle}>Confirm you are at the session location</Text>

              <View style={styles.sessionInfo}>
                <Text style={styles.sessionInfoLabel}>Client</Text>
                <Text style={styles.sessionInfoValue}>{activeSession.client_name}</Text>
                <Text style={styles.sessionInfoLabel}>Location</Text>
                <Text style={styles.sessionInfoValue}>{activeSession.location_name ?? "Unknown"}</Text>
                <Text style={styles.sessionInfoLabel}>Duration</Text>
                <Text style={styles.sessionInfoValue}>{fmt(elapsed)}</Text>
              </View>

              {!locationChecked ? (
                <TouchableOpacity style={styles.primaryBtn} onPress={checkEndLocation} disabled={locationChecking}>
                  {locationChecking ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>📍 Check My Location</Text>}
                </TouchableOpacity>
              ) : (
                <View style={[styles.geofenceResult, endGeofenceVerified ? styles.geofenceOk : styles.geofenceWarn]}>
                  <Text style={styles.geofenceEmoji}>{endGeofenceVerified ? "✅" : "⚠️"}</Text>
                  <Text style={styles.geofenceText}>
                    {endGeofenceVerified
                      ? `Location verified — ${endDistance}m from session address`
                      : `You are ${endDistance}m from session address`}
                  </Text>
                </View>
              )}

              {locationChecked && (
                <TouchableOpacity style={[styles.primaryBtn, { marginTop: 16 }]} onPress={() => setStep("time")}>
                  <Text style={styles.primaryBtnText}>Continue →</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.skipBtn} onPress={() => setStep("time")}>
                <Text style={styles.skipBtnText}>Skip location check</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 2 — END TIME */}
{step === "time" && (
  <View>
    <Text style={styles.stepTitle}>⏱️ Confirm End Time</Text>
    <Text style={styles.stepSubtitle}>Verify or adjust the session end time</Text>

    <View style={styles.timeRow}>
      <View style={styles.timeBox}>
        <Text style={styles.timeBoxLabel}>Start</Text>
        <Text style={styles.timeBoxValue}>
          {startDt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
      <Text style={styles.timeArrow}>→</Text>
      <View style={styles.timeBox}>
        <Text style={styles.timeBoxLabel}>End</Text>
        <Text style={styles.timeBoxValue}>{endTime}</Text>
      </View>
    </View>

    <View style={styles.durationBox}>
      <Text style={styles.durationLabel}>Total Duration</Text>
      <Text style={styles.durationValue}>{fmt(elapsed)}</Text>
    </View>

    <TouchableOpacity
      style={styles.adjustBtn}
      onPress={() => setEndAdjusted(true)}>
      <Text style={styles.adjustBtnText}>✏️ Adjust Date & Time</Text>
    </TouchableOpacity>

    {endAdjusted && (
      <View style={styles.adjustBox}>
        <Text style={styles.fieldLabel}>Date & Time (YYYY-MM-DD HH:MM)</Text>
        <TextInput
          style={styles.dtInput}
          value={endTime}
          onChangeText={setEndTime}
          placeholder="2026-06-14 17:30"
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
        />
        <Text style={styles.dtHint}>Format: YYYY-MM-DD HH:MM (24hr)</Text>

        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Reason for time adjustment *</Text>
        {END_TIME_REASONS.map(r => (
          <TouchableOpacity key={r}
            style={[styles.reasonOption, endReason === r && styles.reasonOptionActive]}
            onPress={() => setEndReason(r)}>
            <Text style={[styles.reasonOptionText, endReason === r && styles.reasonOptionTextActive]}>{r}</Text>
            {endReason === r && <Text style={{ color: "#2563eb" }}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>
    )}

    <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Session Notes (optional)</Text>
    <TextInput style={styles.notesInput} value={endNotes}
      onChangeText={setEndNotes}
      placeholder="Any notes about the session ending..."
      multiline numberOfLines={3} textAlignVertical="top" />

    <TouchableOpacity
      style={[styles.primaryBtn, { marginTop: 8 }]}
      onPress={() => {
        if (endAdjusted && !endReason) {
          Alert.alert("Required", "Please select a reason for the time adjustment.");
          return;
        }
        setStep("summary");
      }}>
      <Text style={styles.primaryBtnText}>Continue →</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.backBtn} onPress={() => setStep("location")}>
      <Text style={styles.backBtnText}>‹ Back</Text>
    </TouchableOpacity>
  </View>
)}

          {/* STEP 3 — SESSION SUMMARY */}
          {step === "summary" && (
            <View>
              <Text style={styles.stepTitle}>📋 Session Summary</Text>
              <Text style={styles.stepSubtitle}>Review before signing</Text>

              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Client</Text>
                  <Text style={styles.summaryValue}>{activeSession.client_name}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Date</Text>
                  <Text style={styles.summaryValue}>{new Date().toLocaleDateString()}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Start Time</Text>
                  <Text style={styles.summaryValue}>
                    {startDt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {activeSession.start_time_adjusted && " ⚠️ Adjusted"}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>End Time</Text>
                  <Text style={styles.summaryValue}>
                    {endTime}
                    {endAdjusted && " ⚠️ Adjusted"}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Duration</Text>
                  <Text style={styles.summaryValue}>{fmt(elapsed)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Location</Text>
                  <Text style={styles.summaryValue}>
                    {activeSession.location_name}
                    {endGeofenceVerified ? " ✅" : locationChecked ? " ⚠️" : " —"}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Behaviors</Text>
                  <Text style={styles.summaryValue}>{behaviorsCount} recorded</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Trials</Text>
                  <Text style={styles.summaryValue}>{trialsCount} recorded</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep("rbt_signature")}>
                <Text style={styles.primaryBtnText}>Proceed to Signatures →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep("time")}>
                <Text style={styles.backBtnText}>‹ Back</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 4 — RBT SIGNATURE */}
          {step === "rbt_signature" && (
            <View>
              <Text style={styles.stepTitle}>✍️ RBT Signature</Text>
              <Text style={styles.stepSubtitle}>Sign to verify this visit occurred as documented</Text>

              <View style={styles.sigBox}>
                {rbtSignature ? (
                  <View style={styles.sigDone}>
                    <Text style={styles.sigDoneText}>✅ Signature captured</Text>
                    <TouchableOpacity onPress={() => setRbtSignature(null)}>
                      <Text style={styles.sigClearText}>Clear & redo</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ height: 200 }}>
                    <SignatureCanvas
                      ref={rbtSigRef}
                      onOK={(sig: string) => setRbtSignature(sig)}
                      onEmpty={() => {}}
                      descriptionText="Sign above"
                      clearText="Clear"
                      confirmText="Save Signature"
                      webStyle={`.m-signature-pad { box-shadow: none; border: 1px solid #e5e7eb; border-radius: 12px; } .m-signature-pad--body { border: none; }`}
                    />
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, !rbtSignature && styles.primaryBtnDisabled]}
                onPress={() => rbtSignature ? setStep("guardian_signature") : rbtSigRef.current?.readSignature()}
                disabled={false}>
                <Text style={styles.primaryBtnText}>{rbtSignature ? "Continue →" : "Save Signature"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep("summary")}>
                <Text style={styles.backBtnText}>‹ Back</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 5 — GUARDIAN SIGNATURE */}
          {step === "guardian_signature" && (
            <View>
              <Text style={styles.stepTitle}>✍️ Parent/Guardian Signature</Text>
              <Text style={styles.stepSubtitle}>Parent or guardian must sign to confirm visit</Text>

              <View style={styles.unavailableToggle}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.unavailableLabel}>Parent/Guardian unavailable to sign</Text>
                  <Text style={styles.unavailableSubLabel}>Check if they cannot sign right now</Text>
                </View>
                <Switch value={guardianUnavailable} onValueChange={setGuardianUnavailable} trackColor={{ true: "#dc2626" }} />
              </View>

              {guardianUnavailable ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.fieldLabel}>Reason guardian could not sign *</Text>
                  {GUARDIAN_UNAVAILABLE_REASONS.map(r => (
                    <TouchableOpacity key={r}
                      style={[styles.reasonOption, guardianUnavailableReason === r && styles.reasonOptionActive]}
                      onPress={() => setGuardianUnavailableReason(r)}>
                      <Text style={[styles.reasonOptionText, guardianUnavailableReason === r && styles.reasonOptionTextActive]}>{r}</Text>
                      {guardianUnavailableReason === r && <Text style={{ color: "#2563eb" }}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.sigBox}>
                  {guardianSignature ? (
                    <View style={styles.sigDone}>
                      <Text style={styles.sigDoneText}>✅ Signature captured</Text>
                      <TouchableOpacity onPress={() => setGuardianSignature(null)}>
                        <Text style={styles.sigClearText}>Clear & redo</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ height: 200 }}>
                      <SignatureCanvas
                        ref={guardianSigRef}
                        onOK={(sig: string) => setGuardianSignature(sig)}
                        onEmpty={() => {}}
                        descriptionText="Parent/Guardian signs above"
                        clearText="Clear"
                        confirmText="Save Signature"
                        webStyle={`.m-signature-pad { box-shadow: none; border: 1px solid #e5e7eb; border-radius: 12px; } .m-signature-pad--body { border: none; }`}
                      />
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, { marginTop: 16 },
                  (!guardianSignature && !guardianUnavailable) && styles.primaryBtnDisabled]}
                onPress={() => {
                  if (!guardianUnavailable && !guardianSignature) {
                    guardianSigRef.current?.readSignature();
                    return;
                  }
                  if (guardianUnavailable && !guardianUnavailableReason) {
                    Alert.alert("Required", "Please select a reason.");
                    return;
                  }
                  setStep("confirm");
                }}>
                <Text style={styles.primaryBtnText}>
                  {(!guardianSignature && !guardianUnavailable) ? "Save Signature" : "Continue →"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep("rbt_signature")}>
                <Text style={styles.backBtnText}>‹ Back</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 6 — CONFIRM & SUBMIT */}
          {step === "confirm" && (
            <View>
              <Text style={styles.stepTitle}>✅ Confirm & Submit EVV</Text>
              <Text style={styles.stepSubtitle}>This record will be locked after submission</Text>

              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>RBT Signature</Text>
                  <Text style={[styles.summaryValue, { color: "#16a34a" }]}>✅ Signed</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Guardian Signature</Text>
                  <Text style={[styles.summaryValue, { color: guardianSignature ? "#16a34a" : "#d97706" }]}>
                    {guardianSignature ? "✅ Signed" : `⚠️ ${guardianUnavailableReason}`}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>End Location</Text>
                  <Text style={[styles.summaryValue, { color: endGeofenceVerified ? "#16a34a" : "#d97706" }]}>
                    {endGeofenceVerified ? "✅ Verified" : locationChecked ? `⚠️ ${endDistance}m away` : "— Not checked"}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Duration</Text>
                  <Text style={styles.summaryValue}>{fmt(elapsed)}</Text>
                </View>
                {endAdjusted && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Time Adjusted</Text>
                    <Text style={[styles.summaryValue, { color: "#d97706" }]}>⚠️ {endReason}</Text>
                  </View>
                )}
              </View>

              <View style={styles.lockWarning}>
                <Text style={styles.lockWarningText}>
                  🔒 Once submitted, this EVV record cannot be modified. It will be stored as the official record of this visit.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, saving && { opacity: 0.6 }]}
                onPress={completeEVV}
                disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>✅ Submit EVV Record</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep("guardian_signature")}>
                <Text style={styles.backBtnText}>‹ Back</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
    adjustBtn: { backgroundColor: "#f3f4f6", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginBottom: 12 },
    adjustBtnText: { fontSize: 14, color: "#374151", fontWeight: "600" },
    adjustBox: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 8 },
    dtInput: { backgroundColor: "#f9fafb", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, fontWeight: "700", color: "#111827", textAlign: "center", marginBottom: 4 },
    dtHint: { fontSize: 12, color: "#9ca3af", textAlign: "center" },
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: { backgroundColor: "#1a2234", paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  closeBtnText: { color: "#fff", fontSize: 18 },
  headerRight: { width: 36 },
  steps: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#e5e7eb" },
  stepDotActive: { backgroundColor: "#2563eb", width: 24 },
  stepDotDone: { backgroundColor: "#16a34a" },
  stepTitle: { fontSize: 22, fontWeight: "800", color: "#111827", marginBottom: 6 },
  stepSubtitle: { fontSize: 14, color: "#6b7280", marginBottom: 24 },
  sessionInfo: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#e5e7eb" },
  sessionInfoLabel: { fontSize: 11, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", marginTop: 8 },
  sessionInfoValue: { fontSize: 16, fontWeight: "600", color: "#111827", marginTop: 2 },
  primaryBtn: { backgroundColor: "#2563eb", paddingVertical: 16, borderRadius: 14, alignItems: "center", marginBottom: 10 },
  primaryBtnDisabled: { backgroundColor: "#93c5fd" },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  skipBtn: { paddingVertical: 12, alignItems: "center" },
  skipBtnText: { color: "#9ca3af", fontSize: 14, textDecorationLine: "underline" },
  backBtn: { paddingVertical: 12, alignItems: "center" },
  backBtnText: { color: "#6b7280", fontSize: 14 },
  geofenceResult: { borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 16 },
  geofenceOk: { backgroundColor: "#f0fdf4" },
  geofenceWarn: { backgroundColor: "#fffbeb" },
  geofenceEmoji: { fontSize: 32, marginBottom: 8 },
  geofenceText: { fontSize: 14, fontWeight: "600", color: "#374151", textAlign: "center" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  timeBox: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#e5e7eb" },
  timeBoxLabel: { fontSize: 11, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", marginBottom: 6 },
  timeBoxValue: { fontSize: 20, fontWeight: "800", color: "#111827" },
  timeInput: { fontSize: 20, fontWeight: "800", color: "#111827", textAlign: "center", borderWidth: 0, padding: 0 },
  timeArrow: { fontSize: 20, color: "#9ca3af" },
  durationBox: { backgroundColor: "#eff6ff", borderRadius: 12, padding: 14, alignItems: "center", marginBottom: 20 },
  durationLabel: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  durationValue: { fontSize: 28, fontWeight: "900", color: "#2563eb", fontVariant: ["tabular-nums"] },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5 },
  reasonOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 6, backgroundColor: "#fff" },
  reasonOptionActive: { backgroundColor: "#eff6ff", borderColor: "#2563eb" },
  reasonOptionText: { fontSize: 13, color: "#374151" },
  reasonOptionTextActive: { color: "#2563eb", fontWeight: "600" },
  notesInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#111827", minHeight: 80, marginBottom: 16, backgroundColor: "#fff" },
  summaryCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#e5e7eb", gap: 8 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#f9fafb" },
  summaryLabel: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  summaryValue: { fontSize: 13, fontWeight: "600", color: "#111827", flex: 1, textAlign: "right" },
  sigBox: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden", marginBottom: 16, minHeight: 200 },
  sigDone: { alignItems: "center", paddingVertical: 32, gap: 12 },
  sigDoneText: { fontSize: 16, fontWeight: "700", color: "#16a34a" },
  sigClearText: { fontSize: 13, color: "#6b7280", textDecorationLine: "underline" },
  unavailableToggle: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 16, gap: 12 },
  unavailableLabel: { fontSize: 14, fontWeight: "600", color: "#111827" },
  unavailableSubLabel: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  lockWarning: { backgroundColor: "#fef9c3", borderRadius: 10, padding: 12, marginBottom: 16 },
  lockWarningText: { fontSize: 12, color: "#92400e", lineHeight: 18 },
  submitBtn: { backgroundColor: "#16a34a", paddingVertical: 16, borderRadius: 14, alignItems: "center", marginBottom: 10 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});