import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Alert
} from "react-native";
import { useTimers, SoundOption, Timer } from "../../lib/TimerContext";

const SOUND_OPTIONS: { value: SoundOption; label: string; desc: string }[] = [
  { value: "chime", label: "🎵 Chime", desc: "Three ascending notes" },
  { value: "bell", label: "🔔 Bell", desc: "Long resonant tone" },
  { value: "ding", label: "✨ Ding", desc: "Short bright tone" },
  { value: "soft", label: "🌊 Soft", desc: "Low gentle tone" },
  { value: "none", label: "🔇 Silent", desc: "No sound" },
];

function fmt(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function TimersScreen() {
  const { timers, sound, setSound, addTimer, removeTimer, pauseTimer, resumeTimer, resetTimer } = useTimers();
  const [label, setLabel] = useState("");
  const [hrs, setHrs] = useState("");
  const [mins, setMins] = useState("");
  const [secs, setSecs] = useState("");
  const [countdown, setCountdown] = useState(true);
  const [showSound, setShowSound] = useState(false);

  function handleAdd() {
    if (!label.trim()) { Alert.alert("Please enter a timer name."); return; }
    const totalSecs = countdown
      ? (parseInt(hrs || "0") * 3600) + (parseInt(mins || "0") * 60) + parseInt(secs || "0")
      : 0;
    addTimer(label.trim(), countdown && totalSecs > 0 ? totalSecs : undefined);
    setLabel(""); setHrs(""); setMins(""); setSecs("");
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Timers</Text>
        <TouchableOpacity onPress={() => setShowSound(s => !s)} style={styles.soundBtn}>
          <Text style={styles.soundBtnText}>🔔 Sound</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* SOUND OPTIONS */}
        {showSound && (
          <View style={styles.soundPanel}>
            <Text style={styles.soundTitle}>Timer Sound</Text>
            {SOUND_OPTIONS.map(opt => (
              <TouchableOpacity key={opt.value} style={styles.soundRow} onPress={() => { setSound(opt.value); setShowSound(false); }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.soundLabel}>{opt.label}</Text>
                  <Text style={styles.soundDesc}>{opt.desc}</Text>
                </View>
                {sound === opt.value && <Text style={styles.soundCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowSound(false)} style={styles.soundClose}>
              <Text style={styles.soundCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* NEW TIMER */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>New Timer</Text>
          <TextInput
            style={styles.input}
            value={label}
            onChangeText={setLabel}
            placeholder="Timer name (e.g. Bathroom Break)"
          />
          <View style={styles.radioRow}>
            <TouchableOpacity style={styles.radioOption} onPress={() => setCountdown(true)}>
              <View style={[styles.radioCircle, countdown && styles.radioCircleActive]} />
              <Text style={styles.radioLabel}>Countdown</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.radioOption} onPress={() => setCountdown(false)}>
              <View style={[styles.radioCircle, !countdown && styles.radioCircleActive]} />
              <Text style={styles.radioLabel}>Stopwatch</Text>
            </TouchableOpacity>
          </View>

          {countdown && (
            <View style={styles.timeInputRow}>
              <View style={styles.timeInputCol}>
                <Text style={styles.timeInputLabel}>Hours</Text>
                <TextInput style={styles.timeInput} value={hrs} onChangeText={setHrs}
                  placeholder="0" keyboardType="number-pad" maxLength={2} />
              </View>
              <View style={styles.timeInputCol}>
                <Text style={styles.timeInputLabel}>Minutes</Text>
                <TextInput style={styles.timeInput} value={mins} onChangeText={setMins}
                  placeholder="0" keyboardType="number-pad" maxLength={2} />
              </View>
              <View style={styles.timeInputCol}>
                <Text style={styles.timeInputLabel}>Seconds</Text>
                <TextInput style={styles.timeInput} value={secs} onChangeText={setSecs}
                  placeholder="0" keyboardType="number-pad" maxLength={2} />
              </View>
            </View>
          )}

          <TouchableOpacity style={[styles.startBtn, !label.trim() && styles.startBtnDisabled]}
            onPress={handleAdd} disabled={!label.trim()}>
            <Text style={styles.startBtnText}>Start Timer</Text>
          </TouchableOpacity>
        </View>

        {/* ACTIVE TIMERS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Timers ({timers.length})</Text>
          {timers.length === 0 ? (
            <Text style={styles.emptyText}>No timers running. Start one above.</Text>
          ) : (
            timers.map(timer => {
              const isCountdown = timer.durationSeconds !== null;
              const remaining = isCountdown ? Math.max(0, timer.durationSeconds! - timer.elapsed) : null;
              const display = isCountdown ? fmt(remaining!) : fmt(timer.elapsed);
              const done = isCountdown && remaining === 0;
              const urgent = isCountdown && remaining !== null && remaining <= 30 && remaining > 0;
              const progress = isCountdown && timer.durationSeconds
                ? ((timer.durationSeconds - (remaining ?? 0)) / timer.durationSeconds) * 100
                : 0;

              return (
                <View key={timer.id} style={[
                  styles.timerCard,
                  done && styles.timerCardDone,
                  urgent && styles.timerCardUrgent,
                ]}>
                  <View style={styles.timerTop}>
                    <Text style={styles.timerName}>{timer.label}</Text>
                    <Text style={[
                      styles.timerDisplay,
                      done && styles.timerDisplayDone,
                      urgent && styles.timerDisplayUrgent,
                    ]}>
                      {done ? "DONE" : display}
                    </Text>
                  </View>

                  {isCountdown && !done && (
                    <View style={styles.progressBar}>
                      <View style={[
                        styles.progressFill,
                        urgent && styles.progressFillUrgent,
                        { width: `${progress}%` as any }
                      ]} />
                    </View>
                  )}

                  {isCountdown && !done && (
                    <Text style={styles.remainingText}>
                      {timer.running ? "Running" : "Paused"} · {fmt(remaining!)} remaining
                    </Text>
                  )}

                  <View style={styles.timerBtns}>
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
                      <Text style={styles.btnStopText}>✕ Stop</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: { backgroundColor: "#1a2234", paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  soundBtn: { backgroundColor: "#2a3a54", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  soundBtnText: { color: "#94a3b8", fontSize: 13, fontWeight: "600" },
  soundPanel: { backgroundColor: "#fff", margin: 16, borderRadius: 16, padding: 16, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  soundTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 12 },
  soundRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  soundLabel: { fontSize: 14, fontWeight: "600", color: "#374151" },
  soundDesc: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  soundCheck: { fontSize: 18, color: "#2563eb", fontWeight: "700" },
  soundClose: { paddingTop: 12, alignItems: "center" },
  soundCloseText: { color: "#6b7280", fontSize: 14 },
  card: { margin: 16, backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 14 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#111827", marginBottom: 14 },
  radioRow: { flexDirection: "row", gap: 20, marginBottom: 14 },
  radioOption: { flexDirection: "row", alignItems: "center", gap: 8 },
  radioCircle: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#d1d5db" },
  radioCircleActive: { borderColor: "#2563eb", backgroundColor: "#2563eb" },
  radioLabel: { fontSize: 14, color: "#374151" },
  timeInputRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  timeInputCol: { flex: 1 },
  timeInputLabel: { fontSize: 11, color: "#9ca3af", marginBottom: 4 },
  timeInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, fontSize: 16, color: "#111827", textAlign: "center" },
  startBtn: { backgroundColor: "#2563eb", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  startBtnDisabled: { backgroundColor: "#93c5fd" },
  startBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  section: { padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 12 },
  emptyText: { fontSize: 14, color: "#9ca3af" },
  timerCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "#e5e7eb" },
  timerCardDone: { backgroundColor: "#f9fafb", borderColor: "#d1d5db" },
  timerCardUrgent: { backgroundColor: "#fef2f2", borderColor: "#fca5a5" },
  timerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  timerName: { fontSize: 14, fontWeight: "700", color: "#374151", flex: 1 },
  timerDisplay: { fontSize: 28, fontWeight: "900", color: "#111827", fontVariant: ["tabular-nums"] },
  timerDisplayDone: { color: "#9ca3af" },
  timerDisplayUrgent: { color: "#dc2626" },
  progressBar: { height: 6, backgroundColor: "#e5e7eb", borderRadius: 3, marginBottom: 6 },
  progressFill: { height: 6, backgroundColor: "#2563eb", borderRadius: 3 },
  progressFillUrgent: { backgroundColor: "#dc2626" },
  remainingText: { fontSize: 11, color: "#9ca3af", marginBottom: 10 },
  timerBtns: { flexDirection: "row", gap: 6 },
  btnPause: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fef9c3", borderRadius: 8 },
  btnPauseText: { fontSize: 12, color: "#854d0e", fontWeight: "600" },
  btnResume: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#dcfce7", borderRadius: 8 },
  btnResumeText: { fontSize: 12, color: "#166534", fontWeight: "600" },
  btnReset: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#eff6ff", borderRadius: 8 },
  btnResetText: { fontSize: 12, color: "#1d4ed8", fontWeight: "600" },
  btnStop: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fef2f2", borderRadius: 8 },
  btnStopText: { fontSize: 12, color: "#dc2626", fontWeight: "600" },
});