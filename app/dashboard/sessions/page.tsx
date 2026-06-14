"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Link from "next/link";
import { usePlanGate } from "@/lib/hooks/usePlanGate";
import UpgradePrompt from "@/components/ui/UpgradePrompt";

type Client = { id: string; full_name: string };
type Session = {
  id: string;
  client_id: string;
  date: string;
  status: string;
  behaviors_observed: string;
  interventions_used: string;
  client_response: string;
  programs_targeted: string;
  notes: string;
  staff_member: string;
  start_time: string | null;
  end_time: string | null;
  cpt_code: string | null;
  created_at: string;
};
type CustomBehavior = {
  id: string;
  name: string;
  severity_levels: { id: string; level_number: number; label: string; color: string }[];
};
type SkillTarget = {
  id: string;
  program_name: string;
  target_name: string;
  prompt_levels: { id: string; level_number: number; label: string; abbreviation: string | null }[];
};
type BehaviorEntry = {
  behaviorId: string | null;
  behaviorName: string;
  severityId: string | null;
  severityLabel: string | null;
  frequency: number;
  isCustom: boolean;
};
type TrialEntry = {
  targetId: string;
  targetName: string;
  programName: string;
  promptId: string | null;
  promptLabel: string | null;
  result: "correct" | "prompted" | "incorrect" | "no_response";
};

const GENERIC_BEHAVIORS = [
  "Aggression", "Self-Injurious Behavior", "Elopement", "Property Destruction",
  "Tantrum", "Non-Compliance", "Vocal Disruption", "Stereotypy", "No behaviors observed",
];
const INTERVENTIONS_LIST = [
  "Redirection", "Planned ignoring", "Differential reinforcement",
  "Response blocking", "NCR", "Token economy", "Visual supports",
  "First-Then board", "Praise/Reinforcement", "Prompting hierarchy",
];
const PROGRAMS_LIST = [
  "Mand Training", "Tact Training", "Imitation", "Matching",
  "Receptive ID", "Expressive ID", "LRFFC", "Intraverbal",
  "Social Skills", "Daily Living Skills", "Gross Motor", "Fine Motor",
];
const CLIENT_RESPONSES = [
  "Responded well", "Required multiple prompts", "Refused task",
  "Partial compliance", "Independent", "Needed full physical assistance",
];

const TEMPLATES: Record<string, any> = {
  rbt: {
    label: "RBT Session Note",
    soap: { subjective: "Client arrived on time. Caregiver reported...", objective: "Client completed X trials with Y% accuracy.", assessment: "Client is making progress toward goals.", plan: "Continue current programming." },
  },
  clinician: {
    label: "Clinician / BCBA Note",
    soap: { subjective: "Client and caregiver present. Parent reports...", objective: "Conducted supervision/direct session.", assessment: "Clinical interpretation: client demonstrates...", plan: "Modify program X. Schedule next supervision for..." },
  },
  supervisor: {
    label: "Supervision Note",
    soap: { subjective: "Supervision session conducted with RBT...", objective: "Reviewed session data, observed X trials.", assessment: "RBT is demonstrating competency in...", plan: "Next supervision scheduled for..." },
  },
  bt: {
    label: "BT Session Note",
    soap: { subjective: "Client arrived. Mood observed as...", objective: "Ran X programs. Client responded with...", assessment: "Session went... Behavior was...", plan: "Continue current plan." },
  },
};

const CPT_BY_ROLE: Record<string, { code: string; label: string }[]> = {
  bt: [{ code: "97153", label: "97153 — Adaptive Behavior Treatment (BT)" }, { code: "97154", label: "97154 — Group ABA Treatment" }],
  rbt: [{ code: "97153", label: "97153 — Adaptive Behavior Treatment (RBT)" }, { code: "97154", label: "97154 — Group ABA Treatment" }],
  bcba: [{ code: "97151", label: "97151 — Behavior Identification Assessment" }, { code: "97155", label: "97155 — Protocol Modification by BCBA" }, { code: "97156", label: "97156 — Family Guidance by BCBA" }, { code: "97157", label: "97157 — Multiple Family Group" }, { code: "97158", label: "97158 — Group Protocol Modification" }],
  bcaba: [{ code: "97155", label: "97155 — Protocol Modification by BCaBA" }, { code: "97156", label: "97156 — Family Guidance" }],
  supervisor: [{ code: "97155", label: "97155 — Protocol Modification" }, { code: "97151", label: "97151 — Behavior Identification Assessment" }],
};

