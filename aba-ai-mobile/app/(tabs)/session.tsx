import { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal, Switch
} from "react-native";
import { supabase } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";
import { isOnline, addToQueue, getCachedBehaviors, getCachedTargets } from "../../lib/offline";

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

const CPT_CODES = [
  { code: "97153", label: "97153 — Adaptive Behavior Treatment" },
  { code: "97155", label: "97155 — Protocol Modification" },
  { code: "97156", label: "97156 — Family Guidance" },
  { code: "97151", label: "97151 — Behavior Identification" },
];

const SESSION_TYPES = [
  "Direct Therapy", "Supervision", "Parent Training", "Assessment", "Telehealth",
];

const ADJUSTMENT_REASONS = [
  "App failed to open", "Forgot to start timer", "Forgot to end timer",
  "Client arrived late", "Session ran over", "Technical issues", "Other",
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
  const [driveTimeEnabled, setDriveTimeEnabled] = useState(false);
  const [driveTimeMax, setDriveTimeMax] = useState(120);

  const [customBehaviors, setCustomBehaviors] = useState<CustomBehavior[]>([]);
  const [skillTargets, setSkillTargets] = useState<SkillTarget[]>([]);
  const [behaviorEntries, setBehaviorEntries] = useState<BehaviorEntry[]>([]);
  const [selectedInterventions, setSelectedInterventions] = useState<string[]>([]);
  const [severityModal, setSeverityModal] = useState<{ behavior: CustomBehavior } | null>(null);
  const [trialEntries, setTrialEntries] = useState<TrialEntry[]>([]);
  const [activeTarget, setActiveTarget] = useState<SkillTarget | null>(null);
  const [promptModal, setPromptModal] = useState<{ target: SkillTarget; result: "correct" | "prompted" | "incorrect" | "no_response" } | null>(null);

  // DTT
  const [trialProgram, setTrialProgram] = useState("");
  const [trials, setTrials] = useState<Array<{ result: "correct" | "incorrect" | "prompted" }>>([]);

  // TIME ENTRY
  const [showTimeEntry, setShowTimeEntry] = useState(false);
  const [timeEntryForm, setTimeEntryForm] = useState({
    date: new Date().toISOString().split("T")[0],
    start_time: "",
    end_time: "",
    session_type: "Direct Therapy",
    cpt_code: "97153",
    drive_time_minutes: 0,
    drive_time_billable: false,
    notes: "",
    start_adjusted: false,
    start_reason: "",
    end_adjusted: false,
    end_reason: "",
  });
  const [activeTimeEntry, setActiveTimeEntry] = useState<any>(null);

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

    const [{ data: clients }, { data: company }, { data: activeEntry }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("company_id", companyUser?.company_id).order("full_name"),
      supabase.from("companies").select("drive_time_enabled, drive_time_max_minutes").eq("id", companyUser?.company_id).single(),
      supabase.from("time_entries").select("*").eq("created_by", user.id).is("clock_out", null).limit(1).maybeSingle(),
    ]);

    setClients(clients ?? []);
    setDriveTimeEnabled(company?.drive_time_enabled ?? false);
    setDriveTimeMax(company?.drive_time_max_minutes ?? 120);
    setActiveTimeEntry(activeEntry ?? null);

    if (activeEntry) {
      const clockIn = new Date(activeEntry.clock_in);
      setTimeEntryForm(prev => ({
        ...prev,
        start_time: `${String(clockIn.getHours()).padStart(2, "0")}:${String(clockIn.getMinutes()).padStart(2, "0")}`,
      }));
    }
    setLoading(false);
  }

  async function loadClientData() {
    const online = await isOnline();
    if (online) {
      const [{ data: behaviors }, { data: targets }] = await Promise.all([
        supabase.from("custom_behaviors").select("*, severity_levels:behavior_severity_levels(*)")
          .eq("company_id", companyId).eq("client_id", selectedClient).eq("is_active", true).order("display_order"),
        supabase.from("skill_targets").select("*, prompt_levels(*)")
          .eq("company_id", companyId).eq("client_id", selectedClient).eq("is_active", true).order("display_order"),
      ]);
      setCustomBehaviors(behaviors ?? []);
      setSkillTargets(targets ?? []);
    } else {
      const [behaviors, targets] = await Promise.all([
        getCachedBehaviors(selectedClient),
        getCachedTargets(selectedClient),
      ]);
      setCustomBehaviors(behaviors);
      setSkillTargets(targets);
    }
    setBehaviorEntries([]);
    setTrialEntries([]);
  }

  function recordBehavior(behavior: CustomBehavior, severityId: string | null, severityLabel: string | null, severityColor: string | null) {
    setBehaviorEntries(prev => {
      const existing = prev.find(e => e.behaviorId === behavior.id && e.severityId === severityId);
      if (existing) return prev.map(e => e.behaviorId === behavior.id && e.severityId === severityId ? { ...e, frequency: e.frequency + 1 } : e);
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
    if (!timeEntryForm.start_time || !timeEntryForm.end_time) {
      Alert.alert("Missing Time", "Please fill in the start and end time in the Time Entry section before saving.");
      return;
    }
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const online = await isOnline();
    const behaviorsStr = behaviorEntries.map(e => `${e.behaviorName}${e.severityLabel ? ` (${e.severityLabel})` : ""} x${e.frequency}`).join(", ");
    const trialNote = trials.length > 0 ? `${trialProgram}: ${trialCorrect}/${trials.length} correct (${trialPct}%)` : "";

    const sessionPayload = {
      client_id: selectedClient,
      date: timeEntryForm.date,
      status: "completed",
      behaviors_observed: behaviorsStr || "No behaviors observed",
      interventions_used: selectedInterventions.join(", "),
      programs_targeted: [...new Set(trialEntries.map(t => `${t.programName}: ${t.targetName}`)), trialNote].filter(Boolean).join(", "),
      created_by: user.id,
      company_id: companyId,
      start_time: new Date(`${timeEntryForm.date}T${timeEntryForm.start_time}`).toISOString(),
      end_time: new Date(`${timeEntryForm.date}T${timeEntryForm.end_time}`).toISOString(),
      notes: timeEntryForm.notes || null,
    };

    if (!online) {
      await addToQueue({ type: "sessions", payload: sessionPayload });
      Alert.alert("Saved Offline", "Session queued and will sync when you're back online.");
      resetForm();
      setSaving(false);
      return;
    }

    const { data: session } = await supabase.from("sessions").insert(sessionPayload).select().single();

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

      // Save time entry log
      const startDt = new Date(`${timeEntryForm.date}T${timeEntryForm.start_time}`);
      const endDt = new Date(`${timeEntryForm.date}T${timeEntryForm.end_time}`);
      const duration = Math.floor((endDt.getTime() - startDt.getTime()) / 60000);

      await supabase.from("time_entry_logs").insert({
        company_id: companyId,
        user_id: user.id,
        client_id: selectedClient,
        time_entry_id: activeTimeEntry?.id ?? null,
        date: timeEntryForm.date,
        start_time: startDt.toISOString(),
        end_time: endDt.toISOString(),
        duration_minutes: duration,
        session_type: timeEntryForm.session_type,
        cpt_code: timeEntryForm.cpt_code,
        drive_time_minutes: timeEntryForm.drive_time_minutes,
        drive_time_billable: timeEntryForm.drive_time_billable,
        notes: timeEntryForm.notes || null,
        status: "draft",
        location_name: activeTimeEntry?.location_name ?? null,
        geofence_verified: activeTimeEntry?.geofence_verified ?? false,
        start_time_adjusted: timeEntryForm.start_adjusted,
        start_adjustment_reason: timeEntryForm.start_adjusted ? timeEntryForm.start_reason : null,
        end_time_adjusted: timeEntryForm.end_adjusted,
        end_adjustment_reason: timeEntryForm.end_adjusted ? timeEntryForm.end_reason : null,
      });

      // Clock out if still clocked in
      if (activeTimeEntry) {
        await supabase.from("time_entries").update({
          clock_out: endDt.toISOString(),
          duration_minutes: duration,
        }).eq("id", activeTimeEntry.id);
        setActiveTimeEntry(null);
      }
    }

    resetForm();
    setSaving(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  }

  function resetForm() {
    setBehaviorEntries([]);
    setTrialEntries([]);
    setSelectedInterventions([]);
    setTrials([]);
    setTrialProgram("");
    setTimeEntryForm({
      date: new Date().toISOString().split("T")[0],
      start_time: "",
      end_time: "",
      session_type: "Direct Therapy",
      cpt_code: "97153",
      drive_time_minutes: 0,
      drive_time_billable: false,
      notes: "",
      start_adjusted: false,
      start_reason: "",
      end_adjusted: false,
      end_reason: "",
    });
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#2563eb" /></View>;

  return (
    <View style={styles.container}>
      <AppHeader title="Data Collection" />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
        {success && <View style={styles.successBanner}><Text style={styles.successText}>✓ Session saved successfully</Text></View>}

        {/* CLIENT SELECT */}
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

        {/* ACTIVE CLOCK IN BANNER */}
        {activeTimeEntry && (
          <View style={styles.activeSessionBanner}>
            <Text style={styles.activeSessionText}>⏱️ Session in progress since {new Date(activeTimeEntry.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
            {activeTimeEntry.location_name && <Text style={styles.activeSessionSub}>📍 {activeTimeEntry.location_name}</Text>}
          </View>
        )}

        {/* TABS */}
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

        {/* TIME ENTRY SECTION */}
        <View style={styles.timeEntrySection}>
          <TouchableOpacity style={styles.timeEntryHeader} onPress={() => setShowTimeEntry(s => !s)}>
            <Text style={styles.timeEntryTitle}>⏱️ Time Entry {showTimeEntry ? "▼" : "▶"}</Text>
            <Text style={styles.timeEntrySubtitle}>Required before saving session</Text>
          </TouchableOpacity>

          {showTimeEntry && (
            <View style={styles.timeEntryForm}>

              {/* DATE */}
              <Text style={styles.sectionLabel}>Date</Text>
              <TextInput style={styles.input} value={timeEntryForm.date} onChangeText={t => setTimeEntryForm(p => ({ ...p, date: t }))} placeholder="YYYY-MM-DD" />

              {/* START TIME */}
              <Text style={styles.sectionLabel}>Start Time</Text>
              <TextInput style={styles.input} value={timeEntryForm.start_time}
                onChangeText={t => setTimeEntryForm(p => ({ ...p, start_time: t, start_adjusted: true }))}
                placeholder="HH:MM" keyboardType="numbers-and-punctuation" />
              {timeEntryForm.start_adjusted && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={styles.sectionLabel}>Reason for start adjustment</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {ADJUSTMENT_REASONS.map(r => (
                      <TouchableOpacity key={r} style={[styles.reasonChip, timeEntryForm.start_reason === r && styles.reasonChipActive]}
                        onPress={() => setTimeEntryForm(p => ({ ...p, start_reason: r }))}>
                        <Text style={[styles.reasonChipText, timeEntryForm.start_reason === r && styles.reasonChipTextActive]}>{r}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* END TIME */}
              <Text style={styles.sectionLabel}>End Time</Text>
              <TextInput style={styles.input} value={timeEntryForm.end_time}
                onChangeText={t => setTimeEntryForm(p => ({ ...p, end_time: t, end_adjusted: true }))}
                placeholder="HH:MM" keyboardType="numbers-and-punctuation" />
              {timeEntryForm.end_adjusted && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={styles.sectionLabel}>Reason for end adjustment</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {ADJUSTMENT_REASONS.map(r => (
                      <TouchableOpacity key={r} style={[styles.reasonChip, timeEntryForm.end_reason === r && styles.reasonChipActive]}
                        onPress={() => setTimeEntryForm(p => ({ ...p, end_reason: r }))}>
                        <Text style={[styles.reasonChipText, timeEntryForm.end_reason === r && styles.reasonChipTextActive]}>{r}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* SESSION TYPE */}
              <Text style={styles.sectionLabel}>Session Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {SESSION_TYPES.map(t => (
                  <TouchableOpacity key={t} style={[styles.chip, timeEntryForm.session_type === t && styles.chipActive]}
                    onPress={() => setTimeEntryForm(p => ({ ...p, session_type: t }))}>
                    <Text style={[styles.chipText, timeEntryForm.session_type === t && styles.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* CPT CODE */}
              <Text style={styles.sectionLabel}>CPT Code</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {CPT_CODES.map(c => (
                  <TouchableOpacity key={c.code} style={[styles.chip, timeEntryForm.cpt_code === c.code && styles.chipActive]}
                    onPress={() => setTimeEntryForm(p => ({ ...p, cpt_code: c.code }))}>
                    <Text style={[styles.chipText, timeEntryForm.cpt_code === c.code && styles.chipTextActive]}>{c.code}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* DRIVE TIME */}
              {driveTimeEnabled && (
                <View style={styles.driveTimeSection}>
                  <Text style={styles.sectionLabel}>Drive Time (max {driveTimeMax} min)</Text>
                  <TextInput style={styles.input} value={String(timeEntryForm.drive_time_minutes)}
                    onChangeText={t => setTimeEntryForm(p => ({ ...p, drive_time_minutes: Math.min(parseInt(t) || 0, driveTimeMax) }))}
                    keyboardType="numeric" placeholder="0" />
                  <View style={styles.driveTimeBillable}>
                    <Text style={styles.driveTimeBillableText}>Drive time is billable</Text>
                    <Switch value={timeEntryForm.drive_time_billable}
                      onValueChange={v => setTimeEntryForm(p => ({ ...p, drive_time_billable: v }))}
                      trackColor={{ true: "#2563eb" }} />
                  </View>
                </View>
              )}

              {/* NOTES */}
              <Text style={styles.sectionLabel}>Session Notes</Text>
              <TextInput style={[styles.input, { minHeight: 80 }]} value={timeEntryForm.notes}
                onChangeText={t => setTimeEntryForm(p => ({ ...p, notes: t }))}
                placeholder="Session summary, behaviors, programs targeted..."
                multiline textAlignVertical="top" />

              {/* SUMMARY */}
              {timeEntryForm.start_time && timeEntryForm.end_time && (
                <View style={styles.timeSummary}>
                  <Text style={styles.timeSummaryText}>
                    {timeEntryForm.start_time} → {timeEntryForm.end_time}
                    {" · "}
                    {(() => {
                      const start = new Date(`${timeEntryForm.date}T${timeEntryForm.start_time}`);
                      const end = new Date(`${timeEntryForm.date}T${timeEntryForm.end_time}`);
                      const mins = Math.floor((end.getTime() - start.getTime()) / 60000);
                      return `${Math.floor(mins / 60)}h ${mins % 60}m`;
                    })()}
                  </Text>
                  {timeEntryForm.drive_time_minutes > 0 && (
                    <Text style={styles.timeSummaryDrive}>🚗 +{timeEntryForm.drive_time_minutes}min drive</Text>
                  )}
                </View>
              )}
            </View>
          )}
        </View>

        {/* SAVE */}
        <View style={styles.saveSection}>
          <TouchableOpacity
            style={[styles.saveBtn, (!selectedClient || !timeEntryForm.start_time || !timeEntryForm.end_time) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!selectedClient || !timeEntryForm.start_time || !timeEntryForm.end_time || saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save & Submit Session</Text>}
          </TouchableOpacity>
          <Text style={styles.saveHint}>Saves session data + creates a time entry draft for review</Text>
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
  activeSessionBanner: { backgroundColor: "#eff6ff", borderLeftWidth: 4, borderLeftColor: "#2563eb", margin: 16, marginBottom: 0, padding: 12, borderRadius: 10 },
  activeSessionText: { fontSize: 13, fontWeight: "600", color: "#1d4ed8" },
  activeSessionSub: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  timeEntrySection: { margin: 16, backgroundColor: "#fff", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#e5e7eb" },
  timeEntryHeader: { padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  timeEntryTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  timeEntrySubtitle: { fontSize: 12, color: "#9ca3af" },
  timeEntryForm: { padding: 16, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  driveTimeSection: { marginBottom: 14 },
  driveTimeBillable: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  driveTimeBillableText: { fontSize: 14, color: "#374151" },
  timeSummary: { backgroundColor: "#f0fdf4", borderRadius: 10, padding: 12, marginBottom: 12, alignItems: "center" },
  timeSummaryText: { fontSize: 15, fontWeight: "700", color: "#16a34a" },
  timeSummaryDrive: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  reasonChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#fff", marginRight: 8, marginBottom: 8 },
  reasonChipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  reasonChipText: { fontSize: 12, color: "#374151" },
  reasonChipTextActive: { color: "#fff", fontWeight: "600" },
  saveSection: { padding: 16 },
  saveBtn: { backgroundColor: "#2563eb", paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  saveBtnDisabled: { backgroundColor: "#93c5fd" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  saveHint: { fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 8 },
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