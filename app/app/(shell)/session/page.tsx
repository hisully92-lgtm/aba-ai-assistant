"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import AppShell from "@/components/app/AppShell";

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

const INTERVENTIONS = ["Redirection", "Planned ignoring", "Differential reinforcement", "Response blocking", "NCR", "Token economy", "Visual supports", "Prompting hierarchy"];

type Screen = "clients" | "evv" | "session";

export default function SessionPage() {
  const [screen, setScreen] = useState<Screen>("clients");
  const [userId, setUserId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [evvRecords, setEvvRecords] = useState<EVVRecord[]>([]);
  const [selectedEVV, setSelectedEVV] = useState<EVVRecord | null>(null);
  const [evvLoading, setEvvLoading] = useState(false);

  const [customBehaviors, setCustomBehaviors] = useState<CustomBehavior[]>([]);
  const [skillTargets, setSkillTargets] = useState<SkillTarget[]>([]);
  const [activeTab, setActiveTab] = useState<"behaviors" | "skills" | "dtt">("behaviors");

  const [expandedBehavior, setExpandedBehavior] = useState<string | null>(null);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  const [behaviorEntries, setBehaviorEntries] = useState<BehaviorEntry[]>([]);
  const [selectedInterventions, setSelectedInterventions] = useState<string[]>([]);
  const [severityModal, setSeverityModal] = useState<{ behavior: CustomBehavior } | null>(null);
  const [trialEntries, setTrialEntries] = useState<TrialEntry[]>([]);
  const [promptModal, setPromptModal] = useState<{ target: SkillTarget; result: "correct" | "prompted" | "incorrect" | "no_response" } | null>(null);
  const [sessionNotes, setSessionNotes] = useState("");

  const [trialProgram, setTrialProgram] = useState("");
  const [trials, setTrials] = useState<Array<{ result: "correct" | "incorrect" | "prompted" }>>([]);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const { data: companyUser } = await supabase.from("company_users").select("company_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
    setCompanyId(companyUser?.company_id ?? "");

    const { data: assignments } = await supabase.from("assignments").select("client_id, clients(id, full_name)").eq("rbt_id", user.id);
    const assignedClients: Client[] = (assignments ?? []).map((a: any) => a.clients).filter(Boolean).sort((a: Client, b: Client) => a.full_name.localeCompare(b.full_name));
    const unique = assignedClients.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i);
    setClients(unique);
    setLoading(false);
  }

  async function selectClient(client: Client) {
    setSelectedClient(client);
    setEvvLoading(true);
    setScreen("evv");
    const { data: evv } = await supabase.from("evv_records").select("*").eq("client_id", client.id).eq("evv_status", "complete").order("actual_start", { ascending: false }).limit(20);
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
      supabase.from("custom_behaviors").select("*, severity_levels:behavior_severity_levels(*)").eq("client_id", evv.client_id).eq("is_active", true).order("display_order"),
      supabase.from("skill_targets").select("*, prompt_levels(*)").eq("client_id", evv.client_id).eq("is_active", true).order("display_order"),
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

  const dttCorrect = trials.filter(t => t.result === "correct").length;
  const dttPct = trials.length > 0 ? Math.round((dttCorrect / trials.length) * 100) : 0;

  function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  function fmtDate(iso: string) { return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }); }
  function fmtDur(minutes: number) { const h = Math.floor(minutes / 60); const m = minutes % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; }

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

    const { data: session } = await supabase.from("sessions").insert(sessionPayload).select().single();

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

  if (loading) {
    return <AppShell title="Data Collection"><div className="flex justify-center py-20"><p className="text-gray-400 text-sm">Loading...</p></div></AppShell>;
  }

  // ── CLIENTS SCREEN ─────────────────────────────────────────
  if (screen === "clients") {
    return (
      <AppShell title="Data Collection">
        {success && <div className="m-4 bg-green-50 rounded-xl p-3"><p className="text-green-600 font-semibold text-center">✓ Session saved successfully!</p></div>}
        <div className="p-4 pb-10">
          <p className="text-xl font-extrabold text-gray-900 mb-1">Your Assigned Clients</p>
          <p className="text-[13px] text-gray-500 mb-5">Tap a client to view their EVV sessions and collect data</p>
          {clients.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <p className="text-5xl mb-3">👥</p>
              <p className="text-base font-bold text-gray-700 mb-1">No clients assigned</p>
              <p className="text-[13px] text-gray-400 text-center">Ask your admin or BCBA to assign clients to you.</p>
            </div>
          ) : (
            clients.map(client => (
              <button key={client.id} onClick={() => selectClient(client)}
                className="w-full flex items-center gap-3 bg-white rounded-2xl p-4 mb-2.5 border border-gray-200 text-left">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-extrabold" style={{ backgroundColor: "#2563eb" }}>
                  {client.full_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-bold text-gray-900">{client.full_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Tap to view sessions →</p>
                </div>
                <span className="text-2xl text-gray-300">›</span>
              </button>
            ))
          )}
        </div>
      </AppShell>
    );
  }

  // ── EVV SCREEN ─────────────────────────────────────────────
  if (screen === "evv") {
    return (
      <AppShell title={selectedClient?.full_name ?? "Sessions"}>
        <button onClick={() => { setScreen("clients"); setSelectedClient(null); }} className="w-full text-left px-4 py-2.5" style={{ backgroundColor: "#1a2234" }}>
          <span className="text-[13px] font-semibold" style={{ color: "#93c5fd" }}>‹ All Clients</span>
        </button>
        <div className="p-4 pb-10">
          <p className="text-xl font-extrabold text-gray-900 mb-1">Select a Session</p>
          <p className="text-[13px] text-gray-500 mb-5">Tap the EVV visit you want to document</p>
          {evvLoading ? (
            <p className="text-center text-gray-400 mt-10">Loading...</p>
          ) : evvRecords.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <p className="text-5xl mb-3">📋</p>
              <p className="text-base font-bold text-gray-700 mb-1">No completed EVV sessions</p>
              <p className="text-[13px] text-gray-400 text-center">Complete a visit via the EVV clock-in flow first.</p>
            </div>
          ) : (
            evvRecords.map(evv => {
              const hasEntry = !!evv.time_entry_id;
              return (
                <button key={evv.id} onClick={() => selectEVV(evv)}
                  className="w-full flex items-center bg-white rounded-2xl p-4 mb-2.5 border text-left"
                  style={{ borderColor: hasEntry ? "#e5e7eb" : "#c4b5fd", borderWidth: hasEntry ? 1 : 1.5 }}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[15px] font-bold text-gray-900">{fmtDate(evv.actual_start)}</span>
                      {!hasEntry && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#ede9fe", color: "#7c3aed" }}>Needs Documentation</span>}
                    </div>
                    <p className="text-[13px] text-gray-500">{fmtTime(evv.actual_start)} – {fmtTime(evv.actual_end)} · {fmtDur(evv.session_duration_minutes)}</p>
                    {evv.location_name && <p className="text-xs text-gray-400 mt-0.5">📍 {evv.location_name}</p>}
                  </div>
                  <span className="text-2xl text-gray-300">›</span>
                </button>
              );
            })
          )}
        </div>
      </AppShell>
    );
  }

  // ── SESSION SCREEN ─────────────────────────────────────────
  return (
    <AppShell title={selectedClient?.full_name ?? "Session"}>
      <button onClick={() => { setScreen("evv"); setSelectedEVV(null); }} className="w-full text-left px-4 py-2.5" style={{ backgroundColor: "#1a2234" }}>
        <span className="text-[13px] font-semibold" style={{ color: "#93c5fd" }}>‹ Back to Sessions</span>
      </button>

      {selectedEVV && (
        <div className="px-4 py-2.5" style={{ backgroundColor: "#1a2234" }}>
          <p className="text-xs font-semibold" style={{ color: "#93c5fd" }}>📅 {fmtDate(selectedEVV.actual_start)} · {fmtTime(selectedEVV.actual_start)}–{fmtTime(selectedEVV.actual_end)} · {fmtDur(selectedEVV.session_duration_minutes)}</p>
          {selectedEVV.location_name && <p className="text-[11px] text-gray-400 mt-0.5">📍 {selectedEVV.location_name}</p>}
        </div>
      )}

      <div className="flex bg-white border-b border-gray-100">
        {(["behaviors", "skills", "dtt"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className="flex-1 py-3 text-center border-b-2"
            style={{ borderColor: activeTab === tab ? "#2563eb" : "transparent" }}>
            <span className="text-xs font-medium" style={{ color: activeTab === tab ? "#2563eb" : "#9ca3af", fontWeight: activeTab === tab ? 700 : 500 }}>
              {tab === "behaviors" ? "🧠 Behaviors" : tab === "skills" ? "🎯 Skills" : "📊 DTT"}
            </span>
          </button>
        ))}
      </div>

      <div className="p-4 pb-24">
        {/* BEHAVIORS TAB */}
        {activeTab === "behaviors" && (
          <div>
            {customBehaviors.length === 0 ? (
              <div className="flex flex-col items-center py-12">
                <p className="text-5xl mb-3">🧠</p><p className="text-base font-bold text-gray-700 mb-1">No behaviors set up</p><p className="text-[13px] text-gray-400 text-center">Ask your BCBA to add behaviors in the web portal.</p>
              </div>
            ) : (
              <>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2.5">Tap to Record</p>
                {customBehaviors.map(b => (
                  <div key={b.id} className="bg-white rounded-2xl mb-2.5 border border-gray-200 overflow-hidden">
                    <div className="flex items-center gap-2 p-3">
                      <button onClick={() => b.severity_levels?.length > 0 ? setSeverityModal({ behavior: b }) : recordBehavior(b, null, null, null)}
                        className="flex-1 py-2.5 rounded-xl text-white font-bold text-[13px]" style={{ backgroundColor: "#dc2626" }}>
                        + {b.name}
                      </button>
                      <button onClick={() => setExpandedBehavior(expandedBehavior === b.id ? null : b.id)} className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-lg text-xs text-gray-500">
                        {expandedBehavior === b.id ? "▲" : "▼"}
                      </button>
                    </div>

                    {expandedBehavior === b.id && (
                      <div className="p-3 bg-gray-50 border-t border-gray-100 space-y-2">
                        {b.operational_definition && <div className="bg-white rounded-lg p-2.5"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Operational Definition</p><p className="text-[13px] text-gray-700 leading-relaxed">{b.operational_definition}</p></div>}
                        {b.antecedent && <div className="bg-white rounded-lg p-2.5"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Antecedent</p><p className="text-[13px] text-gray-700 leading-relaxed">{b.antecedent}</p></div>}
                        {b.consequence && <div className="bg-white rounded-lg p-2.5"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Consequence</p><p className="text-[13px] text-gray-700 leading-relaxed">{b.consequence}</p></div>}
                        {b.replacement_behavior && <div className="bg-white rounded-lg p-2.5"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Replacement Behavior</p><p className="text-[13px] text-gray-700 leading-relaxed">{b.replacement_behavior}</p></div>}
                        {b.bcba_notes && <div className="rounded-lg p-2.5" style={{ backgroundColor: "#fefce8" }}><p className="text-[10px] font-bold uppercase mb-1" style={{ color: "#d97706" }}>BCBA Notes</p><p className="text-[13px] text-gray-700 leading-relaxed">{b.bcba_notes}</p></div>}
                      </div>
                    )}

                    {behaviorEntries.filter(e => e.behaviorId === b.id).map((entry, i) => (
                      <div key={i} className="flex items-center px-3 py-2 border-t border-gray-100">
                        <span className="flex-1 text-[13px] text-gray-700">{entry.severityLabel ?? "No severity"}</span>
                        <div className="flex items-center gap-2.5">
                          <button onClick={() => setBehaviorEntries(prev => prev.map(e => e.behaviorId === b.id && e.severityId === entry.severityId ? { ...e, frequency: Math.max(0, e.frequency - 1) } : e).filter(e => e.frequency > 0))}
                            className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-700">−</button>
                          <span className="text-lg font-extrabold text-gray-900 min-w-[28px] text-center">{entry.frequency}</span>
                          <button onClick={() => setBehaviorEntries(prev => prev.map(e => e.behaviorId === b.id && e.severityId === entry.severityId ? { ...e, frequency: e.frequency + 1 } : e))}
                            className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white" style={{ backgroundColor: "#2563eb" }}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mt-5 mb-2.5">Interventions Used</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {INTERVENTIONS.map(i => (
                    <button key={i} onClick={() => setSelectedInterventions(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                      className="px-3 py-2 rounded-full border text-xs"
                      style={selectedInterventions.includes(i) ? { backgroundColor: "#2563eb", borderColor: "#2563eb", color: "#fff", fontWeight: 600 } : { borderColor: "#d1d5db", color: "#374151" }}>
                      {i}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* SKILLS TAB */}
        {activeTab === "skills" && (
          <div>
            {skillTargets.length === 0 ? (
              <div className="flex flex-col items-center py-12">
                <p className="text-5xl mb-3">🎯</p><p className="text-base font-bold text-gray-700 mb-1">No skill targets set up</p><p className="text-[13px] text-gray-400 text-center">Ask your BCBA to add targets in the web portal.</p>
              </div>
            ) : (
              skillTargets.map(target => (
                <div key={target.id} className="bg-white rounded-2xl mb-2.5 border border-gray-200 overflow-hidden">
                  <div className="flex items-center gap-2 p-3">
                    <div className="flex-1">
                      <p className="text-[11px] font-bold uppercase" style={{ color: "#7c3aed" }}>{target.program_name}</p>
                      <p className="text-[15px] font-bold text-gray-900">{target.target_name}</p>
                      {target.current_accuracy !== null && <p className="text-[11px] text-gray-500 mt-0.5">Current accuracy: {target.current_accuracy}% · {target.status}</p>}
                    </div>
                    <button onClick={() => setExpandedSkill(expandedSkill === target.id ? null : target.id)} className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-lg text-xs text-gray-500">
                      {expandedSkill === target.id ? "▲" : "▼"}
                    </button>
                  </div>

                  {expandedSkill === target.id && (
                    <div className="p-3 bg-gray-50 border-t border-gray-100 space-y-2">
                      {target.sd_text && <div className="rounded-lg p-2.5" style={{ backgroundColor: "#eff6ff" }}><p className="text-[10px] font-bold uppercase mb-1" style={{ color: "#2563eb" }}>SD (Discriminative Stimulus)</p><p className="text-[13px] text-gray-700 leading-relaxed">{target.sd_text}</p></div>}
                      {target.instructions && <div className="bg-white rounded-lg p-2.5"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">How to Run This Program</p><p className="text-[13px] text-gray-700 leading-relaxed">{target.instructions}</p></div>}
                      {target.materials && <div className="bg-white rounded-lg p-2.5"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Materials Needed</p><p className="text-[13px] text-gray-700 leading-relaxed">{target.materials}</p></div>}
                      {target.mastery_criteria && <div className="bg-white rounded-lg p-2.5"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Mastery Criteria</p><p className="text-[13px] text-gray-700 leading-relaxed">{target.mastery_criteria}</p></div>}
                      {(target.sets_per_session || target.trials_per_set) && (
                        <div className="bg-white rounded-lg p-2.5 flex gap-4">
                          {target.sets_per_session && <div className="flex-1"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Sets/Session</p><p className="text-xl font-extrabold" style={{ color: "#2563eb" }}>{target.sets_per_session}</p></div>}
                          {target.trials_per_set && <div className="flex-1"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Trials/Set</p><p className="text-xl font-extrabold" style={{ color: "#2563eb" }}>{target.trials_per_set}</p></div>}
                        </div>
                      )}
                      {target.goal && <div className="bg-white rounded-lg p-2.5"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Goal</p><p className="text-[13px] text-gray-700 leading-relaxed">{target.goal}</p></div>}
                      {target.bcba_notes && <div className="rounded-lg p-2.5" style={{ backgroundColor: "#fefce8" }}><p className="text-[10px] font-bold uppercase mb-1" style={{ color: "#d97706" }}>BCBA Notes</p><p className="text-[13px] text-gray-700 leading-relaxed">{target.bcba_notes}</p></div>}
                    </div>
                  )}

                  <div className="flex gap-1.5 p-2.5">
                    <button onClick={() => target.prompt_levels?.length > 0 ? setPromptModal({ target, result: "correct" }) : recordTrial(target, null, null, "correct")} className="flex-1 py-3 rounded-xl text-white font-bold text-[13px]" style={{ backgroundColor: "#16a34a" }}>✓</button>
                    <button onClick={() => target.prompt_levels?.length > 0 ? setPromptModal({ target, result: "prompted" }) : recordTrial(target, null, null, "prompted")} className="flex-1 py-3 rounded-xl text-white font-bold text-[13px]" style={{ backgroundColor: "#d97706" }}>P</button>
                    <button onClick={() => recordTrial(target, null, null, "incorrect")} className="flex-1 py-3 rounded-xl text-white font-bold text-[13px]" style={{ backgroundColor: "#dc2626" }}>✗</button>
                    <button onClick={() => recordTrial(target, null, null, "no_response")} className="flex-1 py-3 rounded-xl text-white font-bold text-[13px]" style={{ backgroundColor: "#6b7280" }}>NR</button>
                  </div>

                  {trialEntries.filter(t => t.targetId === target.id).length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 px-3 pb-2.5">
                      {trialEntries.filter(t => t.targetId === target.id).map((t, i) => (
                        <span key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: t.result === "correct" ? "#16a34a" : t.result === "prompted" ? "#d97706" : t.result === "no_response" ? "#6b7280" : "#dc2626" }} />
                      ))}
                      <span className="text-[11px] text-gray-500 ml-1">
                        {trialEntries.filter(t => t.targetId === target.id && t.result === "correct").length}/{trialEntries.filter(t => t.targetId === target.id).length} correct
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* DTT TAB */}
        {activeTab === "dtt" && (
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2.5">Program / Target</p>
            <input value={trialProgram} onChange={e => setTrialProgram(e.target.value)} placeholder="e.g. Mand Training — cup"
              className="w-full border border-gray-300 rounded-xl px-3.5 py-3 text-sm text-gray-900 mb-3.5 bg-white" />
            {trials.length > 0 && (
              <div className="rounded-xl p-3.5 mb-4" style={{ backgroundColor: "#eff6ff" }}>
                <p className="text-[13px] text-gray-500 mb-1.5">{trials.length} trials · {dttPct}% correct</p>
                <div className="h-2 rounded-full mb-2" style={{ backgroundColor: "#dbeafe" }}>
                  <div className="h-2 rounded-full" style={{ backgroundColor: "#2563eb", width: `${dttPct}%` }} />
                </div>
                <div className="flex flex-wrap gap-1">
                  {trials.map((t, i) => (
                    <span key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: t.result === "correct" ? "#16a34a" : t.result === "prompted" ? "#d97706" : "#dc2626" }} />
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-1.5">
              <button onClick={() => setTrials(p => [...p, { result: "correct" }])} className="flex-1 py-3 rounded-xl text-white font-bold text-[13px]" style={{ backgroundColor: "#16a34a" }}>✓ Correct</button>
              <button onClick={() => setTrials(p => [...p, { result: "prompted" }])} className="flex-1 py-3 rounded-xl text-white font-bold text-[13px]" style={{ backgroundColor: "#d97706" }}>P Prompted</button>
              <button onClick={() => setTrials(p => [...p, { result: "incorrect" }])} className="flex-1 py-3 rounded-xl text-white font-bold text-[13px]" style={{ backgroundColor: "#dc2626" }}>✗ Error</button>
            </div>
            {trials.length > 0 && (
              <button onClick={() => setTrials([])} className="w-full text-center mt-2 text-gray-500 underline text-sm">Reset trials</button>
            )}
          </div>
        )}

        {/* SESSION NOTES */}
        <div className="mt-5">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2.5">Session Notes</p>
          <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)} placeholder="Overall session summary, follow-up items, anything notable..."
            className="w-full border border-gray-300 rounded-xl px-3.5 py-3 text-sm text-gray-900 bg-white" style={{ minHeight: 80 }} />
        </div>

        {/* SAVE BUTTON */}
        <button onClick={handleSave} disabled={saving} className="w-full text-white font-bold py-4 rounded-2xl mt-3 disabled:opacity-60" style={{ backgroundColor: "#2563eb" }}>
          {saving ? "..." : "✓ Save Session Data"}
        </button>
        <p className="text-[11px] text-gray-400 text-center mt-2">Saves to session record and links back to EVV visit</p>
      </div>

      {/* SEVERITY MODAL */}
      {severityModal && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="w-full bg-white rounded-t-3xl p-6 pb-10">
            <p className="text-lg font-extrabold text-gray-900">{severityModal.behavior.name}</p>
            <p className="text-[13px] text-gray-500 mb-4">Select severity level</p>
            {[...severityModal.behavior.severity_levels].sort((a, b) => a.level_number - b.level_number).map(level => (
              <button key={level.id} onClick={() => recordBehavior(severityModal.behavior, level.id, level.label, level.color)}
                className="w-full text-left rounded-lg p-3.5 mb-2 bg-gray-50" style={{ borderLeft: `4px solid ${level.color}` }}>
                <p className="text-sm font-bold" style={{ color: level.color }}>{level.label}</p>
                {level.description && <p className="text-xs text-gray-500 mt-0.5">{level.description}</p>}
              </button>
            ))}
            <button onClick={() => recordBehavior(severityModal.behavior, null, "No Severity", "#6b7280")} className="w-full text-center py-3.5 text-gray-500 underline text-sm">Record without severity</button>
            <button onClick={() => setSeverityModal(null)} className="w-full text-center py-3.5 border-t border-gray-100 mt-2 text-gray-500 font-semibold text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* PROMPT MODAL */}
      {promptModal && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="w-full bg-white rounded-t-3xl p-6 pb-10">
            <p className="text-lg font-extrabold text-gray-900">{promptModal.target.target_name}</p>
            <p className="text-[13px] text-gray-500 mb-4">Select prompt level</p>
            {[...promptModal.target.prompt_levels].sort((a, b) => a.level_number - b.level_number).map(level => (
              <button key={level.id} onClick={() => recordTrial(promptModal.target, level.id, level.label, promptModal.result)}
                className="w-full flex items-center gap-3 py-3.5 border-b border-gray-100 text-left">
                {level.abbreviation && <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-extrabold" style={{ backgroundColor: "#7c3aed" }}>{level.abbreviation}</div>}
                <span className="text-sm font-semibold text-gray-700">{level.label}</span>
              </button>
            ))}
            <button onClick={() => setPromptModal(null)} className="w-full text-center py-3.5 border-t border-gray-100 mt-2 text-gray-500 font-semibold text-sm">Cancel</button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
