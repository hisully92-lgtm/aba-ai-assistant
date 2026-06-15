import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal
} from "react-native";
import { supabase } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";
import { isOnline, addToQueue, getCachedBehaviors, getCachedTargets } from "../../lib/offline";

type Client = { id: string; full_name: string };
type EVVRecord = {
  id: string; client_id: string; date: string;
  actual_start: string; actual_end: string;
  session_duration_minutes: number; location_name: string | null;
  evv_status: string; time_entry_id: string | null;
};
type CustomBehavior = {
  id: string; name: string; category: string;
  operational_definition: string | null;
  antecedent: string | null; consequence: string | null;
  bcba_notes: string | null; replacement_behavior: string | null;
  severity_levels: { id: string; level_number: number; label: string; description: string | null; color: string }[];
};
type SkillTarget = {
  id: string; program_name: string; target_name: string;
  description: string | null; goal: string | null;
  mastery_criteria: string | null; instructions: string | null;
  sd_text: string | null; sets_per_session: number | null;
  trials_per_set: number | null; current_accuracy: number | null;
  bcba_notes: string | null; materials: string | null;
  status: string | null;
  prompt_levels: { id: string; level_number: number; label: string; abbreviation: string | null }[];
};
type BehaviorEntry = {
  behaviorId: string; behaviorName: string;
  severityId: string | null; severityLabel: string | null;
  severityColor: string | null; frequency: number;
};
type TrialEntry = {
  targetId: string; targetName: string; programName: string;
  promptId: string | null; promptLabel: string | null;
  result: "correct" | "prompted" | "incorrect" | "no_response";
};

const INTERVENTIONS = [
  "Redirection", "Planned ignoring", "Differential reinforcement",
  "Response blocking", "NCR", "Token economy", "Visual supports", "Prompting hierarchy"
];

type Screen = "clients" | "evv" | "session";

