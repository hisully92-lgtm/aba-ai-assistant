"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Link from "next/link";

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

const BEHAVIORS_LIST = [
  "Aggression", "Self-Injurious Behavior", "Elopement", "Property Destruction",
  "Tantrum", "Non-Compliance", "Vocal Disruption", "Stereotypy", "No behaviors observed"
];
const INTERVENTIONS_LIST = [
  "Redirection", "Planned ignoring", "Differential reinforcement",
  "Response blocking", "NCR", "Token economy", "Visual supports",
  "First-Then board", "Praise/Reinforcement", "Prompting hierarchy"
];
const PROGRAMS_LIST = [
  "Mand Training", "Tact Training", "Imitation", "Matching",
  "Receptive ID", "Expressive ID", "LRFFC", "Intraverbal",
  "Social Skills", "Daily Living Skills", "Gross Motor", "Fine Motor"
];
const CLIENT_RESPONSES = [
  "Responded well", "Required multiple prompts", "Refused task",
  "Partial compliance", "Independent", "Needed full physical assistance"
];

type Template = {
  label: string;
  behaviors: string[];
  interventions: string[];
  programs: string[];
  soap: { subjective: string; objective: string; assessment: string; plan: string };
};

const TEMPLATES: Record<string, Template> = {
  rbt: {
    label: "RBT Session Note",
    behaviors: ["Aggression", "Non-Compliance", "Stereotypy"],
    interventions: ["Redirection", "Differential reinforcement", "Prompting hierarchy"],
    programs: ["Mand Training", "Tact Training", "Imitation"],
    soap: {
      subjective: "Client arrived on time. Caregiver reported...",
      objective: "Client completed X trials with Y% accuracy. Behaviors observed: frequency, duration.",
      assessment: "Client is making progress toward goals. Behavior frequency has...",
      plan: "Continue current programming. Increase difficulty on mastered targets.",
    },
  },
  clinician: {
    label: "Clinician / BCBA Note",
    behaviors: ["Non-Compliance", "Vocal Disruption"],
    interventions: ["Differential reinforcement", "NCR", "Token economy"],
    programs: ["Social Skills", "Daily Living Skills", "Intraverbal"],
    soap: {
      subjective: "Client and caregiver present. Parent reports...",
      objective: "Conducted supervision/direct session. Data reviewed: goals trending...",
      assessment: "Clinical interpretation: client demonstrates...",
      plan: "Modify program X. Schedule next supervision for...",
    },
  },
  supervisor: {
    label: "Supervision Note",
    behaviors: [],
    interventions: [],
    programs: [],
    soap: {
      subjective: "Supervision session conducted with RBT...",
      objective: "Reviewed session data, observed X trials, provided feedback on...",
      assessment: "RBT is demonstrating competency in... Areas for improvement include...",
      plan: "Next supervision scheduled for... Focus areas: ...",
    },
  },
  bt: {
    label: "BT Session Note",
    behaviors: ["Aggression", "Self-Injurious Behavior", "Elopement"],
    interventions: ["Redirection", "Response blocking", "Praise/Reinforcement"],
    programs: ["Mand Training", "Imitation", "Matching"],
    soap: {
      subjective: "Client arrived. Mood observed as...",
      objective: "Ran X programs. Client responded with...",
      assessment: "Session went... Behavior was...",
      plan: "Continue current plan. Report observations to supervisor.",
    },
  },
  parent: {
    label: "Parent/Caregiver Note",
    behaviors: [],
    interventions: [],
    programs: [],
    soap: {
      subjective: "Home session conducted. Parent/caregiver present.",
      objective: "Practiced home program strategies. Child responded...",
      assessment: "Generalization of skills observed at home...",
      plan: "Continue home practice. Questions for next session...",
    },
  },
};

