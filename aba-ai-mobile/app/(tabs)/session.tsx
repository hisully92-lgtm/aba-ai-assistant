import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Alert, ActivityIndicator
} from "react-native";
import { supabase } from "../../lib/supabase";

type Client = { id: string; full_name: string };

const BEHAVIORS = ["Aggression", "SIB", "Elopement", "Property Destruction", "Tantrum", "Non-Compliance", "Vocal Disruption", "Stereotypy", "None observed"];
const INTERVENTIONS = ["Redirection", "Planned ignoring", "Differential reinforcement", "Response blocking", "NCR", "Token economy", "Visual supports", "Prompting hierarchy"];
const PROGRAMS = ["Mand Training", "Tact Training", "Imitation", "Matching", "Receptive ID", "Expressive ID", "Social Skills", "Daily Living Skills"];

export default function SessionScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"behaviors" | "skills" | "trials">("behaviors");
  const [companyId, setCompanyId] = useState("");

  const [selectedBehaviors, setSelectedBehaviors] = useState<string[]>([]);
  const [behaviorCounts, setBehaviorCounts] = useState<Record<string, number>>({});
  const [selectedInterventions, setSelectedInterventions] = useState<string[]>([]);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [clientResponse, setClientResponse] = useState("");
  const [trialProgram, setTrialProgram] = useState("");
  const [trials, setTrials] = useState<Array<{ result: "correct" | "incorrect" | "prompted" }>>([]);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const { data: companyUser } = await supabase.from("company_users").select("company_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
    setCompanyId(companyUser?.company_id ?? "");
    const { data } = await supabase.from("clients").select("id, full_name").eq("company_id", companyUser?.company_id);
    setClients(data ?? []);
    setLoading(false);
  }

  function toggleBehavior(b: string) {
    setSelectedBehaviors(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);
    if (!behaviorCounts[b]) setBehaviorCounts(prev => ({ ...prev, [b]: 0 }));
  }

  function addTrial(result: "correct" | "incorrect" | "prompted") {
    setTrials(prev => [...prev, { result }]);
  }

  const trialCorrect = trials.filter(t => t.result === "correct").length;
  const trialPct = trials.length > 0 ? Math.round((trialCorrect / trials.length) * 100) : 0;

  async function handleSave() {
    if (!selectedClient) { Alert.alert("Please select a client."); return; }
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const behaviorsStr = selectedBehaviors.map(b => `${b}${behaviorCounts[b] ? ` (${behaviorCounts[b]}x)` : ""}`).join(", ");
    const trialNote = trials.length > 0 ? `${trialProgram}: ${trialCorrect}/${trials.length} correct (${trialPct}%)` : "";

    await supabase.from("sessions").insert({
      client_id: selectedClient,
      date: new Date().toISOString().split("T")[0],
      status: "completed",
      behaviors_observed: behaviorsStr || "No behaviors observed",
      interventions_used: selectedInterventions.join(", "),
      programs_targeted: [...selectedPrograms, trialNote].filter(Boolean).join(", "),
      client_response: clientResponse,
      created_by: user.id,
      company_id: companyId,
    });

    setSelectedBehaviors([]); setBehaviorCounts({}); setSelectedInterventions([]);
    setSelectedPrograms([]); setClientResponse(""); setTrials([]); setTrialProgram("");
    setSaving(false); setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#2563eb" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Data Collection</Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {success && <View style={styles.successBanner}><Text style={styles.successText}>✓ Session saved successfully</Text></View>}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Client</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {clients.map(c => (
              <TouchableOpacity key={c.id} style={[styles.chip, selectedClient === c.id && styles.chipActive]} onPress={() => setSelectedClient(c.id)}>
                <Text style={[styles.chipText, selectedClient === c.id && styles.chipTextActive]}>{c.full_name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.tabs}>
          {(["behaviors", "skills", "trials"] as const).map(tab => (
            <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === "behaviors" ? "🧠 Behaviors" : tab === "skills" ? "🎯 Skills" : "📊 DTT"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === "behaviors" && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Behaviors Observed</Text>
            <View style={styles.chipGrid}>
              {BEHAVIORS.map(b => (
                <TouchableOpacity key={b} style={[styles.chip, selectedBehaviors.includes(b) && styles.chipRed]} onPress={() => toggleBehavior(b)}>
                  <Text style={[styles.chipText, selectedBehaviors.includes(b) && styles.chipTextActive]}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {selectedBehaviors.filter(b => b !== "None observed").length > 0 && (
              <View style={styles.counterSection}>
                <Text style={styles.sectionLabel}>Frequency Count</Text>
                {selectedBehaviors.filter(b => b !== "None observed").map(b => (
                  <View key={b} style={styles.counterRow}>
                    <Text style={styles.counterLabel}>{b}</Text>
                    <View style={styles.counterControls}>
                      <TouchableOpacity style={styles.counterBtn} onPress={() => setBehaviorCounts(prev => ({ ...prev, [b]: Math.max(0, (prev[b] ?? 0) - 1) }))}>
                        <Text style={styles.counterBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.counterNum}>{behaviorCounts[b] ?? 0}</Text>
                      <TouchableOpacity style={[styles.counterBtn, styles.counterBtnPlus]} onPress={() => setBehaviorCounts(prev => ({ ...prev, [b]: (prev[b] ?? 0) + 1 }))}>
                        <Text style={styles.counterBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Interventions Used</Text>
            <View style={styles.chipGrid}>
              {INTERVENTIONS.map(i => (
                <TouchableOpacity key={i} style={[styles.chip, selectedInterventions.includes(i) && styles.chipActive]} onPress={() => setSelectedInterventions(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}>
                  <Text style={[styles.chipText, selectedInterventions.includes(i) && styles.chipTextActive]}>{i}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {activeTab === "skills" && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Programs Targeted</Text>
            <View style={styles.chipGrid}>
              {PROGRAMS.map(p => (
                <TouchableOpacity key={p} style={[styles.chip, selectedPrograms.includes(p) && styles.chipPurple]} onPress={() => setSelectedPrograms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}>
                  <Text style={[styles.chipText, selectedPrograms.includes(p) && styles.chipTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Client Response</Text>
            <View style={styles.chipGrid}>
              {["Responded well", "Required multiple prompts", "Refused task", "Partial compliance", "Independent"].map(r => (
                <TouchableOpacity key={r} style={[styles.chip, clientResponse === r && styles.chipActive]} onPress={() => setClientResponse(r)}>
                  <Text style={[styles.chipText, clientResponse === r && styles.chipTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {activeTab === "trials" && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Program / Target</Text>
            <TextInput style={styles.input} value={trialProgram} onChangeText={setTrialProgram} placeholder="e.g. Mand Training — cup" />
            {trials.length > 0 && (
              <View style={styles.trialStats}>
                <Text style={styles.trialCount}>{trials.length} trials</Text>
                <Text style={styles.trialPct}>{trialPct}% correct</Text>
                <View style={styles.trialBar}>
                  <View style={[styles.trialBarFill, { width: `${trialPct}%` as any }]} />
                </View>
              </View>
            )}
            <View style={styles.trialButtons}>
              <TouchableOpacity style={styles.trialBtnCorrect} onPress={() => addTrial("correct")}><Text style={styles.trialBtnText}>✓ Correct</Text></TouchableOpacity>
              <TouchableOpacity style={styles.trialBtnPrompted} onPress={() => addTrial("prompted")}><Text style={styles.trialBtnText}>P Prompted</Text></TouchableOpacity>
              <TouchableOpacity style={styles.trialBtnIncorrect} onPress={() => addTrial("incorrect")}><Text style={styles.trialBtnText}>✗ Incorrect</Text></TouchableOpacity>
            </View>
            <View style={styles.trialHistory}>
              {trials.map((t, i) => (
                <View key={i} style={[styles.trialDot, t.result === "correct" ? styles.trialDotCorrect : t.result === "prompted" ? styles.trialDotPrompted : styles.trialDotIncorrect]} />
              ))}
            </View>
            {trials.length > 0 && (
              <TouchableOpacity style={styles.resetBtn} onPress={() => setTrials([])}><Text style={styles.resetBtnText}>Reset Trials</Text></TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.saveSection}>
          <TouchableOpacity style={[styles.saveBtn, !selectedClient && styles.saveBtnDisabled]} onPress={handleSave} disabled={!selectedClient || saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Session Data</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { backgroundColor: "#1a2234", paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  successBanner: { backgroundColor: "#dcfce7", padding: 12, margin: 16, borderRadius: 10 },
  successText: { color: "#16a34a", fontWeight: "600", textAlign: "center" },
  section: { padding: 16 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", marginBottom: 10, letterSpacing: 0.5 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#fff" },
  chipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipRed: { backgroundColor: "#dc2626", borderColor: "#dc2626" },
  chipPurple: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  chipText: { fontSize: 13, color: "#374151", fontWeight: "500" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  tabs: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#2563eb" },
  tabText: { fontSize: 13, color: "#9ca3af", fontWeight: "500" },
  tabTextActive: { color: "#2563eb", fontWeight: "700" },
  counterSection: { marginTop: 16 },
  counterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  counterLabel: { fontSize: 14, color: "#374151", flex: 1 },
  counterControls: { flexDirection: "row", alignItems: "center", gap: 12 },
  counterBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  counterBtnPlus: { backgroundColor: "#2563eb" },
  counterBtnText: { fontSize: 18, color: "#374151", fontWeight: "600" },
  counterNum: { fontSize: 20, fontWeight: "800", color: "#111827", minWidth: 32, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#111827", marginBottom: 14, backgroundColor: "#fff" },
  trialStats: { backgroundColor: "#eff6ff", borderRadius: 12, padding: 14, marginBottom: 16 },
  trialCount: { fontSize: 13, color: "#6b7280", marginBottom: 4 },
  trialPct: { fontSize: 28, fontWeight: "900", color: "#2563eb", marginBottom: 8 },
  trialBar: { height: 8, backgroundColor: "#dbeafe", borderRadius: 4 },
  trialBarFill: { height: 8, backgroundColor: "#2563eb", borderRadius: 4 },
  trialButtons: { flexDirection: "row", gap: 8, marginBottom: 16 },
  trialBtnCorrect: { flex: 1, backgroundColor: "#16a34a", paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  trialBtnPrompted: { flex: 1, backgroundColor: "#d97706", paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  trialBtnIncorrect: { flex: 1, backgroundColor: "#dc2626", paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  trialBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  trialHistory: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  trialDot: { width: 16, height: 16, borderRadius: 8 },
  trialDotCorrect: { backgroundColor: "#16a34a" },
  trialDotPrompted: { backgroundColor: "#d97706" },
  trialDotIncorrect: { backgroundColor: "#dc2626" },
  resetBtn: { paddingVertical: 10, alignItems: "center" },
  resetBtnText: { color: "#6b7280", fontSize: 13, textDecorationLine: "underline" },
  saveSection: { padding: 16 },
  saveBtn: { backgroundColor: "#2563eb", paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  saveBtnDisabled: { backgroundColor: "#93c5fd" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});