export default function SessionScreen() {
  const [screen, setScreen] = useState<Screen>("clients");
  const [userId, setUserId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Clients (assigned only)
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // EVV
  const [evvRecords, setEvvRecords] = useState<EVVRecord[]>([]);
  const [selectedEVV, setSelectedEVV] = useState<EVVRecord | null>(null);
  const [evvLoading, setEvvLoading] = useState(false);

  // Clinical data
  const [customBehaviors, setCustomBehaviors] = useState<CustomBehavior[]>([]);
  const [skillTargets, setSkillTargets] = useState<SkillTarget[]>([]);
  const [activeTab, setActiveTab] = useState<"behaviors" | "skills" | "dtt">("behaviors");

  // Expanded program details
  const [expandedBehavior, setExpandedBehavior] = useState<string | null>(null);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  // Data collection
  const [behaviorEntries, setBehaviorEntries] = useState<BehaviorEntry[]>([]);
  const [selectedInterventions, setSelectedInterventions] = useState<string[]>([]);
  const [severityModal, setSeverityModal] = useState<{ behavior: CustomBehavior } | null>(null);
  const [trialEntries, setTrialEntries] = useState<TrialEntry[]>([]);
  const [activeTarget, setActiveTarget] = useState<SkillTarget | null>(null);
  const [promptModal, setPromptModal] = useState<{ target: SkillTarget; result: "correct" | "prompted" | "incorrect" | "no_response" } | null>(null);
  const [sessionNotes, setSessionNotes] = useState("");

  // DTT
  const [trialProgram, setTrialProgram] = useState("");
  const [trials, setTrials] = useState<Array<{ result: "correct" | "incorrect" | "prompted" }>>([]);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const { data: companyUser } = await supabase
      .from("company_users").select("company_id")
      .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
    setCompanyId(companyUser?.company_id ?? "");

    // Load only assigned clients
    const { data: assignments } = await supabase
      .from("assignments")
      .select("client_id, clients(id, full_name)")
      .eq("rbt_id", user.id);

    const assignedClients: Client[] = (assignments ?? [])
      .map((a: any) => a.clients)
      .filter(Boolean)
      .sort((a: Client, b: Client) => a.full_name.localeCompare(b.full_name));

    // Deduplicate
    const unique = assignedClients.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i);
    setClients(unique);
    setLoading(false);
  }

  async function selectClient(client: Client) {
    setSelectedClient(client);
    setEvvLoading(true);
    setScreen("evv");

    const { data: evv } = await supabase
      .from("evv_records")
      .select("*")
      .eq("client_id", client.id)
      .eq("evv_status", "complete")
      .order("actual_start", { ascending: false })
      .limit(20);

    setEvvRecords(evv ?? []);
    setEvvLoading(false);
  }

  async function selectEVV(evv: EVVRecord) {
    setSelectedEVV(evv);
    setScreen("session");
    setActiveTab("behaviors");
    setBehaviorEntries([]);
    setTrialEntries([]);
    setSelectedInterventions([]);
    setTrials([]);
    setSessionNotes("");
    setExpandedBehavior(null);
    setExpandedSkill(null);

    const online = await isOnline();
    if (online) {
      const [{ data: behaviors }, { data: targets }] = await Promise.all([
        supabase.from("custom_behaviors")
          .select("*, severity_levels:behavior_severity_levels(*)")
          .eq("client_id", evv.client_id)
          .eq("is_active", true)
          .order("display_order"),
        supabase.from("skill_targets")
          .select("*, prompt_levels(*)")
          .eq("client_id", evv.client_id)
          .eq("is_active", true)
          .order("display_order"),
      ]);
      setCustomBehaviors(behaviors ?? []);
      setSkillTargets(targets ?? []);
    } else {
      const [behaviors, targets] = await Promise.all([
        getCachedBehaviors(evv.client_id),
        getCachedTargets(evv.client_id),
      ]);
      setCustomBehaviors(behaviors);
      setSkillTargets(targets);
    }
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

  const totalTrials = trialEntries.length;
  const correctTrials = trialEntries.filter(t => t.result === "correct").length;
  const trialPct = totalTrials > 0 ? Math.round((correctTrials / totalTrials) * 100) : 0;
  const dttCorrect = trials.filter(t => t.result === "correct").length;
  const dttPct = trials.length > 0 ? Math.round((dttCorrect / trials.length) * 100) : 0;

  function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  function fmtDate(iso: string) { return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }); }
  function fmt(minutes: number) { const h = Math.floor(minutes / 60); const m = minutes % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; }

  async function handleSave() {
    if (!selectedClient || !selectedEVV) return;
    setSaving(true);

    const behaviorsStr = behaviorEntries.map(e => `${e.behaviorName}${e.severityLabel ? ` (${e.severityLabel})` : ""} x${e.frequency}`).join(", ");
    const dttNote = trials.length > 0 ? `${trialProgram}: ${dttCorrect}/${trials.length} (${dttPct}%)` : "";

    const sessionPayload = {
      client_id: selectedClient.id,
      date: selectedEVV.date,
      status: "completed",
      behaviors_observed: behaviorsStr || "No behaviors observed",
      interventions_used: selectedInterventions.join(", "),
      programs_targeted: [...new Set(trialEntries.map(t => `${t.programName}: ${t.targetName}`)), dttNote].filter(Boolean).join(", "),
      created_by: userId,
      company_id: companyId,
      start_time: selectedEVV.actual_start,
      end_time: selectedEVV.actual_end,
      notes: sessionNotes || null,
      evv_record_id: selectedEVV.id,
    };

    const online = await isOnline();
    if (!online) {
      await addToQueue({ type: "sessions", payload: sessionPayload });
      Alert.alert("Saved Offline", "Session queued and will sync when online.");
      setSaving(false);
      setSuccess(true);
      setTimeout(() => { setSuccess(false); setScreen("clients"); }, 2000);
      return;
    }

    // Save session
    const { data: session } = await supabase.from("sessions").insert(sessionPayload).select().single();

    if (session) {
      // Save behavior data
      if (behaviorEntries.length > 0) {
        await supabase.from("behavior_data").insert(
          behaviorEntries.map(e => ({
            session_id: session.id, client_id: selectedClient.id, company_id: companyId,
            behavior_id: e.behaviorId, severity_level_id: e.severityId,
            severity_label: e.severityLabel, frequency: e.frequency, created_by: userId,
          }))
        );
      }

      // Save skill trial data
      if (trialEntries.length > 0) {
        await supabase.from("skill_trial_data").insert(
          trialEntries.map(e => ({
            session_id: session.id, client_id: selectedClient.id, company_id: companyId,
            target_id: e.targetId, prompt_level_id: e.promptId,
            prompt_label: e.promptLabel, result: e.result, created_by: userId,
          }))
        );
      }

      // Save back to EVV record
      await supabase.from("evv_records").update({
        behaviors_recorded: (behaviorEntries.reduce((sum, e) => sum + e.frequency, 0)),
        trials_recorded: trialEntries.length,
        session_notes: sessionNotes || null,
        session_id: session.id,
      }).eq("id", selectedEVV.id);
    }

    setSaving(false);
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setScreen("clients");
      setSelectedClient(null);
      setSelectedEVV(null);
    }, 2000);
  }

  if (loading) return <View style={s.center}><ActivityIndicator color="#2563eb" size="large" /></View>;

  // ── CLIENTS SCREEN ─────────────────────────────────────────
  if (screen === "clients") {
    return (
      <View style={s.container}>
        <AppHeader title="Data Collection" />
        {success && <View style={s.successBanner}><Text style={s.successText}>✓ Session saved successfully!</Text></View>}
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text style={s.screenTitle}>Your Assigned Clients</Text>
          <Text style={s.screenSubtitle}>Tap a client to view their EVV sessions and collect data</Text>
          {clients.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>👥</Text>
              <Text style={s.emptyTitle}>No clients assigned</Text>
              <Text style={s.emptyText}>Ask your admin or BCBA to assign clients to you.</Text>
            </View>
          ) : (
            clients.map(client => (
              <TouchableOpacity key={client.id} style={s.clientCard} onPress={() => selectClient(client)}>
                <View style={s.clientAvatar}>
                  <Text style={s.clientAvatarText}>{client.full_name.split(" ").map(n => n[0]).join("").slice(0, 2)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.clientName}>{client.full_name}</Text>
                  <Text style={s.clientSub}>Tap to view sessions →</Text>
                </View>
                <Text style={s.chevron}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  // ── EVV SCREEN ─────────────────────────────────────────────
  if (screen === "evv") {
    return (
      <View style={s.container}>
        <AppHeader title={selectedClient?.full_name ?? "Sessions"} />
        <TouchableOpacity style={s.backBtn} onPress={() => { setScreen("clients"); setSelectedClient(null); }}>
          <Text style={s.backBtnText}>‹ All Clients</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text style={s.screenTitle}>Select a Session</Text>
          <Text style={s.screenSubtitle}>Tap the EVV visit you want to document</Text>
          {evvLoading ? (
            <ActivityIndicator color="#2563eb" style={{ marginTop: 40 }} />
          ) : evvRecords.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>📋</Text>
              <Text style={s.emptyTitle}>No completed EVV sessions</Text>
              <Text style={s.emptyText}>Complete a visit via the EVV clock-in flow first.</Text>
            </View>
          ) : (
            evvRecords.map(evv => {
              const hasEntry = !!evv.time_entry_id;
              return (
                <TouchableOpacity key={evv.id} style={[s.evvCard, !hasEntry && s.evvCardNeedsDoc]} onPress={() => selectEVV(evv)}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <Text style={s.evvDate}>{fmtDate(evv.actual_start)}</Text>
                      {!hasEntry && <View style={s.needsDocBadge}><Text style={s.needsDocText}>Needs Documentation</Text></View>}
                    </View>
                    <Text style={s.evvTime}>{fmtTime(evv.actual_start)} – {fmtTime(evv.actual_end)} · {fmt(evv.session_duration_minutes)}</Text>
                    {evv.location_name && <Text style={s.evvLocation}>📍 {evv.location_name}</Text>}
                  </View>
                  <Text style={s.chevron}>›</Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  }

  // ── SESSION SCREEN ─────────────────────────────────────────
  return (
    <View style={s.container}>
      <AppHeader title={`${selectedClient?.full_name ?? "Session"}`} />
      <TouchableOpacity style={s.backBtn} onPress={() => { setScreen("evv"); setSelectedEVV(null); }}>
        <Text style={s.backBtnText}>‹ Back to Sessions</Text>
      </TouchableOpacity>

      {/* EVV SUMMARY BAR */}
      {selectedEVV && (
        <View style={s.evvBar}>
          <Text style={s.evvBarText}>📅 {fmtDate(selectedEVV.actual_start)} · {fmtTime(selectedEVV.actual_start)}–{fmtTime(selectedEVV.actual_end)} · {fmt(selectedEVV.session_duration_minutes)}</Text>
          {selectedEVV.location_name && <Text style={s.evvBarSub}>📍 {selectedEVV.location_name}</Text>}
        </View>
      )}

      {/* TABS */}
      <View style={s.tabs}>
        {(["behaviors", "skills", "dtt"] as const).map(tab => (
          <TouchableOpacity key={tab} style={[s.tab, activeTab === tab && s.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
              {tab === "behaviors" ? "🧠 Behaviors" : tab === "skills" ? "🎯 Skills" : "📊 DTT"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

        {/* BEHAVIORS TAB */}
        {activeTab === "behaviors" && (
          <View>
            {customBehaviors.length === 0 ? (
              <View style={s.empty}><Text style={s.emptyEmoji}>🧠</Text><Text style={s.emptyTitle}>No behaviors set up</Text><Text style={s.emptyText}>Ask your BCBA to add behaviors in the web portal.</Text></View>
            ) : (
              <>
                <Text style={s.sectionLabel}>Tap to Record — hold to view program details</Text>
                {customBehaviors.map(b => (
                  <View key={b.id} style={s.programCard}>
                    {/* Program header */}
                    <View style={s.programCardHeader}>
                      <TouchableOpacity style={[s.recordBtn, s.recordBtnRed]}
                        onPress={() => b.severity_levels?.length > 0 ? setSeverityModal({ behavior: b }) : recordBehavior(b, null, null, null)}>
                        <Text style={s.recordBtnText}>+ {b.name}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.expandBtn} onPress={() => setExpandedBehavior(expandedBehavior === b.id ? null : b.id)}>
                        <Text style={s.expandBtnText}>{expandedBehavior === b.id ? "▲" : "▼"}</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Expanded program details */}
                    {expandedBehavior === b.id && (
                      <View style={s.programDetails}>
                        {b.operational_definition && (
                          <View style={s.detailBlock}>
                            <Text style={s.detailLabel}>Operational Definition</Text>
                            <Text style={s.detailValue}>{b.operational_definition}</Text>
                          </View>
                        )}
                        {b.antecedent && (
                          <View style={s.detailBlock}>
                            <Text style={s.detailLabel}>Antecedent</Text>
                            <Text style={s.detailValue}>{b.antecedent}</Text>
                          </View>
                        )}
                        {b.consequence && (
                          <View style={s.detailBlock}>
                            <Text style={s.detailLabel}>Consequence</Text>
                            <Text style={s.detailValue}>{b.consequence}</Text>
                          </View>
                        )}
                        {b.replacement_behavior && (
                          <View style={s.detailBlock}>
                            <Text style={s.detailLabel}>Replacement Behavior</Text>
                            <Text style={s.detailValue}>{b.replacement_behavior}</Text>
                          </View>
                        )}
                        {b.bcba_notes && (
                          <View style={[s.detailBlock, { backgroundColor: "#fefce8" }]}>
                            <Text style={[s.detailLabel, { color: "#d97706" }]}>BCBA Notes</Text>
                            <Text style={s.detailValue}>{b.bcba_notes}</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Recorded count */}
                    {behaviorEntries.filter(e => e.behaviorId === b.id).map((entry, i) => (
                      <View key={i} style={s.recordedRow}>
                        <Text style={s.recordedName}>{entry.severityLabel ?? "No severity"}</Text>
                        <View style={s.counterControls}>
                          <TouchableOpacity style={s.counterBtn}
                            onPress={() => setBehaviorEntries(prev => prev.map(e => e.behaviorId === b.id && e.severityId === entry.severityId ? { ...e, frequency: Math.max(0, e.frequency - 1) } : e).filter(e => e.frequency > 0))}>
                            <Text style={s.counterBtnText}>−</Text>
                          </TouchableOpacity>
                          <Text style={s.counterNum}>{entry.frequency}</Text>
                          <TouchableOpacity style={[s.counterBtn, s.counterBtnPlus]}
                            onPress={() => setBehaviorEntries(prev => prev.map(e => e.behaviorId === b.id && e.severityId === entry.severityId ? { ...e, frequency: e.frequency + 1 } : e))}>
                            <Text style={s.counterBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                ))}

                {/* Interventions */}
                <Text style={[s.sectionLabel, { marginTop: 20 }]}>Interventions Used</Text>
                <View style={s.chipGrid}>
                  {INTERVENTIONS.map(i => (
                    <TouchableOpacity key={i} style={[s.chip, selectedInterventions.includes(i) && s.chipActive]}
                      onPress={() => setSelectedInterventions(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}>
                      <Text style={[s.chipText, selectedInterventions.includes(i) && s.chipTextActive]}>{i}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* SKILLS TAB */}
        {activeTab === "skills" && (
          <View>
            {skillTargets.length === 0 ? (
              <View style={s.empty}><Text style={s.emptyEmoji}>🎯</Text><Text style={s.emptyTitle}>No skill targets set up</Text><Text style={s.emptyText}>Ask your BCBA to add targets in the web portal.</Text></View>
            ) : (
              skillTargets.map(target => (
                <View key={target.id} style={s.programCard}>
                  {/* Program header */}
                  <View style={s.programCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.programName}>{target.program_name}</Text>
                      <Text style={s.targetName}>{target.target_name}</Text>
                      {target.current_accuracy !== null && (
                        <Text style={s.accuracyText}>Current accuracy: {target.current_accuracy}% · {target.status}</Text>
                      )}
                    </View>
                    <TouchableOpacity style={s.expandBtn} onPress={() => setExpandedSkill(expandedSkill === target.id ? null : target.id)}>
                      <Text style={s.expandBtnText}>{expandedSkill === target.id ? "▲" : "▼"}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Expanded program details */}
                  {expandedSkill === target.id && (
                    <View style={s.programDetails}>
                      {target.sd_text && (
                        <View style={[s.detailBlock, { backgroundColor: "#eff6ff" }]}>
                          <Text style={[s.detailLabel, { color: "#2563eb" }]}>SD (Discriminative Stimulus)</Text>
                          <Text style={s.detailValue}>{target.sd_text}</Text>
                        </View>
                      )}
                      {target.instructions && (
                        <View style={s.detailBlock}>
                          <Text style={s.detailLabel}>How to Run This Program</Text>
                          <Text style={s.detailValue}>{target.instructions}</Text>
                        </View>
                      )}
                      {target.materials && (
                        <View style={s.detailBlock}>
                          <Text style={s.detailLabel}>Materials Needed</Text>
                          <Text style={s.detailValue}>{target.materials}</Text>
                        </View>
                      )}
                      {target.mastery_criteria && (
                        <View style={s.detailBlock}>
                          <Text style={s.detailLabel}>Mastery Criteria</Text>
                          <Text style={s.detailValue}>{target.mastery_criteria}</Text>
                        </View>
                      )}
                      {(target.sets_per_session || target.trials_per_set) && (
                        <View style={[s.detailBlock, { flexDirection: "row", gap: 16 }]}>
                          {target.sets_per_session && <View style={{ flex: 1 }}><Text style={s.detailLabel}>Sets/Session</Text><Text style={[s.detailValue, { fontSize: 20, fontWeight: "800", color: "#2563eb" }]}>{target.sets_per_session}</Text></View>}
                          {target.trials_per_set && <View style={{ flex: 1 }}><Text style={s.detailLabel}>Trials/Set</Text><Text style={[s.detailValue, { fontSize: 20, fontWeight: "800", color: "#2563eb" }]}>{target.trials_per_set}</Text></View>}
                        </View>
                      )}
                      {target.goal && (
                        <View style={s.detailBlock}>
                          <Text style={s.detailLabel}>Goal</Text>
                          <Text style={s.detailValue}>{target.goal}</Text>
                        </View>
                      )}
                      {target.bcba_notes && (
                        <View style={[s.detailBlock, { backgroundColor: "#fefce8" }]}>
                          <Text style={[s.detailLabel, { color: "#d97706" }]}>BCBA Notes</Text>
                          <Text style={s.detailValue}>{target.bcba_notes}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Trial recording buttons */}
                  <View style={s.trialButtons}>
                    <TouchableOpacity style={s.trialBtnCorrect}
                      onPress={() => target.prompt_levels?.length > 0 ? setPromptModal({ target, result: "correct" }) : recordTrial(target, null, null, "correct")}>
                      <Text style={s.trialBtnText}>✓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.trialBtnPrompted}
                      onPress={() => target.prompt_levels?.length > 0 ? setPromptModal({ target, result: "prompted" }) : recordTrial(target, null, null, "prompted")}>
                      <Text style={s.trialBtnText}>P</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.trialBtnIncorrect} onPress={() => recordTrial(target, null, null, "incorrect")}>
                      <Text style={s.trialBtnText}>✗</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.trialBtnNR} onPress={() => recordTrial(target, null, null, "no_response")}>
                      <Text style={s.trialBtnText}>NR</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Trial dots for this target */}
                  {trialEntries.filter(t => t.targetId === target.id).length > 0 && (
                    <View style={s.trialDotRow}>
                      {trialEntries.filter(t => t.targetId === target.id).map((t, i) => (
                        <View key={i} style={[s.trialDot,
                          t.result === "correct" ? s.trialDotCorrect
                          : t.result === "prompted" ? s.trialDotPrompted
                          : t.result === "no_response" ? s.trialDotNR
                          : s.trialDotIncorrect]} />
                      ))}
                      <Text style={s.trialDotCount}>
                        {trialEntries.filter(t => t.targetId === target.id && t.result === "correct").length}/
                        {trialEntries.filter(t => t.targetId === target.id).length} correct
                      </Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* DTT TAB */}
        {activeTab === "dtt" && (
          <View>
            <Text style={s.sectionLabel}>Program / Target</Text>
            <TextInput style={s.input} value={trialProgram} onChangeText={setTrialProgram} placeholder="e.g. Mand Training — cup" />
            {trials.length > 0 && (
              <View style={s.trialStats}>
                <Text style={s.trialCount}>{trials.length} trials · {dttPct}% correct</Text>
                <View style={s.trialBar}>
                  <View style={[s.trialBarFill, { width: `${dttPct}%` as any }]} />
                </View>
                <View style={s.trialDotRow}>
                  {trials.map((t, i) => (
                    <View key={i} style={[s.trialDot,
                      t.result === "correct" ? s.trialDotCorrect
                      : t.result === "prompted" ? s.trialDotPrompted
                      : s.trialDotIncorrect]} />
                  ))}
                </View>
              </View>
            )}
            <View style={s.trialButtons}>
              <TouchableOpacity style={s.trialBtnCorrect} onPress={() => setTrials(p => [...p, { result: "correct" }])}><Text style={s.trialBtnText}>✓ Correct</Text></TouchableOpacity>
              <TouchableOpacity style={s.trialBtnPrompted} onPress={() => setTrials(p => [...p, { result: "prompted" }])}><Text style={s.trialBtnText}>P Prompted</Text></TouchableOpacity>
              <TouchableOpacity style={s.trialBtnIncorrect} onPress={() => setTrials(p => [...p, { result: "incorrect" }])}><Text style={s.trialBtnText}>✗ Error</Text></TouchableOpacity>
            </View>
            {trials.length > 0 && (
              <TouchableOpacity onPress={() => setTrials([])} style={{ alignItems: "center", marginTop: 8 }}>
                <Text style={{ color: "#6b7280", textDecorationLine: "underline" }}>Reset trials</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* SESSION NOTES */}
        <View style={{ marginTop: 20 }}>
          <Text style={s.sectionLabel}>Session Notes</Text>
          <TextInput style={[s.input, { minHeight: 80 }]} value={sessionNotes}
            onChangeText={setSessionNotes}
            placeholder="Overall session summary, follow-up items, anything notable..."
            multiline textAlignVertical="top" />
        </View>

        {/* SAVE BUTTON */}
        <TouchableOpacity
          style={[s.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>✓ Save Session Data</Text>}
        </TouchableOpacity>
        <Text style={s.saveHint}>Saves to session record and links back to EVV visit</Text>
      </ScrollView>

      {/* SEVERITY MODAL */}
      <Modal visible={!!severityModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{severityModal?.behavior.name}</Text>
            <Text style={s.modalSubtitle}>Select severity level</Text>
            {severityModal?.behavior.severity_levels.sort((a, b) => a.level_number - b.level_number).map(level => (
              <TouchableOpacity key={level.id} style={[s.modalOption, { borderLeftColor: level.color }]}
                onPress={() => recordBehavior(severityModal.behavior, level.id, level.label, level.color)}>
                <Text style={[s.modalOptionLabel, { color: level.color }]}>{level.label}</Text>
                {level.description && <Text style={s.modalOptionDesc}>{level.description}</Text>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.modalOptionNR} onPress={() => recordBehavior(severityModal!.behavior, null, "No Severity", "#6b7280")}>
              <Text style={s.modalOptionNRText}>Record without severity</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalCancel} onPress={() => setSeverityModal(null)}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PROMPT MODAL */}
      <Modal visible={!!promptModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{promptModal?.target.target_name}</Text>
            <Text style={s.modalSubtitle}>Select prompt level</Text>
            {promptModal?.target.prompt_levels.sort((a, b) => a.level_number - b.level_number).map(level => (
              <TouchableOpacity key={level.id} style={s.promptOption}
                onPress={() => recordTrial(promptModal.target, level.id, level.label, promptModal.result)}>
                {level.abbreviation && <View style={s.promptAbbr}><Text style={s.promptAbbrText}>{level.abbreviation}</Text></View>}
                <Text style={s.promptLabel}>{level.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.modalCancel} onPress={() => setPromptModal(null)}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  successBanner: { backgroundColor: "#dcfce7", padding: 12, margin: 16, borderRadius: 10 },
  successText: { color: "#16a34a", fontWeight: "600", textAlign: "center" },
  backBtn: { backgroundColor: "#1a2234", paddingHorizontal: 16, paddingVertical: 10 },
  backBtnText: { color: "#93c5fd", fontSize: 13, fontWeight: "600" },
  screenTitle: { fontSize: 20, fontWeight: "800", color: "#111827", marginBottom: 4 },
  screenSubtitle: { fontSize: 13, color: "#6b7280", marginBottom: 20 },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151", marginBottom: 4 },
  emptyText: { fontSize: 13, color: "#9ca3af", textAlign: "center" },
  clientCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  clientAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center" },
  clientAvatarText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  clientName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  clientSub: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  chevron: { fontSize: 22, color: "#d1d5db" },
  evvCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#e5e7eb" },
  evvCardNeedsDoc: { borderColor: "#c4b5fd", borderWidth: 1.5 },
  evvDate: { fontSize: 15, fontWeight: "700", color: "#111827" },
  evvTime: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  evvLocation: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  needsDocBadge: { backgroundColor: "#ede9fe", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  needsDocText: { fontSize: 10, fontWeight: "700", color: "#7c3aed" },
  evvBar: { backgroundColor: "#1a2234", paddingHorizontal: 16, paddingVertical: 10 },
  evvBarText: { fontSize: 12, color: "#93c5fd", fontWeight: "600" },
  evvBarSub: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  tabs: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#2563eb" },
  tabText: { fontSize: 12, color: "#9ca3af", fontWeight: "500" },
  tabTextActive: { color: "#2563eb", fontWeight: "700" },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", marginBottom: 10, letterSpacing: 0.5 },
  programCard: { backgroundColor: "#fff", borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden" },
  programCardHeader: { flexDirection: "row", alignItems: "center", padding: 12, gap: 8 },
  programName: { fontSize: 11, fontWeight: "700", color: "#7c3aed", textTransform: "uppercase" },
  targetName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  accuracyText: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  recordBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  recordBtnRed: { backgroundColor: "#dc2626" },
  recordBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  expandBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", backgroundColor: "#f3f4f6", borderRadius: 8 },
  expandBtnText: { fontSize: 12, color: "#6b7280" },
  programDetails: { padding: 12, backgroundColor: "#f9fafb", borderTopWidth: 1, borderTopColor: "#f3f4f6", gap: 8 },
  detailBlock: { backgroundColor: "#fff", borderRadius: 8, padding: 10 },
  detailLabel: { fontSize: 10, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", marginBottom: 4 },
  detailValue: { fontSize: 13, color: "#374151", lineHeight: 18 },
  recordedRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  recordedName: { flex: 1, fontSize: 13, color: "#374151" },
  counterControls: { flexDirection: "row", alignItems: "center", gap: 10 },
  counterBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  counterBtnPlus: { backgroundColor: "#2563eb" },
  counterBtnText: { fontSize: 16, color: "#374151", fontWeight: "700" },
  counterNum: { fontSize: 18, fontWeight: "800", color: "#111827", minWidth: 28, textAlign: "center" },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#fff" },
  chipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { fontSize: 12, color: "#374151" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  trialButtons: { flexDirection: "row", gap: 6, padding: 10 },
  trialBtnCorrect: { flex: 1, backgroundColor: "#16a34a", paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  trialBtnPrompted: { flex: 1, backgroundColor: "#d97706", paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  trialBtnIncorrect: { flex: 1, backgroundColor: "#dc2626", paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  trialBtnNR: { flex: 1, backgroundColor: "#6b7280", paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  trialBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  trialDotRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, paddingHorizontal: 12, paddingBottom: 10, alignItems: "center" },
  trialDot: { width: 12, height: 12, borderRadius: 6 },
  trialDotCorrect: { backgroundColor: "#16a34a" },
  trialDotPrompted: { backgroundColor: "#d97706" },
  trialDotIncorrect: { backgroundColor: "#dc2626" },
  trialDotNR: { backgroundColor: "#6b7280" },
  trialDotCount: { fontSize: 11, color: "#6b7280", marginLeft: 4 },
  trialStats: { backgroundColor: "#eff6ff", borderRadius: 12, padding: 14, marginBottom: 16 },
  trialCount: { fontSize: 13, color: "#6b7280", marginBottom: 6 },
  trialBar: { height: 8, backgroundColor: "#dbeafe", borderRadius: 4, marginBottom: 8 },
  trialBarFill: { height: 8, backgroundColor: "#2563eb", borderRadius: 4 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#111827", marginBottom: 14, backgroundColor: "#fff" },
  saveBtn: { backgroundColor: "#2563eb", paddingVertical: 16, borderRadius: 14, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  saveHint: { fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 8, marginBottom: 20 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: "#6b7280", marginBottom: 16 },
  modalOption: { borderLeftWidth: 4, borderRadius: 8, padding: 14, marginBottom: 8, backgroundColor: "#f9fafb" },
  modalOptionLabel: { fontSize: 14, fontWeight: "700" },
  modalOptionDesc: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  modalOptionNR: { padding: 14, alignItems: "center" },
  modalOptionNRText: { color: "#6b7280", fontSize: 13, textDecorationLine: "underline" },
  modalCancel: { padding: 14, alignItems: "center", borderTopWidth: 1, borderTopColor: "#f3f4f6", marginTop: 8 },
  modalCancelText: { color: "#6b7280", fontSize: 14, fontWeight: "600" },
  promptOption: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", gap: 12 },
  promptAbbr: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center" },
  promptAbbrText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  promptLabel: { fontSize: 14, color: "#374151", fontWeight: "600" },
});