const CPT_BY_ROLE: Record<string, { code: string; label: string }[]> = {
  bt: [
    { code: "97153", label: "97153 — Adaptive Behavior Treatment (BT)" },
    { code: "97154", label: "97154 — Group ABA Treatment" },
  ],
  rbt: [
    { code: "97153", label: "97153 — Adaptive Behavior Treatment (RBT)" },
    { code: "97154", label: "97154 — Group ABA Treatment" },
  ],
  bcba: [
    { code: "97151", label: "97151 — Behavior Identification Assessment" },
    { code: "97155", label: "97155 — Protocol Modification by BCBA" },
    { code: "97156", label: "97156 — Family Guidance by BCBA" },
    { code: "97157", label: "97157 — Multiple Family Group" },
    { code: "97158", label: "97158 — Group Protocol Modification" },
  ],
  bcaba: [
    { code: "97155", label: "97155 — Protocol Modification by BCaBA" },
    { code: "97156", label: "97156 — Family Guidance" },
  ],
  supervisor: [
    { code: "97155", label: "97155 — Protocol Modification" },
    { code: "97151", label: "97151 — Behavior Identification Assessment" },
  ],
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
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
  } catch {}
}

function CptCodeSelector({ staffMember, onSelect, selectedCpt }: {
  staffMember: string;
  onSelect: (code: string) => void;
  selectedCpt: string;
}) {
  const role = detectRole(staffMember);
  const codes = CPT_BY_ROLE[role] ?? CPT_BY_ROLE.rbt;
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
      <p className="text-xs font-semibold text-blue-700 uppercase mb-1">CPT Code</p>
      <p className="text-xs text-blue-600 mb-3">
        Auto-suggested based on staff role{staffMember ? ` (detected: ${role.toUpperCase()})` : ""}.
      </p>
      <div className="flex flex-wrap gap-2">
        {codes.map((c) => (
          <button type="button" key={c.code} onClick={() => onSelect(selectedCpt === c.code ? "" : c.code)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${selectedCpt === c.code ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-300"}`}>
            {c.label}
          </button>
        ))}
      </div>
      {selectedCpt && <p className="text-xs text-blue-700 font-medium mt-2">Selected: {selectedCpt}</p>}
    </div>
  );
}

function GeofenceCheck() {
  const [status, setStatus] = useState<"idle" | "checking" | "inside" | "skipped">("idle");
  if (status === "inside") return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-xs font-medium text-green-700 flex items-center gap-2">
      ✓ Location verified — you are at the session location
    </div>
  );
  if (status === "skipped") return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 text-xs text-gray-500 flex items-center gap-2">
      📍 Location check skipped
    </div>
  );
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs font-semibold text-gray-700">📍 Location Verification</p>
          <p className="text-xs text-gray-500 mt-0.5">Verify you are at the session location before starting.</p>
        </div>
        <div className="flex gap-2">
          <button type="button"
            onClick={() => {
              setStatus("checking");
              navigator.geolocation.getCurrentPosition(
                () => setStatus("inside"),
                () => setStatus("skipped")
              );
            }}
            disabled={status === "checking"}
            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {status === "checking" ? "Checking..." : "Check Location"}
          </button>
          <button type="button" onClick={() => setStatus("skipped")}
            className="text-xs px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100">
            Skip
          </button>
        </div>
      </div>
    </div>
  );
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filterClient, setFilterClient] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // TIMER STATE
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<string | null>(null);
  const [sessionEndTime, setSessionEndTime] = useState<string | null>(null);
  const [timerRepeat, setTimerRepeat] = useState(false);
  const [recentDurations, setRecentDurations] = useState<number[]>([]);
  const timerStartRef = useRef<number | null>(null);

  // FORM STATE
  const [clientId, setClientId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState("completed");
  const [clientResponse, setClientResponse] = useState("");
  const [notes, setNotes] = useState("");
  const [staffMember, setStaffMember] = useState("");
  const [cptCode, setCptCode] = useState("");
  const [selectedBehaviors, setSelectedBehaviors] = useState<string[]>([]);
  const [selectedInterventions, setSelectedInterventions] = useState<string[]>([]);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [showSOAP, setShowSOAP] = useState(false);
  const [soap, setSoap] = useState({ subjective: "", objective: "", assessment: "", plan: "" });

  useEffect(() => {
    init();
    // Restore timer if running before navigation
    const savedStart = localStorage.getItem("session_timer_start");
    if (savedStart) {
      timerStartRef.current = Number(savedStart);
      setTimerSeconds(Math.floor((Date.now() - Number(savedStart)) / 1000));
      setTimerRunning(true);
      setSessionStartTime(new Date(Number(savedStart)).toISOString());
      setShowForm(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // BACKGROUND-SAFE TIMER
  useEffect(() => {
    if (!timerRunning) return;
    const tick = () => {
      if (timerStartRef.current !== null) {
        setTimerSeconds(Math.floor((Date.now() - timerStartRef.current) / 1000));
      }
    };
    const interval = setInterval(tick, 500);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [timerRunning]);

  async function init() {
    setFetchError(null);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const [{ data: clientData, error: clientErr }, { data: sessionData, error: sessionErr }] = await Promise.all([
      supabase.from("clients").select("id, full_name"),
      supabase.from("sessions").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    if (clientErr || sessionErr) {
      setFetchError("Failed to load sessions. Please refresh and try again.");
    } else {
      setClients(clientData ?? []);
      setSessions(sessionData ?? []);
    }
    setLoading(false);
  }

  function toggleItem(item: string, list: string[], setList: (l: string[]) => void) {
    setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  }

  function formatTimer(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function startTimer() {
    const now = Date.now();
    timerStartRef.current = now;
    localStorage.setItem("session_timer_start", String(now));
    setTimerSeconds(0);
    setTimerRunning(true);
    setSessionStartTime(new Date().toISOString());
    setSessionEndTime(null);
  }

  function stopTimer() {
    setTimerRunning(false);
    localStorage.removeItem("session_timer_start");
    const endTime = new Date().toISOString();
    setSessionEndTime(endTime);
    const duration = timerSeconds;
    setRecentDurations(prev => [duration, ...prev.filter(d => d !== duration)].slice(0, 5));
    playAlertSound();
    if (timerRepeat) {
      setTimeout(() => startTimer(), 500);
    } else {
      if (soap.objective === "") {
        setSoap(prev => ({ ...prev, objective: `Session duration: ${formatTimer(duration)}` }));
      }
    }
  }

  function applyTemplate(key: string) {
    const template = TEMPLATES[key];
    if (!template) return;
    setSelectedTemplate(key);
    setSelectedBehaviors(template.behaviors);
    setSelectedInterventions(template.interventions);
    setSelectedPrograms(template.programs);
    setSoap(template.soap);
    setShowSOAP(true);
  }

  function resetForm() {
    localStorage.removeItem("session_timer_start");
    setClientId(""); setDate(new Date().toISOString().split("T")[0]);
    setStatus("completed"); setClientResponse(""); setNotes("");
    setStaffMember(""); setCptCode("");
    setSelectedBehaviors([]); setSelectedInterventions([]); setSelectedPrograms([]);
    setSoap({ subjective: "", objective: "", assessment: "", plan: "" });
    setTimerRunning(false); setTimerSeconds(0);
    timerStartRef.current = null;
    setSessionStartTime(null); setSessionEndTime(null);
    setShowForm(false); setSelectedTemplate(null);
  }

  async function handleSave() {
    if (!clientId) { setError("Please select a client."); return; }
    setSaving(true);
    setError(null);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const { data, error: saveError } = await supabase.from("sessions").insert([{
      client_id: clientId, date, status,
      client_response: clientResponse, notes, staff_member: staffMember,
      cpt_code: cptCode || null,
      behaviors_observed: selectedBehaviors.join(", "),
      interventions_used: selectedInterventions.join(", "),
      programs_targeted: selectedPrograms.join(", "),
      soap_subjective: soap.subjective,
      soap_objective: soap.objective || (timerSeconds > 0 ? `Session duration: ${formatTimer(timerSeconds)}` : ""),
      soap_assessment: soap.assessment, soap_plan: soap.plan,
      start_time: sessionStartTime || null,
      end_time: sessionEndTime || null,
      created_by: user.id,
    }]).select().single();
    if (saveError) { setError(saveError.message); setSaving(false); return; }
    if (data) setSessions(prev => [data, ...prev]);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
    resetForm();
    setSaving(false);
  }

  const clientMap = new Map(clients.map(c => [c.id, c.full_name]));
  const filtered = sessions
    .filter(s => filterClient ? s.client_id === filterClient : true)
    .filter(s => filterStatus ? s.status === filterStatus : true);

  return (
    <div className="space-y-6">
      <PageHeader title="Session Notes">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Session"}
        </Button>
      </PageHeader>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          Session note saved successfully.
        </div>
      )}

      {fetchError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex justify-between items-center">
          <span>{fetchError}</span>
          <button type="button" onClick={init} className="text-xs underline font-medium">Retry</button>
        </div>
      )}

      {showForm && (
        <Section title="New Session Note">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          <GeofenceCheck />

          {/* SESSION TIMER */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">Session Timer</p>
              <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
                <input type="checkbox" checked={timerRepeat} onChange={e => setTimerRepeat(e.target.checked)}
                  className="rounded border-gray-300" />
                🔁 Auto-repeat
              </label>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <p className={`text-3xl font-mono font-bold ${timerRunning ? "text-blue-600" : "text-gray-400"}`}>
                {formatTimer(timerSeconds)}
              </p>
              <div className="flex gap-2">
                {!timerRunning ? (
                  <Button onClick={startTimer}>▶ Start</Button>
                ) : (
                  <Button variant="danger" onClick={stopTimer}>⏹ Stop</Button>
                )}
                <Button variant="outline" onClick={() => {
                  localStorage.removeItem("session_timer_start");
                  setTimerRunning(false); setTimerSeconds(0);
                  timerStartRef.current = null;
                  setSessionStartTime(null); setSessionEndTime(null);
                }}>Reset</Button>
              </div>
            </div>
            {(sessionStartTime || sessionEndTime) && (
              <div className="flex gap-4 mt-3 text-xs text-gray-500 flex-wrap">
                {sessionStartTime && <span>Start: <strong className="text-gray-700">{new Date(sessionStartTime).toLocaleTimeString()}</strong></span>}
                {sessionEndTime && <span>End: <strong className="text-gray-700">{new Date(sessionEndTime).toLocaleTimeString()}</strong></span>}
                {sessionStartTime && sessionEndTime && <span>Duration: <strong className="text-gray-700">{formatTimer(timerSeconds)}</strong></span>}
              </div>
            )}
            {recentDurations.length > 0 && (
              <div className="mt-3 border-t border-gray-200 pt-3">
                <p className="text-xs text-gray-400 mb-2">Recent durations — click to reuse:</p>
                <div className="flex flex-wrap gap-2">
                  {recentDurations.map((d, i) => (
                    <button type="button" key={i}
                      onClick={() => {
                        const now = Date.now();
                        timerStartRef.current = now - d * 1000;
                        localStorage.setItem("session_timer_start", String(now - d * 1000));
                        setTimerSeconds(d);
                        setTimerRunning(true);
                        setSessionStartTime(new Date(now - d * 1000).toISOString());
                      }}
                      className="text-xs px-2 py-1 bg-blue-50 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-100">
                      {formatTimer(d)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* TEMPLATES */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Quick Templates</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TEMPLATES).map(([key, template]) => (
                <button type="button" key={key} onClick={() => applyTemplate(key)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selectedTemplate === key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-300"}`}>
                  {template.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
              {clients.length === 0 && !loading && (
                <p className="text-xs text-orange-500 mt-1">
                  No clients yet. <Link href="/dashboard/clients" className="underline">Add a client first.</Link>
                </p>
              )}
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

          <div className="mt-4">
            <CptCodeSelector staffMember={staffMember} onSelect={setCptCode} selectedCpt={cptCode} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Behaviors Observed</label>
              <div className="flex flex-wrap gap-2">
                {BEHAVIORS_LIST.map(b => (
                  <button type="button" key={b} onClick={() => toggleItem(b, selectedBehaviors, setSelectedBehaviors)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selectedBehaviors.includes(b) ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-600 border-gray-300 hover:border-red-300"}`}>
                    {b}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Interventions Used</label>
              <div className="flex flex-wrap gap-2">
                {INTERVENTIONS_LIST.map(i => (
                  <button type="button" key={i} onClick={() => toggleItem(i, selectedInterventions, setSelectedInterventions)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selectedInterventions.includes(i) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-300"}`}>
                    {i}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Programs Targeted</label>
              <div className="flex flex-wrap gap-2">
                {PROGRAMS_LIST.map(p => (
                  <button type="button" key={p} onClick={() => toggleItem(p, selectedPrograms, setSelectedPrograms)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selectedPrograms.includes(p) ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-600 border-gray-300 hover:border-purple-300"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Session Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Additional session notes..." rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="md:col-span-2">
              <button type="button" onClick={() => setShowSOAP(!showSOAP)}
                className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700">
                <span>{showSOAP ? "▼" : "▶"}</span>
                SOAP Notes {showSOAP ? "(hide)" : "(optional)"}
              </button>
            </div>
            {showSOAP && (
              <div className="md:col-span-2 space-y-3 border border-blue-100 rounded-xl p-4 bg-blue-50">
                <p className="text-xs font-semibold text-blue-700 mb-2">SOAP Note Format</p>
                {[
                  { key: "subjective", label: "S — Subjective", placeholder: "Client/caregiver report, concerns, mood..." },
                  { key: "objective", label: "O — Objective", placeholder: "Measurable data, frequency, duration, observations..." },
                  { key: "assessment", label: "A — Assessment", placeholder: "Clinical interpretation, progress toward goals..." },
                  { key: "plan", label: "P — Plan", placeholder: "Next session plan, goals, modifications..." },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-xs font-medium text-gray-600 mb-0.5 block">{field.label}</label>
                    <textarea value={soap[field.key as keyof typeof soap]}
                      onChange={e => setSoap(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder} rows={2}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2 flex-wrap">
            <Button onClick={handleSave} loading={saving}>Save Session Note</Button>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
          </div>
        </Section>
      )}

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

      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <SessionSkeleton key={i} />)}
        </div>
      )}

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
            className="text-blue-500 text-sm mt-2 hover:underline block mx-auto">
            Clear filters
          </button>
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
                  {session.start_time && (
                    <span>
                      {new Date(session.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {session.end_time && ` → ${new Date(session.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                    </span>
                  )}
                  {session.cpt_code && (
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">{session.cpt_code}</span>
                  )}
                </div>
                {session.behaviors_observed && <p className="text-xs text-gray-500 mt-1 truncate">Behaviors: {session.behaviors_observed}</p>}
                {session.programs_targeted && <p className="text-xs text-gray-500 truncate">Programs: {session.programs_targeted}</p>}
                {session.staff_member && <p className="text-xs text-gray-400 mt-1 truncate">Staff: {session.staff_member}</p>}
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${
                session.status === "completed" ? "bg-green-100 text-green-700"
                : session.status === "pending" ? "bg-yellow-100 text-yellow-700"
                : "bg-gray-100 text-gray-600"
              }`}>
                {session.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}