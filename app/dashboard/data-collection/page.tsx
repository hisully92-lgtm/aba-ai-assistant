"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

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
type SessionTab = "behaviors" | "skills" | "dtt";

export default function DataCollectionPage() {
  const [screen, setScreen] = useState<Screen>("clients");
  const [userId, setUserId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Clients
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // EVV
  const [evvRecords, setEvvRecords] = useState<EVVRecord[]>([]);
  const [selectedEVV, setSelectedEVV] = useState<EVVRecord | null>(null);
  const [evvLoading, setEvvLoading] = useState(false);

  // Clinical data
  const [customBehaviors, setCustomBehaviors] = useState<CustomBehavior[]>([]);
  const [skillTargets, setSkillTargets] = useState<SkillTarget[]>([]);
  const [activeTab, setActiveTab] = useState<SessionTab>("behaviors");
  const [expandedBehavior, setExpandedBehavior] = useState<string | null>(null);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  // Data collection
  const [behaviorEntries, setBehaviorEntries] = useState<BehaviorEntry[]>([]);
  const [selectedInterventions, setSelectedInterventions] = useState<string[]>([]);
  const [trialEntries, setTrialEntries] = useState<TrialEntry[]>([]);
  const [sessionNotes, setSessionNotes] = useState("");

  // DTT
  const [trialProgram, setTrialProgram] = useState("");
  const [trials, setTrials] = useState<Array<{ result: "correct" | "incorrect" | "prompted" }>>([]);

  // Severity modal
  const [severityModal, setSeverityModal] = useState<CustomBehavior | null>(null);
  const [promptModal, setPromptModal] = useState<{ target: SkillTarget; result: "correct" | "prompted" | "incorrect" | "no_response" } | null>(null);

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

    // Assigned clients only
    const { data: assignments } = await supabase
      .from("assignments")
      .select("client_id, clients(id, full_name)")
      .eq("rbt_id", user.id);

    const assignedClients: Client[] = (assignments ?? [])
      .map((a: any) => a.clients)
      .filter(Boolean)
      .sort((a: Client, b: Client) => a.full_name.localeCompare(b.full_name));

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

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  const fmt = (minutes: number) => { const h = Math.floor(minutes / 60); const m = minutes % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; };

  async function handleSave() {
    if (!selectedClient || !selectedEVV) return;
    setSaving(true);

    const behaviorsStr = behaviorEntries.map(e => `${e.behaviorName}${e.severityLabel ? ` (${e.severityLabel})` : ""} x${e.frequency}`).join(", ");
    const dttNote = trials.length > 0 ? `${trialProgram}: ${dttCorrect}/${trials.length} (${dttPct}%)` : "";

    const { data: session } = await supabase.from("sessions").insert({
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
    }).select().single();

    if (session) {
      if (behaviorEntries.length > 0) {
        await supabase.from("behavior_data").insert(
          behaviorEntries.map(e => ({
            session_id: session.id, client_id: selectedClient.id, company_id: companyId,
            behavior_id: e.behaviorId, severity_level_id: e.severityId,
            severity_label: e.severityLabel, frequency: e.frequency, created_by: userId,
          }))
        );
      }
      if (trialEntries.length > 0) {
        await supabase.from("skill_trial_data").insert(
          trialEntries.map(e => ({
            session_id: session.id, client_id: selectedClient.id, company_id: companyId,
            target_id: e.targetId, prompt_level_id: e.promptId,
            prompt_label: e.promptLabel, result: e.result, created_by: userId,
          }))
        );
      }

      // Save back to EVV
      await supabase.from("evv_records").update({
        behaviors_recorded: behaviorEntries.reduce((sum, e) => sum + e.frequency, 0),
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const chip = (label: string, active: boolean, onClick: () => void, colorActive = "bg-blue-600 text-white border-blue-600") => (
    <button key={label} type="button" onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${active ? colorActive : "bg-white text-gray-600 border-gray-300 hover:border-blue-300"}`}>
      {label}
    </button>
  );

  // ── CLIENTS SCREEN ─────────────────────────────────────
  if (screen === "clients") {
    return (
      <div className="space-y-6">
        <PageHeader title="Data Collection">
          <p className="text-gray-500 text-sm">Select a client to begin session documentation.</p>
        </PageHeader>

        {success && <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 font-semibold">✓ Session saved successfully!</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.length === 0 ? (
            <div className="col-span-3 text-center py-20 border border-dashed border-gray-200 rounded-2xl">
              <p className="text-4xl mb-4">👥</p>
              <p className="font-semibold text-gray-700">No clients assigned</p>
              <p className="text-sm text-gray-400 mt-1">Ask your admin or BCBA to assign clients to you.</p>
            </div>
          ) : clients.map(client => (
            <button key={client.id} type="button" onClick={() => selectClient(client)}
              className="bg-white border border-gray-100 rounded-2xl p-5 text-left hover:border-blue-300 hover:shadow-md transition-all flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                {client.full_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800">{client.full_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">Tap to view sessions →</p>
              </div>
              <span className="text-gray-300 text-xl">›</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── EVV SCREEN ─────────────────────────────────────────
  if (screen === "evv") {
    return (
      <div className="space-y-6">
        <PageHeader title={selectedClient?.full_name ?? "Sessions"}>
          <button onClick={() => { setScreen("clients"); setSelectedClient(null); }}
            className="text-sm text-blue-600 hover:underline">‹ All Clients</button>
        </PageHeader>

        <p className="text-sm text-gray-500">Select the EVV visit you want to document.</p>

        {evvLoading ? (
          <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : evvRecords.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-gray-200 rounded-2xl">
            <p className="text-4xl mb-4">📋</p>
            <p className="font-semibold text-gray-700">No completed EVV sessions</p>
            <p className="text-sm text-gray-400 mt-1">Complete a visit via the EVV clock-in flow first.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {evvRecords.map(evv => {
              const hasEntry = !!evv.time_entry_id;
              return (
                <button key={evv.id} type="button" onClick={() => selectEVV(evv)}
                  className={`w-full text-left bg-white border rounded-2xl p-5 hover:shadow-md transition-all flex items-center gap-4 ${!hasEntry ? "border-purple-200" : "border-gray-100"}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-800">{fmtDate(evv.actual_start)}</p>
                      {!hasEntry && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">Needs Documentation</span>}
                    </div>
                    <p className="text-sm text-gray-500">{fmtTime(evv.actual_start)} – {fmtTime(evv.actual_end)} · {fmt(evv.session_duration_minutes)}</p>
                    {evv.location_name && <p className="text-xs text-gray-400 mt-1">📍 {evv.location_name}</p>}
                  </div>
                  <span className="text-gray-300 text-xl">›</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── SESSION SCREEN ──────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader title={selectedClient?.full_name ?? "Session"}>
        <button onClick={() => { setScreen("evv"); setSelectedEVV(null); }}
          className="text-sm text-blue-600 hover:underline">‹ Back to Sessions</button>
      </PageHeader>

      {/* EVV Summary */}
      {selectedEVV && (
        <div className="bg-[#1a2234] rounded-xl px-5 py-3">
          <p className="text-sm text-blue-300 font-semibold">
            📅 {fmtDate(selectedEVV.actual_start)} · {fmtTime(selectedEVV.actual_start)} – {fmtTime(selectedEVV.actual_end)} · {fmt(selectedEVV.session_duration_minutes)}
          </p>
          {selectedEVV.location_name && <p className="text-xs text-gray-400 mt-0.5">📍 {selectedEVV.location_name}</p>}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(["behaviors", "skills", "dtt"] as const).map(tab => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {tab === "behaviors" ? "🧠 Behaviors" : tab === "skills" ? "🎯 Skills" : "📊 DTT"}
          </button>
        ))}
      </div>

      {/* BEHAVIORS TAB */}
      {activeTab === "behaviors" && (
        <div className="space-y-4">
          {customBehaviors.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
              <p className="text-3xl mb-3">🧠</p>
              <p className="font-semibold text-gray-700">No behaviors set up</p>
              <p className="text-sm text-gray-400 mt-1">Ask your BCBA to add behaviors in the client profile.</p>
            </div>
          ) : (
            <>
              {customBehaviors.map(b => (
                <div key={b.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center gap-3 p-4">
                    <button type="button"
                      onClick={() => b.severity_levels?.length > 0 ? setSeverityModal(b) : recordBehavior(b, null, null, null)}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                      + {b.name}
                    </button>
                    <button type="button" onClick={() => setExpandedBehavior(expandedBehavior === b.id ? null : b.id)}
                      className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-500 transition-colors">
                      {expandedBehavior === b.id ? "▲" : "▼"}
                    </button>
                  </div>

                  {/* Expanded details */}
                  {expandedBehavior === b.id && (
                    <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                      {b.operational_definition && (
                        <div className="bg-white rounded-lg p-3">
                          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Operational Definition</p>
                          <p className="text-sm text-gray-700">{b.operational_definition}</p>
                        </div>
                      )}
                      {b.antecedent && (
                        <div className="bg-white rounded-lg p-3">
                          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Antecedent</p>
                          <p className="text-sm text-gray-700">{b.antecedent}</p>
                        </div>
                      )}
                      {b.consequence && (
                        <div className="bg-white rounded-lg p-3">
                          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Consequence</p>
                          <p className="text-sm text-gray-700">{b.consequence}</p>
                        </div>
                      )}
                      {b.replacement_behavior && (
                        <div className="bg-white rounded-lg p-3">
                          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Replacement Behavior</p>
                          <p className="text-sm text-gray-700">{b.replacement_behavior}</p>
                        </div>
                      )}
                      {b.bcba_notes && (
                        <div className="bg-yellow-50 rounded-lg p-3">
                          <p className="text-xs font-bold text-yellow-600 uppercase mb-1">BCBA Notes</p>
                          <p className="text-sm text-yellow-800">{b.bcba_notes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recorded counts */}
                  {behaviorEntries.filter(e => e.behaviorId === b.id).map((entry, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2 border-t border-gray-50">
                      <span className="text-sm text-gray-600">{entry.severityLabel ?? "No severity"}</span>
                      <div className="flex items-center gap-3">
                        <button type="button"
                          onClick={() => setBehaviorEntries(prev => prev.map(e => e.behaviorId === b.id && e.severityId === entry.severityId ? { ...e, frequency: Math.max(0, e.frequency - 1) } : e).filter(e => e.frequency > 0))}
                          className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-600">−</button>
                        <span className="text-lg font-bold text-gray-800 min-w-[2rem] text-center">{entry.frequency}</span>
                        <button type="button"
                          onClick={() => setBehaviorEntries(prev => prev.map(e => e.behaviorId === b.id && e.severityId === entry.severityId ? { ...e, frequency: e.frequency + 1 } : e))}
                          className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center font-bold text-white">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {/* Interventions */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Interventions Used</p>
                <div className="flex flex-wrap gap-2">
                  {INTERVENTIONS.map(i => chip(i, selectedInterventions.includes(i), () => setSelectedInterventions(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* SKILLS TAB */}
      {activeTab === "skills" && (
        <div className="space-y-4">
          {skillTargets.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
              <p className="text-3xl mb-3">🎯</p>
              <p className="font-semibold text-gray-700">No skill targets set up</p>
              <p className="text-sm text-gray-400 mt-1">Ask your BCBA to add targets in the client profile.</p>
            </div>
          ) : skillTargets.map(target => (
            <div key={target.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-start gap-3 p-4">
                <div className="flex-1">
                  <p className="text-xs font-bold text-purple-600 uppercase">{target.program_name}</p>
                  <p className="font-semibold text-gray-800 mt-0.5">{target.target_name}</p>
                  {target.current_accuracy !== null && (
                    <p className="text-xs text-gray-400 mt-1">Current accuracy: {target.current_accuracy}% · {target.status}</p>
                  )}
                </div>
                <button type="button" onClick={() => setExpandedSkill(expandedSkill === target.id ? null : target.id)}
                  className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-500 shrink-0">
                  {expandedSkill === target.id ? "▲" : "▼"}
                </button>
              </div>

              {/* Expanded details */}
              {expandedSkill === target.id && (
                <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                  {target.sd_text && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs font-bold text-blue-600 uppercase mb-1">SD (Discriminative Stimulus)</p>
                      <p className="text-sm text-blue-800">{target.sd_text}</p>
                    </div>
                  )}
                  {target.instructions && (
                    <div className="bg-white rounded-lg p-3">
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">How to Run This Program</p>
                      <p className="text-sm text-gray-700">{target.instructions}</p>
                    </div>
                  )}
                  {target.materials && (
                    <div className="bg-white rounded-lg p-3">
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">Materials Needed</p>
                      <p className="text-sm text-gray-700">{target.materials}</p>
                    </div>
                  )}
                  {target.mastery_criteria && (
                    <div className="bg-white rounded-lg p-3">
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">Mastery Criteria</p>
                      <p className="text-sm text-gray-700">{target.mastery_criteria}</p>
                    </div>
                  )}
                  {(target.sets_per_session || target.trials_per_set) && (
                    <div className="grid grid-cols-2 gap-3">
                      {target.sets_per_session && (
                        <div className="bg-white rounded-lg p-3 text-center">
                          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Sets/Session</p>
                          <p className="text-2xl font-black text-blue-600">{target.sets_per_session}</p>
                        </div>
                      )}
                      {target.trials_per_set && (
                        <div className="bg-white rounded-lg p-3 text-center">
                          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Trials/Set</p>
                          <p className="text-2xl font-black text-blue-600">{target.trials_per_set}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {target.goal && (
                    <div className="bg-white rounded-lg p-3">
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">Goal</p>
                      <p className="text-sm text-gray-700">{target.goal}</p>
                    </div>
                  )}
                  {target.bcba_notes && (
                    <div className="bg-yellow-50 rounded-lg p-3">
                      <p className="text-xs font-bold text-yellow-600 uppercase mb-1">BCBA Notes</p>
                      <p className="text-sm text-yellow-800">{target.bcba_notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Trial buttons */}
              <div className="grid grid-cols-4 gap-2 p-4 border-t border-gray-50">
                {[
                  { label: "✓ Correct", result: "correct" as const, color: "bg-green-600 hover:bg-green-700" },
                  { label: "P Prompted", result: "prompted" as const, color: "bg-yellow-500 hover:bg-yellow-600" },
                  { label: "✗ Error", result: "incorrect" as const, color: "bg-red-600 hover:bg-red-700" },
                  { label: "— NR", result: "no_response" as const, color: "bg-gray-500 hover:bg-gray-600" },
                ].map(({ label, result, color }) => (
                  <button key={result} type="button"
                    onClick={() => target.prompt_levels?.length > 0 && result !== "incorrect" && result !== "no_response"
                      ? setPromptModal({ target, result })
                      : recordTrial(target, null, null, result)}
                    className={`${color} text-white text-xs font-bold py-2.5 rounded-xl transition-colors`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Trial dots */}
              {trialEntries.filter(t => t.targetId === target.id).length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-4 pb-4 items-center">
                  {trialEntries.filter(t => t.targetId === target.id).map((t, i) => (
                    <div key={i} className={`w-3 h-3 rounded-full ${t.result === "correct" ? "bg-green-500" : t.result === "prompted" ? "bg-yellow-500" : t.result === "no_response" ? "bg-gray-400" : "bg-red-500"}`} />
                  ))}
                  <span className="text-xs text-gray-400 ml-1">
                    {trialEntries.filter(t => t.targetId === target.id && t.result === "correct").length}/
                    {trialEntries.filter(t => t.targetId === target.id).length} correct
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* DTT TAB */}
      {activeTab === "dtt" && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Program / Target</label>
            <input type="text" value={trialProgram} onChange={e => setTrialProgram(e.target.value)}
              placeholder="e.g. Mand Training — cup"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          {trials.length > 0 && (
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-sm text-gray-500 mb-2">{trials.length} trials · {dttPct}% correct</p>
              <div className="h-2 bg-blue-200 rounded-full mb-3">
                <div className="h-2 bg-blue-600 rounded-full transition-all" style={{ width: `${dttPct}%` }} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {trials.map((t, i) => (
                  <div key={i} className={`w-3 h-3 rounded-full ${t.result === "correct" ? "bg-green-500" : t.result === "prompted" ? "bg-yellow-500" : "bg-red-500"}`} />
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <button type="button" onClick={() => setTrials(p => [...p, { result: "correct" }])}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl text-sm transition-colors">✓ Correct</button>
            <button type="button" onClick={() => setTrials(p => [...p, { result: "prompted" }])}
              className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-4 rounded-xl text-sm transition-colors">P Prompted</button>
            <button type="button" onClick={() => setTrials(p => [...p, { result: "incorrect" }])}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl text-sm transition-colors">✗ Error</button>
          </div>

          {trials.length > 0 && (
            <button type="button" onClick={() => setTrials([])} className="text-sm text-gray-400 hover:text-gray-600 underline">Reset trials</button>
          )}
        </div>
      )}

      {/* Session Notes */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">Session Notes</label>
        <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)}
          placeholder="Overall session summary, follow-up items, anything notable..."
          rows={3} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
      </div>

      <Button onClick={handleSave} loading={saving}>✓ Save Session Data</Button>
      <p className="text-xs text-gray-400 text-center">Saves to session record and links back to EVV visit</p>

      {/* SEVERITY MODAL */}
      {severityModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 pb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-1">{severityModal.name}</h3>
            <p className="text-sm text-gray-500 mb-4">Select severity level</p>
            <div className="space-y-2">
              {severityModal.severity_levels.sort((a, b) => a.level_number - b.level_number).map(level => (
                <button key={level.id} type="button"
                  onClick={() => recordBehavior(severityModal, level.id, level.label, level.color)}
                  className="w-full text-left border-l-4 rounded-lg p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                  style={{ borderLeftColor: level.color }}>
                  <p className="font-bold text-sm" style={{ color: level.color }}>{level.label}</p>
                  {level.description && <p className="text-xs text-gray-500 mt-0.5">{level.description}</p>}
                </button>
              ))}
              <button type="button" onClick={() => recordBehavior(severityModal, null, "No Severity", "#6b7280")}
                className="w-full text-center text-sm text-gray-400 hover:text-gray-600 underline py-2">
                Record without severity
              </button>
            </div>
            <button type="button" onClick={() => setSeverityModal(null)}
              className="w-full mt-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* PROMPT MODAL */}
      {promptModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 pb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-1">{promptModal.target.target_name}</h3>
            <p className="text-sm text-gray-500 mb-4">Select prompt level</p>
            <div className="space-y-2">
              {promptModal.target.prompt_levels.sort((a, b) => a.level_number - b.level_number).map(level => (
                <button key={level.id} type="button"
                  onClick={() => recordTrial(promptModal.target, level.id, level.label, promptModal.result)}
                  className="w-full flex items-center gap-3 p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  {level.abbreviation && (
                    <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {level.abbreviation}
                    </div>
                  )}
                  <span className="text-sm font-semibold text-gray-700">{level.label}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setPromptModal(null)}
              className="w-full mt-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}