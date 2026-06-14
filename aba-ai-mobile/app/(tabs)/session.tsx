import { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal
} from "react-native";
import { supabase } from "../../lib/supabase";

type Client = { id: string; full_name: string };
type CustomBehavior = {
  id: string;
  name: string;
  severity_levels: { id: string; level_number: number; label: string; description: string | null; color: string }[];
};
type SkillTarget = {
  id: string;
  program_name: string;
  target_name: string;
  prompt_levels: { id: string; level_number: number; label: string; abbreviation: string | null }[];
};
type BehaviorEntry = {
  behaviorId: string;
  behaviorName: string;
  severityId: string | null;
  severityLabel: string | null;
  severityColor: string | null;
  frequency: number;
};
type TrialEntry = {
  targetId: string;
  targetName: string;
  programName: string;
  promptId: string | null;
  promptLabel: string | null;
  result: "correct" | "prompted" | "incorrect" | "no_response";
};

const INTERVENTIONS = [
  "Redirection", "Planned ignoring", "Differential reinforcement",
  "Response blocking", "NCR", "Token economy", "Visual supports", "Prompting hierarchy"
];

export default function SessionScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"behaviors" | "skills" | "dtt">("behaviors");
  const [companyId, setCompanyId] = useState("");
  const [userId, setUserId] = useState("");

  const [customBehaviors, setCustomBehaviors] = useState<CustomBehavior[]>([]);
  const [skillTargets, setSkillTargets] = useState<SkillTarget[]>([]);
  const [behaviorEntries, setBehaviorEntries] = useState<BehaviorEntry[]>([]);
  const [selectedInterventions, setSelectedInterventions] = useState<string[]>([]);
  const [severityModal, setSeverityModal] = useState<{ behavior: CustomBehavior } | null>(null);
  const [trialEntries, setTrialEntries] = useState<TrialEntry[]>([]);
  const [activeTarget, setActiveTarget] = useState<SkillTarget | null>(null);
  const [promptModal, setPromptModal] = useState<{ target: SkillTarget; result: "correct" | "prompted" | "incorrect" | "no_response" } | null>(null);

  // DTT (old style)
  const [trialProgram, setTrialProgram] = useState("");
  const [trials, setTrials] = useState<Array<{ result: "correct" | "incorrect" | "prompted" }>>([]);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedClient) loadClientData(); }, [selectedClient]); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);
    const { data: companyUser } = await supabase
      .from("company_users").select("company_id")
      .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
    setCompanyId(companyUser?.company_id ?? "");
    const { data } = await supabase.from("clients").select("id, full_name")
      .eq("company_id", companyUser?.company_id).order("full_name");
    setClients(data ?? []);
    setLoading(false);
  }

  async function loadClientData() {
    const [{ data: behaviors }, { data: targets }] = await Promise.all([
      supabase.from("custom_behaviors")
        .select("*, severity_levels:behavior_severity_levels(*)")
        .eq("company_id", companyId).eq("client_id", selectedClient)
        .eq("is_active", true).order("display_order"),
      supabase.from("skill_targets")
        .select("*, prompt_levels(*)")
        .eq("company_id", companyId).eq("client_id", selectedClient)
        .eq("is_active", true).order("display_order"),
    ]);
    setCustomBehaviors(behaviors ?? []);
    setSkillTargets(targets ?? []);
    setBehaviorEntries([]);
    setTrialEntries([]);
  }

  function recordBehavior(behavior: CustomBehavior, severityId: string | null, severityLabel: string | null, severityColor: string | null) {
    setBehaviorEntries(prev => {
      const existing = prev.find(e => e.behaviorId === behavior.id && e.severityId === severityId);
      if (existing) {
        return prev.map(e => e.behaviorId === behavior.id && e.severityId === severityId
          ? { ...e, frequency: e.frequency + 1 } : e);
      }
      return [...prev, { behaviorId: behavior.id, behaviorName: behavior.name, severityId, severityLabel, severityColor, frequency: 1 }];
    });
    setSeverityModal(null);
  }

  function recordTrial(target: SkillTarget, promptId: string | null, promptLabel: string | null, result: "correct" | "prompted" | "incorrect" | "no_response") {
    setTrialEntries(prev => [...prev, { targetId: target.id, targetName: target.target_name, programName: target.program_name, promptId, promptLabel, result }]);
    setPromptModal(null);
  }

  function addTrial(result: "correct" | "incorrect" | "prompted") {
    setTrials(prev => [...prev, { result }]);
  }

  const trialCorrect = trials.filter(t => t.result === "correct").length;
  const trialPct = trials.length > 0 ? Math.round((trialCorrect / trials.length) * 100) : 0;
  const totalTrials = trialEntries.length;
  const correctTrials = trialEntries.filter(t => t.result === "correct").length;
  const trialEntryPct = totalTrials > 0 ? Math.round((correctTrials / totalTrials) * 100) : 0;

  async function handleSave() {
    if (!selectedClient) { Alert.alert("Please select a client."); return; }
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const behaviorsStr = behaviorEntries.map(e =>
      `${e.behaviorName}${e.severityLabel ? ` (${e.severityLabel})` : ""} x${e.frequency}`
    ).join(", ");
    const trialNote = trials.length > 0 ? `${trialProgram}: ${trialCorrect}/${trials.length} correct (${trialPct}%)` : "";

    const { data: session } = await supabase.from("sessions").insert({
      client_id: selectedClient,
      date: new Date().toISOString().split("T")[0],
      status: "completed",
      behaviors_observed: behaviorsStr || "No behaviors observed",
      interventions_used: selectedInterventions.join(", "),
      programs_targeted: [...new Set(trialEntries.map(t => `${t.programName}: ${t.targetName}`)), trialNote].filter(Boolean).join(", "),
      created_by: user.id,
      company_id: companyId,
    }).select().single();

    if (session) {
      if (behaviorEntries.length > 0) {
        await supabase.from("behavior_data").insert(
          behaviorEntries.map(e => ({
            session_id: session.id, client_id: selectedClient, company_id: companyId,
            behavior_id: e.behaviorId, severity_level_id: e.severityId,
            severity_label: e.severityLabel, frequency: e.frequency, created_by: user.id,
          }))
        );
      }
      if (trialEntries.length > 0) {
        await supabase.from("skill_trial_data").insert(
          trialEntries.map(e => ({
            session_id: session.id, client_id: selectedClient, company_id: companyId,
            target_id: e.targetId, prompt_level_id: e.promptId,
            prompt_label: e.promptLabel, result: e.result, created_by: user.id,
          }))
        );
      }
    }

    setBehaviorEntries([]); setTrialEntries([]); setSelectedInterventions([]);
    setTrials([]); setTrialProgram("");
    setSaving(false); setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#2563eb" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Data Collection</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
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
          {(["behaviors", "skills", "dtt"] as const).map(tab => (
            <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === "behaviors" ? "🧠 Behaviors" : tab === "skills" ? "🎯 Skills" : "📊 DTT"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* BEHAVIORS TAB */}
        {activeTab === "behaviors" && (
          <View style={styles.section}>
            {!selectedClient ? (
              <Text style={styles.emptyText}>Select a client to see their behaviors.</Text>
            ) : customBehaviors.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>🧠</Text>
                <Text style={styles.emptyText}>No custom behaviors set up yet.</Text>
                <Text style={styles.emptySubText}>Ask your BCBA to add behaviors in the web portal.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionLabel}>Tap to Record</Text>
                <View style={styles.chipGrid}>
                  {customBehaviors.map(b => (
                    <TouchableOpacity key={b.id} style={[styles.chip, styles.chipRed]}
                      onPress={() => b.severity_levels?.length > 0 ? setSeverityModal({ behavior: b }) : recordBehavior(b, null, null, null)}>
                      <Text style={styles.chipTextActive}>{b.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {behaviorEntries.length > 0 && (
                  <View style={styles.recordedSection}>
                    <Text style={styles.sectionLabel}>Recorded</Text>
                    {behaviorEntries.map((e, i) => (
                      <View key={i} style={styles.recordedRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recordedName}>{e.behaviorName}</Text>
                          {e.severityLabel && <Text style={[styles.recordedSeverity, { color: e.severityColor ?? "#dc2626" }]}>{e.severityLabel}</Text>}
                        </View>
                        <View style={styles.counterControls}>
                          <TouchableOpacity style={styles.counterBtn}
                            onPress={() => setBehaviorEntries(prev => prev.map((en, j) => j === i ? { ...en, frequency: Math.max(0, en.frequency - 1) } : en).filter(en => en.frequency > 0))}>
                            <Text style={styles.counterBtnText}>−</Text>
                          </TouchableOpacity>
                          <Text style={styles.counterNum}>{e.frequency}</Text>
                          <TouchableOpacity style={[styles.counterBtn, styles.counterBtnPlus]}
                            onPress={() => setBehaviorEntries(prev => prev.map((en, j) => j === i ? { ...en, frequency: en.frequency + 1 } : en))}>
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
                    <TouchableOpacity key={i} style={[styles.chip, selectedInterventions.includes(i) && styles.chipActive]}
                      onPress={() => setSelectedInterventions(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}>
                      <Text style={[styles.chipText, selectedInterventions.includes(i) && styles.chipTextActive]}>{i}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* SKILLS TAB */}
        {activeTab === "skills" && (
          <View style={styles.section}>
            {!selectedClient ? (
              <Text style={styles.emptyText}>Select a client to see their targets.</Text>
            ) : skillTargets.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>🎯</Text>
                <Text style={styles.emptyText}>No skill targets set up yet.</Text>
                <Text style={styles.emptySubText}>Ask your BCBA to add targets in the web portal.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionLabel}>Select Target</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {skillTargets.map(t => (
                    <TouchableOpacity key={t.id}
                      style={[styles.targetChip, activeTarget?.id === t.id && styles.targetChipActive]}
                      onPress={() => setActiveTarget(t)}>
                      <Text style={[styles.targetChipProgram, activeTarget?.id === t.id && { color: "#fff" }]}>{t.program_name}</Text>
                      <Text style={[styles.targetChipName, activeTarget?.id === t.id && { color: "#fff" }]}>{t.target_name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {activeTarget && (
                  <>
                    <Text style={styles.sectionLabel}>Record Trial — {activeTarget.target_name}</Text>
                    <View style={styles.trialButtons}>
                      <TouchableOpacity style={styles.trialBtnCorrect}
                        onPress={() => activeTarget.prompt_levels?.length > 0 ? setPromptModal({ target: activeTarget, result: "correct" }) : recordTrial(activeTarget, null, null, "correct")}>
                        <Text style={styles.trialBtnText}>✓ Correct</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.trialBtnPrompted}
                        onPress={() => activeTarget.prompt_levels?.length > 0 ? setPromptModal({ target: activeTarget, result: "prompted" }) : recordTrial(activeTarget, null, null, "prompted")}>
                        <Text style={styles.trialBtnText}>P Prompted</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.trialBtnIncorrect} onPress={() => recordTrial(activeTarget, null, null, "incorrect")}>
                        <Text style={styles.trialBtnText}>✗ Error</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.trialBtnNoResponse} onPress={() => recordTrial(activeTarget, null, null, "no_response")}>
                        <Text style={styles.trialBtnText}>— NR</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
                {trialEntries.length > 0 && (
                  <View style={styles.trialStats}>
                    <Text style={styles.trialCount}>{totalTrials} trials · {trialEntryPct}% correct</Text>
                    <View style={styles.trialBar}>
                      <View style={[styles.trialBarFill, { width: `${trialEntryPct}%` as any }]} />
                    </View>
                    <View style={styles.trialHistory}>
                      {trialEntries.map((t, i) => (
                        <View key={i} style={[styles.trialDot,
                          t.result === "correct" ? styles.trialDotCorrect
                          : t.result === "prompted" ? styles.trialDotPrompted
                          : t.result === "no_response" ? styles.trialDotNR
                          : styles.trialDotIncorrect]} />
                      ))}
                    </View>
                    <TouchableOpacity onPress={() => setTrialEntries([])}>
                      <Text style={styles.resetBtnText}>Reset all trials</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* DTT TAB */}
        {activeTab === "dtt" && (
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
                <View key={i} style={[styles.trialDot,
                  t.result === "correct" ? styles.trialDotCorrect
                  : t.result === "prompted" ? styles.trialDotPrompted
                  : styles.trialDotIncorrect]} />
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

      {/* SEVERITY MODAL */}
      <Modal visible={!!severityModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{severityModal?.behavior.name}</Text>
            <Text style={styles.modalSubtitle}>Select severity level</Text>
            {severityModal?.behavior.severity_levels.sort((a, b) => a.level_number - b.level_number).map(level => (
              <TouchableOpacity key={level.id} style={[styles.modalOption, { borderLeftColor: level.color }]}
                onPress={() => recordBehavior(severityModal.behavior, level.id, level.label, level.color)}>
                <Text style={[styles.modalOptionLabel, { color: level.color }]}>{level.label}</Text>
                {level.description && <Text style={styles.modalOptionDesc}>{level.description}</Text>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalOptionNR} onPress={() => recordBehavior(severityModal!.behavior, null, "No Severity", "#6b7280")}>
              <Text style={styles.modalOptionNRText}>Record without severity</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setSeverityModal(null)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PROMPT MODAL */}
      <Modal visible={!!promptModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{promptModal?.target.target_name}</Text>
            <Text style={styles.modalSubtitle}>Select prompt level</Text>
            {promptModal?.target.prompt_levels.sort((a, b) => a.level_number - b.level_number).map(level => (
              <TouchableOpacity key={level.id} style={styles.promptOption}
                onPress={() => recordTrial(promptModal.target, level.id, level.label, promptModal.result)}>
                {level.abbreviation && <View style={styles.promptAbbr}><Text style={styles.promptAbbrText}>{level.abbreviation}</Text></View>}
                <Text style={styles.promptLabel}>{level.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setPromptModal(null)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyBox: { alignItems: "center", paddingVertical: 40 },
emptyEmoji: { fontSize: 40, marginBottom: 10 },
emptyText: { fontSize: 14, color: "#9ca3af", textAlign: "center" },
emptySubText: { fontSize: 12, color: "#d1d5db", textAlign: "center", marginTop: 4 },
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
  chipText: { fontSize: 13, color: "#374151", fontWeight: "500" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  tabs: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#2563eb" },
  tabText: { fontSize: 13, color: "#9ca3af", fontWeight: "500" },
  tabTextActive: { color: "#2563eb", fontWeight: "700" },
  recordedSection: { marginTop: 16 },
  recordedRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  recordedName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  recordedSeverity: { fontSize: 11, fontWeight: "500", marginTop: 2 },
  counterControls: { flexDirection: "row", alignItems: "center", gap: 12 },
  counterBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  counterBtnPlus: { backgroundColor: "#2563eb" },
  counterBtnText: { fontSize: 18, color: "#374151", fontWeight: "600" },
  counterNum: { fontSize: 20, fontWeight: "800", color: "#111827", minWidth: 32, textAlign: "center" },
  targetChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#fff", marginRight: 8, minWidth: 100 },
  targetChipActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  targetChipProgram: { fontSize: 10, color: "#9ca3af", fontWeight: "600", textTransform: "uppercase" },
  targetChipName: { fontSize: 13, color: "#374151", fontWeight: "700", marginTop: 2 },
  trialButtons: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  trialBtnCorrect: { flex: 1, minWidth: "45%", backgroundColor: "#16a34a", paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  trialBtnPrompted: { flex: 1, minWidth: "45%", backgroundColor: "#d97706", paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  trialBtnIncorrect: { flex: 1, minWidth: "45%", backgroundColor: "#dc2626", paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  trialBtnNoResponse: { flex: 1, minWidth: "45%", backgroundColor: "#6b7280", paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  trialBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  trialStats: { backgroundColor: "#eff6ff", borderRadius: 12, padding: 14, marginBottom: 16 },
  trialCount: { fontSize: 13, color: "#6b7280", marginBottom: 4 },
  trialPct: { fontSize: 28, fontWeight: "900", color: "#2563eb", marginBottom: 8 },
  trialBar: { height: 8, backgroundColor: "#dbeafe", borderRadius: 4, marginBottom: 8 },
  trialBarFill: { height: 8, backgroundColor: "#2563eb", borderRadius: 4 },
  trialHistory: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 8 },
  trialDot: { width: 14, height: 14, borderRadius: 7 },
  trialDotCorrect: { backgroundColor: "#16a34a" },
  trialDotPrompted: { backgroundColor: "#d97706" },
  trialDotIncorrect: { backgroundColor: "#dc2626" },
  trialDotNR: { backgroundColor: "#6b7280" },
  resetBtn: { paddingVertical: 10, alignItems: "center" },
  resetBtnText: { color: "#6b7280", fontSize: 13, textDecorationLine: "underline", textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#111827", marginBottom: 14, backgroundColor: "#fff" },
  saveSection: { padding: 16 },
  saveBtn: { backgroundColor: "#2563eb", paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  saveBtnDisabled: { backgroundColor: "#93c5fd" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: "#6b7280", marginBottom: 16 },
  modalOption: { borderLeftWidth: 4, borderRadius: 8, padding: 14, marginBottom: 8, backgroundColor: "#f9fafb" },
  modalOptionLabel: { fontSize: 14, fontWeight: "700" },
  modalOptionDesc: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  modalOptionNR: { padding: 14, alignItems: "center", marginBottom: 8 },
  modalOptionNRText: { color: "#6b7280", fontSize: 13, textDecorationLine: "underline" },
  modalCancel: { padding: 14, alignItems: "center", borderTopWidth: 1, borderTopColor: "#f3f4f6", marginTop: 8 },
  modalCancelText: { color: "#6b7280", fontSize: 14, fontWeight: "600" },
  promptOption: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", gap: 12 },
  promptAbbr: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center" },
  promptAbbrText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  promptLabel: { fontSize: 14, color: "#374151", fontWeight: "600" },
});