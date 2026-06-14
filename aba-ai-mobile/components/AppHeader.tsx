import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  Dimensions, ScrollView, Alert, ActivityIndicator
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { useTimers } from "../lib/TimerContext";
import OfflineBanner from "./OfflineBanner";

const SCREEN_WIDTH = Dimensions.get("window").width;

function fmt(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function AppHeader({ title }: { title: string }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { timers, pauseTimer, resumeTimer, resetTimer, removeTimer } = useTimers();

  const runningTimers = timers.filter(t => t.running);
  const hasRunning = runningTimers.length > 0;

  async function handleLogout() {
    Alert.alert("Log Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out", style: "destructive",
        onPress: async () => {
          setLoggingOut(true);
          setDrawerOpen(false);
          await supabase.auth.signOut();
          router.replace("/(auth)/login");
        }
      }
    ]);
  }

  return (
    <>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => setDrawerOpen(true)}>
          <Text style={styles.hamburger}>☰</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{title}</Text>

        <TouchableOpacity style={[styles.headerBtn, styles.timerBtn]} onPress={() => setTimerOpen(true)}>
          <Text style={styles.timerIcon}>⏱️</Text>
          {hasRunning && (
            <View style={styles.timerBadge}>
              <Text style={styles.timerBadgeText}>{runningTimers.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <OfflineBanner />

      {/* DRAWER */}
      <Modal visible={drawerOpen} transparent animationType="none" onRequestClose={() => setDrawerOpen(false)}>
        <TouchableOpacity style={styles.drawerOverlay} activeOpacity={1} onPress={() => setDrawerOpen(false)}>
          <View style={styles.drawer} onStartShouldSetResponder={() => true}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerLogo}>A</Text>
              <Text style={styles.drawerTitle}>ABA AI</Text>
            </View>
            <ScrollView style={{ flex: 1 }}>
              {[
                { emoji: "👤", label: "Profile & Settings", action: () => { setDrawerOpen(false); router.push("/(tabs)/profile"); } },
                { emoji: "🏠", label: "Home", action: () => { setDrawerOpen(false); router.push("/(tabs)/home"); } },
                { emoji: "📅", label: "Schedule", action: () => { setDrawerOpen(false); router.push("/(tabs)/calendar"); } },
                { emoji: "📋", label: "Session", action: () => { setDrawerOpen(false); router.push("/(tabs)/session"); } },
                { emoji: "📝", label: "Notes", action: () => { setDrawerOpen(false); router.push("/(tabs)/notes"); } },
                { emoji: "💬", label: "Team Chat", action: () => { setDrawerOpen(false); router.push("/(tabs)/chat"); } },
                { emoji: "👨‍👩‍👧", label: "Parent Portal", action: () => { setDrawerOpen(false); router.push("/(tabs)/parent"); } },
              ].map(item => (
                <TouchableOpacity key={item.label} style={styles.drawerItem} onPress={item.action}>
                  <Text style={styles.drawerItemEmoji}>{item.emoji}</Text>
                  <Text style={styles.drawerItemLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.drawerLogout} onPress={handleLogout} disabled={loggingOut}>
              {loggingOut ? <ActivityIndicator color="#fff" /> : <Text style={styles.drawerLogoutText}>🚪 Log Out</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* TIMER OVERLAY */}
      <Modal visible={timerOpen} transparent animationType="slide" onRequestClose={() => setTimerOpen(false)}>
        <TouchableOpacity style={styles.timerOverlay} activeOpacity={1} onPress={() => setTimerOpen(false)}>
          <View style={styles.timerPanel} onStartShouldSetResponder={() => true}>
            <View style={styles.timerPanelHeader}>
              <Text style={styles.timerPanelTitle}>⏱️ Active Timers</Text>
              <TouchableOpacity onPress={() => setTimerOpen(false)}>
                <Text style={styles.timerPanelClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {timers.length === 0 ? (
              <View style={styles.timerEmpty}>
                <Text style={styles.timerEmptyText}>No timers running.</Text>
                <Text style={styles.timerEmptySubText}>Start timers from the Timers screen.</Text>
              </View>
            ) : (
              <ScrollView>
                {timers.map(timer => {
                  const isCountdown = timer.durationSeconds !== null;
                  const remaining = isCountdown ? Math.max(0, timer.durationSeconds! - timer.elapsed) : null;
                  const display = isCountdown ? fmt(remaining!) : fmt(timer.elapsed);
                  const done = isCountdown && remaining === 0;
                  const urgent = isCountdown && remaining !== null && remaining <= 30 && remaining > 0;
                  const progress = isCountdown && timer.durationSeconds
                    ? ((timer.durationSeconds - (remaining ?? 0)) / timer.durationSeconds) * 100 : 0;

                  return (
                    <View key={timer.id} style={[styles.timerCard, done && styles.timerCardDone, urgent && styles.timerCardUrgent]}>
                      <View style={styles.timerCardTop}>
                        <Text style={styles.timerCardName}>{timer.label}</Text>
                        <Text style={[styles.timerCardTime, done && { color: "#9ca3af" }, urgent && { color: "#dc2626" }]}>
                          {done ? "DONE" : display}
                        </Text>
                      </View>
                      {isCountdown && !done && (
                        <View style={styles.timerCardBar}>
                          <View style={[styles.timerCardBarFill, urgent && { backgroundColor: "#dc2626" }, { width: `${progress}%` as any }]} />
                        </View>
                      )}
                      <View style={styles.timerCardBtns}>
                        {timer.running && !done ? (
                          <TouchableOpacity style={styles.btnPause} onPress={() => pauseTimer(timer.id)}>
                            <Text style={styles.btnPauseText}>⏸ Pause</Text>
                          </TouchableOpacity>
                        ) : !done ? (
                          <TouchableOpacity style={styles.btnResume} onPress={() => resumeTimer(timer.id)}>
                            <Text style={styles.btnResumeText}>▶ Resume</Text>
                          </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity style={styles.btnReset} onPress={() => resetTimer(timer.id)}>
                          <Text style={styles.btnResetText}>↺ Reset</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.btnStop} onPress={() => removeTimer(timer.id)}>
                          <Text style={styles.btnStopText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.goToTimers} onPress={() => { setTimerOpen(false); router.push("/(tabs)/timers"); }}>
              <Text style={styles.goToTimersText}>+ Add New Timer</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: "#1a2234", paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  hamburger: { fontSize: 22, color: "#fff" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#fff", flex: 1, textAlign: "center" },
  timerBtn: { position: "relative" },
  timerIcon: { fontSize: 22 },
  timerBadge: { position: "absolute", top: -4, right: -4, backgroundColor: "#dc2626", borderRadius: 8, width: 16, height: 16, alignItems: "center", justifyContent: "center" },
  timerBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  drawerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", flexDirection: "row" },
  drawer: { width: SCREEN_WIDTH * 0.75, backgroundColor: "#1a2234", height: "100%", paddingTop: 60 },
  drawerHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: "#2a3a54" },
  drawerLogo: { width: 40, height: 40, backgroundColor: "#2563eb", borderRadius: 10, textAlign: "center", lineHeight: 40, color: "#fff", fontSize: 20, fontWeight: "900" },
  drawerTitle: { fontSize: 20, fontWeight: "900", color: "#fff" },
  drawerItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#2a3a54" },
  drawerItemEmoji: { fontSize: 20 },
  drawerItemLabel: { fontSize: 15, color: "#e2e8f0", fontWeight: "500" },
  drawerLogout: { padding: 20, backgroundColor: "#dc2626", margin: 16, borderRadius: 12, alignItems: "center" },
  drawerLogoutText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  timerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  timerPanel: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "70%", paddingBottom: 40 },
  timerPanelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  timerPanelTitle: { fontSize: 17, fontWeight: "800", color: "#111827" },
  timerPanelClose: { fontSize: 18, color: "#9ca3af", padding: 4 },
  timerEmpty: { alignItems: "center", paddingVertical: 32 },
  timerEmptyText: { fontSize: 15, color: "#6b7280", fontWeight: "600" },
  timerEmptySubText: { fontSize: 12, color: "#9ca3af", marginTop: 4 },
  timerCard: { backgroundColor: "#f9fafb", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#e5e7eb" },
  timerCardDone: { backgroundColor: "#f3f4f6", borderColor: "#d1d5db" },
  timerCardUrgent: { backgroundColor: "#fef2f2", borderColor: "#fca5a5" },
  timerCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  timerCardName: { fontSize: 14, fontWeight: "600", color: "#374151", flex: 1 },
  timerCardTime: { fontSize: 24, fontWeight: "900", color: "#111827", fontVariant: ["tabular-nums"] },
  timerCardBar: { height: 4, backgroundColor: "#e5e7eb", borderRadius: 2, marginBottom: 8 },
  timerCardBarFill: { height: 4, backgroundColor: "#2563eb", borderRadius: 2 },
  timerCardBtns: { flexDirection: "row", gap: 6 },
  btnPause: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "#fef9c3", borderRadius: 8 },
  btnPauseText: { fontSize: 12, color: "#854d0e", fontWeight: "600" },
  btnResume: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "#dcfce7", borderRadius: 8 },
  btnResumeText: { fontSize: 12, color: "#166534", fontWeight: "600" },
  btnReset: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "#eff6ff", borderRadius: 8 },
  btnResetText: { fontSize: 12, color: "#1d4ed8", fontWeight: "600" },
  btnStop: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "#fef2f2", borderRadius: 8 },
  btnStopText: { fontSize: 12, color: "#dc2626", fontWeight: "600" },
  goToTimers: { backgroundColor: "#2563eb", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 12 },
  goToTimersText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});