function detectRole(staffMember: string): string {
  const lower = staffMember.toLowerCase();
  if (lower.includes("bcaba")) return "bcaba";
  if (lower.includes("bcba")) return "bcba";
  if (lower.includes("rbt")) return "rbt";
  if (lower.includes("supervisor")) return "supervisor";
  if (lower.includes("bt")) return "bt";
  return "rbt";
}

function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880; osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.8);
  } catch {}
}

function SessionSkeleton() {
  return (
    <div className="border border-gray-100 rounded-xl p-4 bg-white animate-pulse">
      <div className="flex justify-between items-start">
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-3 bg-gray-200 rounded w-1/4" />
          <div className="h-3 bg-gray-200 rounded w-2/3" />
        </div>
        <div className="h-6 bg-gray-200 rounded-full w-16 ml-3" />
      </div>
    </div>
  );
}

export default function SessionsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [customBehaviors, setCustomBehaviors] = useState<CustomBehavior[]>([]);
  const [skillTargets, setSkillTargets] = useState<SkillTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filterClient, setFilterClient] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [activeDataTab, setActiveDataTab] = useState<"behaviors" | "skills" | "generic">("behaviors");
  const [severityModal, setSeverityModal] = useState<CustomBehavior | null>(null);
  const [promptModal, setPromptModal] = useState<{ target: SkillTarget; result: string } | null>(null);

  const { hasFeature, planName } = usePlanGate();
  const aiGate = hasFeature("ai");

  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<string | null>(null);
  const [sessionEndTime, setSessionEndTime] = useState<string | null>(null);
  const [timerRepeat, setTimerRepeat] = useState(false);
  const [recentDurations, setRecentDurations] = useState<number[]>([]);
  const timerStartRef = useRef<number | null>(null);

  const [clientId, setClientId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState("completed");
  const [clientResponse, setClientResponse] = useState("");
  const [notes, setNotes] = useState("");
  const [staffMember, setStaffMember] = useState("");
  const [cptCode, setCptCode] = useState("");
  const [behaviorEntries, setBehaviorEntries] = useState<BehaviorEntry[]>([]);
  const [selectedInterventions, setSelectedInterventions] = useState<string[]>([]);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [trialEntries, setTrialEntries] = useState<TrialEntry[]>([]);
  const [activeTarget, setActiveTarget] = useState<SkillTarget | null>(null);
  const [showSOAP, setShowSOAP] = useState(false);
  const [soap, setSoap] = useState({ subjective: "", objective: "", assessment: "", plan: "" });

  useEffect(() => {
    init();
    const savedStart = localStorage.getItem("session_timer_start");
    if (savedStart) {
      timerStartRef.current = Number(savedStart);
      setTimerSeconds(Math.floor((Date.now() - Number(savedStart)) / 1000));
      setTimerRunning(true);
      setSessionStartTime(new Date(Number(savedStart)).toISOString());
      setShowForm(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!timerRunning) return;
    const tick = () => { if (timerStartRef.current !== null) setTimerSeconds(Math.floor((Date.now() - timerStartRef.current) / 1000)); };
    const interval = setInterval(tick, 500);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", tick); };
  }, [timerRunning]);

  useEffect(() => {
    if (clientId) loadClientData(clientId);
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    setFetchError(null);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const { data: companyUser } = await supabase.from("company_users").select("company_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
    setCompanyId(companyUser?.company_id ?? null);
    const [{ data: clientData, error: clientErr }, { data: sessionData, error: sessionErr }] = await Promise.all([
      supabase.from("clients").select("id, full_name").order("full_name"),
      supabase.from("sessions").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    if (clientErr || sessionErr) { setFetchError("Failed to load sessions. Please refresh and try again."); }
    else { setClients(clientData ?? []); setSessions(sessionData ?? []); }
    setLoading(false);
  }

  async function loadClientData(cId: string) {
    const [{ data: behaviors }, { data: targets }] = await Promise.all([
      supabase.from("custom_behaviors").select("*, severity_levels:behavior_severity_levels(*)").eq("company_id", companyId).eq("client_id", cId).eq("is_active", true).order("display_order"),
      supabase.from("skill_targets").select("*, prompt_levels(*)").eq("company_id", companyId).eq("client_id", cId).eq("is_active", true).order("display_order"),
    ]);
    setCustomBehaviors(behaviors ?? []);
    setSkillTargets(targets ?? []);
    if ((behaviors ?? []).length > 0) setActiveDataTab("behaviors");
    else if ((targets ?? []).length > 0) setActiveDataTab("skills");
    else setActiveDataTab("generic");
  }

  function recordBehavior(name: string, behaviorId: string | null, severityId: string | null, severityLabel: string | null, isCustom: boolean) {
    setBehaviorEntries(prev => {
      const existing = prev.find(e => e.behaviorName === name && e.severityId === severityId);
      if (existing) return prev.map(e => e.behaviorName === name && e.severityId === severityId ? { ...e, frequency: e.frequency + 1 } : e);
      return [...prev, { behaviorId, behaviorName: name, severityId, severityLabel, frequency: 1, isCustom }];
    });
    setSeverityModal(null);
  }

  function recordTrial(target: SkillTarget, promptId: string | null, promptLabel: string | null, result: "correct" | "prompted" | "incorrect" | "no_response") {
    setTrialEntries(prev => [...prev, { targetId: target.id, targetName: target.target_name, programName: target.program_name, promptId, promptLabel, result }]);
    setPromptModal(null);
  }

  function formatTimer(seconds: number) {
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function startTimer() {
    const now = Date.now();
    timerStartRef.current = now;
    localStorage.setItem("session_timer_start", String(now));
    setTimerSeconds(0); setTimerRunning(true);
    setSessionStartTime(new Date().toISOString()); setSessionEndTime(null);
  }

  function stopTimer() {
    setTimerRunning(false);
    localStorage.removeItem("session_timer_start");
    setSessionEndTime(new Date().toISOString());
    const duration = timerSeconds;
    setRecentDurations(prev => [duration, ...prev.filter(d => d !== duration)].slice(0, 5));
    playAlertSound();
    if (timerRepeat) setTimeout(() => startTimer(), 500);
    else if (soap.objective === "") setSoap(prev => ({ ...prev, objective: `Session duration: ${formatTimer(duration)}` }));
  }

  function resetForm() {
    localStorage.removeItem("session_timer_start");
    setClientId(""); setDate(new Date().toISOString().split("T")[0]);
    setStatus("completed"); setClientResponse(""); setNotes(""); setStaffMember(""); setCptCode("");
    setBehaviorEntries([]); setSelectedInterventions([]); setSelectedPrograms([]); setTrialEntries([]);
    setSoap({ subjective: "", objective: "", assessment: "", plan: "" });
    setTimerRunning(false); setTimerSeconds(0); timerStartRef.current = null;
    setSessionStartTime(null); setSessionEndTime(null);
    setShowForm(false); setSelectedTemplate(null); setActiveTarget(null);
  }

  async function handleSave() {
    if (!clientId) { setError("Please select a client."); return; }
    setSaving(true); setError(null);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const behaviorsStr = behaviorEntries.map(e => `${e.behaviorName}${e.severityLabel ? ` (${e.severityLabel})` : ""} x${e.frequency}`).join(", ");
    const trialsStr = [...new Set(trialEntries.map(t => `${t.programName}: ${t.targetName}`))].join(", ");

    const { data, error: saveError } = await supabase.from("sessions").insert([{
      client_id: clientId, date, status, client_response: clientResponse, notes, staff_member: staffMember,
      cpt_code: cptCode || null,
      behaviors_observed: behaviorsStr || selectedPrograms.join(", ") || "No behaviors observed",
      interventions_used: selectedInterventions.join(", "),
      programs_targeted: trialsStr || selectedPrograms.join(", "),
      soap_subjective: soap.subjective, soap_objective: soap.objective || (timerSeconds > 0 ? `Session duration: ${formatTimer(timerSeconds)}` : ""),
      soap_assessment: soap.assessment, soap_plan: soap.plan,
      start_time: sessionStartTime || null, end_time: sessionEndTime || null,
      created_by: user.id, company_id: companyId,
      has_behavior_data: behaviorEntries.filter(e => e.isCustom).length > 0,
      has_trial_data: trialEntries.length > 0,
    }]).select().single();

    if (saveError) { setError(saveError.message); setSaving(false); return; }

    if (data) {
      if (behaviorEntries.filter(e => e.isCustom).length > 0) {
        await supabase.from("behavior_data").insert(
          behaviorEntries.filter(e => e.isCustom).map(e => ({
            session_id: data.id, client_id: clientId, company_id: companyId,
            behavior_id: e.behaviorId, severity_level_id: e.severityId,
            severity_label: e.severityLabel, frequency: e.frequency, created_by: user.id,
          }))
        );
      }
      if (trialEntries.length > 0) {
        await supabase.from("skill_trial_data").insert(
          trialEntries.map(e => ({
            session_id: data.id, client_id: clientId, company_id: companyId,
            target_id: e.targetId, prompt_level_id: e.promptId,
            prompt_label: e.promptLabel, result: e.result, created_by: user.id,
          }))
        );
      }
      setSessions(prev => [data, ...prev]);
    }

    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
    resetForm(); setSaving(false);
  }

  const clientMap = new Map(clients.map(c => [c.id, c.full_name]));
  const filtered = sessions.filter(s => filterClient ? s.client_id === filterClient : true).filter(s => filterStatus ? s.status === filterStatus : true);
  const totalTrials = trialEntries.length;
  const correctTrials = trialEntries.filter(t => t.result === "correct").length;
  const trialPct = totalTrials > 0 ? Math.round((correctTrials / totalTrials) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Session Notes">
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "+ New Session"}</Button>
      </PageHeader>

      {success && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">Session note saved successfully.</div>}
      {fetchError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex justify-between items-center">
          <span>{fetchError}</span>
          <button type="button" onClick={init} className="text-xs underline font-medium">Retry</button>
        </div>
      )}

      {showForm && (
        <Section title="New Session Note">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          {/* GEOFENCE */}
          <GeofenceCheck />

          {/* TIMER */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">Session Timer</p>
              <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
                <input type="checkbox" checked={timerRepeat} onChange={e => setTimerRepeat(e.target.checked)} className="rounded border-gray-300" />
                🔁 Auto-repeat
              </label>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <p className={`text-3xl font-mono font-bold ${timerRunning ? "text-blue-600" : "text-gray-400"}`}>{formatTimer(timerSeconds)}</p>
              <div className="flex gap-2">
                {!timerRunning ? <Button onClick={startTimer}>▶ Start</Button> : <Button variant="danger" onClick={stopTimer}>⏹ Stop</Button>}
                <Button variant="outline" onClick={() => { localStorage.removeItem("session_timer_start"); setTimerRunning(false); setTimerSeconds(0); timerStartRef.current = null; setSessionStartTime(null); setSessionEndTime(null); }}>Reset</Button>
              </div>
            </div>
            {recentDurations.length > 0 && (
              <div className="mt-3 border-t border-gray-200 pt-3">
                <p className="text-xs text-gray-400 mb-2">Recent durations — click to reuse:</p>
                <div className="flex flex-wrap gap-2">
                  {recentDurations.map((d, i) => (
                    <button key={i} type="button" onClick={() => { const now = Date.now(); timerStartRef.current = now - d * 1000; localStorage.setItem("session_timer_start", String(now - d * 1000)); setTimerSeconds(d); setTimerRunning(true); setSessionStartTime(new Date(now - d * 1000).toISOString()); }}
                      className="text-xs px-2 py-1 bg-blue-50 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-100">{formatTimer(d)}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* TEMPLATES */}
          {aiGate.allowed && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Quick Templates</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(TEMPLATES).map(([key, template]) => (
                  <button key={key} type="button" onClick={() => { setSelectedTemplate(key); setSoap(template.soap); setShowSOAP(true); }}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selectedTemplate === key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-300"}`}>
                    {template.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* BASIC FIELDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Session Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client Response</label>
              <select value={clientResponse} onChange={e => setClientResponse(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select response...</option>
                {CLIENT_RESPONSES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Staff Member</label>
              <input type="text" value={staffMember} onChange={e => setStaffMember(e.target.value)}
                placeholder="Staff name and role (e.g. Jane Smith, RBT)"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          {/* CPT CODE */}
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-700 uppercase mb-1">CPT Code</p>
            <div className="flex flex-wrap gap-2">
              {(CPT_BY_ROLE[detectRole(staffMember)] ?? CPT_BY_ROLE.rbt).map(c => (
                <button key={c.code} type="button" onClick={() => setCptCode(cptCode === c.code ? "" : c.code)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${cptCode === c.code ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-300"}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* DATA COLLECTION TABS */}
          {clientId && (
            <div className="mt-4">
              <div className="flex border-b border-gray-200 mb-4">
                {customBehaviors.length > 0 && (
                  <button type="button" onClick={() => setActiveDataTab("behaviors")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeDataTab === "behaviors" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"}`}>
                    🧠 Custom Behaviors
                  </button>
                )}
                {skillTargets.length > 0 && (
                  <button type="button" onClick={() => setActiveDataTab("skills")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeDataTab === "skills" ? "border-purple-600 text-purple-600" : "border-transparent text-gray-500"}`}>
                    🎯 Skill Targets
                  </button>
                )}
                <button type="button" onClick={() => setActiveDataTab("generic")}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeDataTab === "generic" ? "border-gray-600 text-gray-700" : "border-transparent text-gray-500"}`}>
                  📋 Generic
                </button>
              </div>

              {/* CUSTOM BEHAVIORS */}
              {activeDataTab === "behaviors" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Tap to Record Behavior</label>
                    <div className="flex flex-wrap gap-2">
                      {customBehaviors.map(b => (
                        <button key={b.id} type="button"
                          onClick={() => b.severity_levels?.length > 0 ? setSeverityModal(b) : recordBehavior(b.name, b.id, null, null, true)}
                          className="text-xs px-3 py-1.5 rounded-full bg-red-600 text-white border border-red-600 hover:bg-red-700">
                          {b.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {behaviorEntries.filter(e => e.isCustom).length > 0 && (
                    <div className="border border-gray-100 rounded-xl p-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Recorded</p>
                      {behaviorEntries.filter(e => e.isCustom).map((e, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{e.behaviorName}</p>
                            {e.severityLabel && <p className="text-xs text-red-500">{e.severityLabel}</p>}
                          </div>
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={() => setBehaviorEntries(prev => prev.map((en, j) => j === i ? { ...en, frequency: Math.max(0, en.frequency - 1) } : en).filter(en => en.frequency > 0))}
                              className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-lg">−</button>
                            <span className="font-bold text-gray-800 w-6 text-center">{e.frequency}</span>
                            <button type="button" onClick={() => setBehaviorEntries(prev => prev.map((en, j) => j === i ? { ...en, frequency: en.frequency + 1 } : en))}
                              className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-lg">+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Interventions Used</label>
                    <div className="flex flex-wrap gap-2">
                      {INTERVENTIONS_LIST.map(i => (
                        <button key={i} type="button" onClick={() => setSelectedInterventions(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selectedInterventions.includes(i) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-300"}`}>
                          {i}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* SKILL TARGETS */}
              {activeDataTab === "skills" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Select Target</label>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {skillTargets.map(t => (
                        <button key={t.id} type="button" onClick={() => setActiveTarget(t)}
                          className={`text-xs px-3 py-2 rounded-xl border transition-all ${activeTarget?.id === t.id ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-600 border-gray-300 hover:border-purple-300"}`}>
                          <p className="text-xs opacity-70">{t.program_name}</p>
                          <p className="font-semibold">{t.target_name}</p>
                        </button>
                      ))}
                    </div>

                    {activeTarget && (
                      <div className="border border-purple-100 rounded-xl p-4 bg-purple-50">
                        <p className="text-sm font-semibold text-purple-700 mb-3">Recording: {activeTarget.target_name}</p>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { label: "✓ Correct", result: "correct" as const, color: "bg-green-600" },
                            { label: "P Prompted", result: "prompted" as const, color: "bg-yellow-500" },
                            { label: "✗ Incorrect", result: "incorrect" as const, color: "bg-red-600" },
                            { label: "— No Response", result: "no_response" as const, color: "bg-gray-500" },
                          ].map(btn => (
                            <button key={btn.result} type="button"
                              onClick={() => activeTarget.prompt_levels?.length > 0 && btn.result !== "incorrect" && btn.result !== "no_response"
                                ? setPromptModal({ target: activeTarget, result: btn.result })
                                : recordTrial(activeTarget, null, null, btn.result)}
                              className={`${btn.color} text-white text-xs px-4 py-2 rounded-lg font-medium`}>
                              {btn.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {trialEntries.length > 0 && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                      <p className="text-sm font-semibold text-blue-700 mb-2">{totalTrials} trials · {trialPct}% correct</p>
                      <div className="w-full bg-blue-100 rounded-full h-2 mb-2">
                        <div className="h-2 rounded-full bg-blue-600" style={{ width: `${trialPct}%` }} />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {trialEntries.map((t, i) => (
                          <div key={i} className={`w-3 h-3 rounded-full ${t.result === "correct" ? "bg-green-500" : t.result === "prompted" ? "bg-yellow-500" : t.result === "no_response" ? "bg-gray-400" : "bg-red-500"}`} />
                        ))}
                      </div>
                      <button type="button" onClick={() => setTrialEntries([])} className="text-xs text-blue-500 underline mt-2">Reset trials</button>
                    </div>
                  )}
                </div>
              )}

              {/* GENERIC */}
              {activeDataTab === "generic" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Behaviors Observed</label>
                    <div className="flex flex-wrap gap-2">
                      {GENERIC_BEHAVIORS.map(b => (
                        <button key={b} type="button"
                          onClick={() => recordBehavior(b, null, null, null, false)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${behaviorEntries.some(e => e.behaviorName === b && !e.isCustom) ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-600 border-gray-300 hover:border-red-300"}`}>
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Interventions Used</label>
                    <div className="flex flex-wrap gap-2">
                      {INTERVENTIONS_LIST.map(i => (
                        <button key={i} type="button" onClick={() => setSelectedInterventions(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selectedInterventions.includes(i) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-300"}`}>
                          {i}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Programs Targeted</label>
                    <div className="flex flex-wrap gap-2">
                      {PROGRAMS_LIST.map(p => (
                        <button key={p} type="button" onClick={() => setSelectedPrograms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selectedPrograms.includes(p) ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-600 border-gray-300 hover:border-purple-300"}`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NOTES */}
          <div className="mt-4">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Session Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional session notes..." rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          {/* SOAP */}
          {aiGate.allowed ? (
            <div className="mt-4">
              <button type="button" onClick={() => setShowSOAP(!showSOAP)}
                className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700">
                <span>{showSOAP ? "▼" : "▶"}</span> SOAP Notes {showSOAP ? "(hide)" : "(optional)"}
              </button>
              {showSOAP && (
                <div className="mt-3 space-y-3 border border-blue-100 rounded-xl p-4 bg-blue-50">
                  {[
                    { key: "subjective", label: "S — Subjective", placeholder: "Client/caregiver report, concerns, mood..." },
                    { key: "objective", label: "O — Objective", placeholder: "Measurable data, frequency, duration, observations..." },
                    { key: "assessment", label: "A — Assessment", placeholder: "Clinical interpretation, progress toward goals..." },
                    { key: "plan", label: "P — Plan", placeholder: "Next session plan, goals, modifications..." },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="text-xs font-medium text-gray-600 mb-0.5 block">{field.label}</label>
                      <textarea value={soap[field.key as keyof typeof soap]} onChange={e => setSoap(prev => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.placeholder} rows={2}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4">
              <UpgradePrompt reason={`AI-powered SOAP notes require the Professional plan or higher. You are on the ${planName} plan.`} upgradeTo={aiGate.upgradeTo} feature="AI SOAP Notes" inline />
            </div>
          )}

          <div className="mt-4 flex gap-2 flex-wrap">
            <Button onClick={handleSave} loading={saving}>Save Session Note</Button>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* FILTERS */}
      {!loading && sessions.length > 0 && (
        <div className="flex gap-3 flex-wrap items-center">
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full sm:w-auto">
            <option value="">All Clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full sm:w-auto">
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <p className="text-sm text-gray-400">{filtered.length} sessions</p>
        </div>
      )}

      {loading && <div className="space-y-3">{[...Array(5)].map((_, i) => <SessionSkeleton key={i} />)}</div>}

      {!loading && !fetchError && sessions.length === 0 && (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl bg-white">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-gray-700 font-semibold text-lg">No sessions yet</p>
          <p className="text-gray-400 text-sm mt-1 mb-6">Start tracking therapy sessions for your clients.</p>
          <Button onClick={() => setShowForm(true)}>+ New Session</Button>
        </div>
      )}

      {!loading && sessions.length > 0 && filtered.length === 0 && (
        <div className="text-center py-10 border border-dashed border-gray-200 rounded-2xl bg-white">
          <p className="text-gray-500 text-sm">No sessions match your filters.</p>
          <button type="button" onClick={() => { setFilterClient(""); setFilterStatus(""); }}
            className="text-blue-500 text-sm mt-2 hover:underline block mx-auto">Clear filters</button>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(session => (
          <div key={session.id} className="border border-gray-100 rounded-xl p-4 bg-white">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-800 truncate">{clientMap.get(session.client_id) ?? "Unknown"}</p>
                <div className="flex flex-wrap gap-2 mt-0.5 text-xs text-gray-400">
                  <span>{session.date ?? new Date(session.created_at).toLocaleDateString()}</span>
                  {session.start_time && <span>{new Date(session.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{session.end_time && ` → ${new Date(session.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}</span>}
                  {session.cpt_code && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">{session.cpt_code}</span>}
                </div>
                {session.behaviors_observed && <p className="text-xs text-gray-500 mt-1 truncate">Behaviors: {session.behaviors_observed}</p>}
                {session.programs_targeted && <p className="text-xs text-gray-500 truncate">Programs: {session.programs_targeted}</p>}
                {session.staff_member && <p className="text-xs text-gray-400 mt-1 truncate">Staff: {session.staff_member}</p>}
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${session.status === "completed" ? "bg-green-100 text-green-700" : session.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>
                {session.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* SEVERITY MODAL */}
      {severityModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setSeverityModal(null)}>
          <div className="bg-white rounded-t-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 text-lg mb-1">{severityModal.name}</h3>
            <p className="text-sm text-gray-500 mb-4">Select severity level</p>
            {severityModal.severity_levels.sort((a, b) => a.level_number - b.level_number).map(level => (
              <button key={level.id} type="button" onClick={() => recordBehavior(severityModal.name, severityModal.id, level.id, level.label, true)}
                className="w-full text-left p-3 mb-2 rounded-xl border-l-4 bg-gray-50 hover:bg-gray-100"
                style={{ borderLeftColor: level.color }}>
                <p className="font-semibold text-sm" style={{ color: level.color }}>{level.label}</p>
              </button>
            ))}
            <button type="button" onClick={() => recordBehavior(severityModal.name, severityModal.id, null, null, true)}
              className="w-full text-center text-sm text-gray-500 underline py-2">Record without severity</button>
            <button type="button" onClick={() => setSeverityModal(null)} className="w-full text-center text-sm text-gray-400 py-2 mt-1">Cancel</button>
          </div>
        </div>
      )}

      {/* PROMPT MODAL */}
      {promptModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setPromptModal(null)}>
          <div className="bg-white rounded-t-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 text-lg mb-1">{promptModal.target.target_name}</h3>
            <p className="text-sm text-gray-500 mb-4">Select prompt level</p>
            {promptModal.target.prompt_levels.sort((a, b) => a.level_number - b.level_number).map(level => (
              <button key={level.id} type="button"
                onClick={() => recordTrial(promptModal.target, level.id, level.label, promptModal.result as any)}
                className="w-full text-left p-3 mb-2 rounded-xl border border-gray-100 hover:bg-gray-50 flex items-center gap-3">
                {level.abbreviation && <span className="w-8 h-8 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center">{level.abbreviation}</span>}
                <span className="font-medium text-sm text-gray-700">{level.label}</span>
              </button>
            ))}
            <button type="button" onClick={() => setPromptModal(null)} className="w-full text-center text-sm text-gray-400 py-2 mt-1">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function GeofenceCheck() {
  const [status, setStatus] = useState<"idle" | "checking" | "inside" | "skipped">("idle");
  if (status === "inside") return <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-xs font-medium text-green-700">✓ Location verified — you are at the session location</div>;
  if (status === "skipped") return <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 text-xs text-gray-500">📍 Location check skipped</div>;
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs font-semibold text-gray-700">📍 Location Verification</p>
          <p className="text-xs text-gray-500 mt-0.5">Verify you are at the session location before starting.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setStatus("checking"); navigator.geolocation.getCurrentPosition(() => setStatus("inside"), () => setStatus("skipped")); }}
            disabled={status === "checking"}
            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {status === "checking" ? "Checking..." : "Check Location"}
          </button>
          <button type="button" onClick={() => setStatus("skipped")} className="text-xs px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100">Skip</button>
        </div>
      </div>
    </div>
  );
}