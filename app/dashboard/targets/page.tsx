"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";

type Client = { id: string; full_name: string };

type Behavior = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  severity_levels: SeverityLevel[];
};

type SeverityLevel = {
  id: string;
  level_number: number;
  label: string;
  description: string | null;
  color: string;
};

type SkillTarget = {
  id: string;
  program_name: string;
  target_name: string;
  description: string | null;
  goal: string | null;
  mastery_criteria: string | null;
  is_active: boolean;
  status: string | null;
  current_prompt_level: string | null;
  pending_advancement: boolean | null;
  mastery_criteria_type: string | null;
  mastery_threshold_pct: number | null;
  mastery_session_window_n: number | null;
  mastery_session_window_m: number | null;
  advancement_mode: string | null;
  prompted_counts_as: string | null;
  prompt_levels: PromptLevel[];
};

type PromptLevel = {
  id: string;
  level_number: number;
  label: string;
  abbreviation: string | null;
  description: string | null;
};

type MasteryEditForm = {
  mastery_criteria_type: string;
  mastery_threshold_pct: number;
  mastery_session_window_n: number;
  mastery_session_window_m: number;
  advancement_mode: string;
  prompted_counts_as: string;
};

type SequenceStep = {
  id: string;
  position: number;
  target_id: string;
  target: { id: string; target_name: string; program_name: string; status: string | null } | null;
};

type TargetSequence = {
  id: string;
  name: string;
  created_at: string;
  target_sequence_steps: SequenceStep[];
};

const DEFAULT_MASTERY_FORM: MasteryEditForm = {
  mastery_criteria_type: "consecutive_sessions",
  mastery_threshold_pct: 80,
  mastery_session_window_n: 3,
  mastery_session_window_m: 5,
  advancement_mode: "flag_for_review",
  prompted_counts_as: "incorrect",
};

const CRITERIA_LABELS: Record<string, string> = {
  single_session: "Single session",
  consecutive_sessions: "Consecutive sessions",
  x_of_last_m: "X of last M sessions",
  custom: "Custom (manual only)",
};

const ADVANCEMENT_LABELS: Record<string, string> = {
  auto: "Auto-advance",
  flag_for_review: "Flag for review",
  manual: "Manual",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  active: "Active",
  hold: "On hold",
  mastered: "Mastered",
};

const STATUS_STYLES: Record<string, string> = {
  new: "bg-gray-100 text-gray-600",
  active: "bg-blue-100 text-blue-700",
  hold: "bg-amber-100 text-amber-700",
  mastered: "bg-green-100 text-green-700",
};

function statusLabel(status: string | null): string {
  return STATUS_LABELS[status ?? "new"] ?? "New";
}

function statusStyle(status: string | null): string {
  return STATUS_STYLES[status ?? "new"] ?? STATUS_STYLES.new;
}

function masterySummary(t: SkillTarget): string {
  const type = t.mastery_criteria_type ?? "consecutive_sessions";
  const pct = t.mastery_threshold_pct ?? 80;
  const n = t.mastery_session_window_n ?? 3;
  const m = t.mastery_session_window_m;
  const mode = ADVANCEMENT_LABELS[t.advancement_mode ?? "flag_for_review"];

  if (type === "single_session") return `${pct}% single session · ${mode}`;
  if (type === "consecutive_sessions") return `${pct}% × ${n} consecutive · ${mode}`;
  if (type === "x_of_last_m") return `${pct}% in ${n} of last ${m ?? "?"} · ${mode}`;
  return `Custom criteria · ${mode}`;
}

export default function TargetsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [targets, setTargets] = useState<SkillTarget[]>([]);
  const [sequences, setSequences] = useState<TargetSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"behaviors" | "targets" | "sequences">("behaviors");
  const [companyId, setCompanyId] = useState("");
  const [role, setRole] = useState("");
  const [userId, setUserId] = useState("");

  // Behavior form
  const [showBehaviorForm, setShowBehaviorForm] = useState(false);
  const [behaviorName, setBehaviorName] = useState("");
  const [behaviorDesc, setBehaviorDesc] = useState("");
  const [severityLevels, setSeverityLevels] = useState<{ label: string; description: string; color: string }[]>([
    { label: "Level 1", description: "", color: "#f59e0b" },
  ]);

  // Target form
  const [showTargetForm, setShowTargetForm] = useState(false);
  const [programName, setProgramName] = useState("");
  const [targetName, setTargetName] = useState("");
  const [targetDesc, setTargetDesc] = useState("");
  const [targetGoal, setTargetGoal] = useState("");
  const [masteryCriteria, setMasteryCriteria] = useState("");
  const [promptLevels, setPromptLevels] = useState<{ label: string; abbreviation: string; description: string }[]>([
    { label: "Independent", abbreviation: "I", description: "" },
    { label: "Gesture", abbreviation: "G", description: "" },
    { label: "Vocal", abbreviation: "V", description: "" },
    { label: "Partial Physical", abbreviation: "PP", description: "" },
    { label: "Full Physical", abbreviation: "FP", description: "" },
    { label: "No Response", abbreviation: "NR", description: "" },
  ]);
  const [newTargetMastery, setNewTargetMastery] = useState<MasteryEditForm>(DEFAULT_MASTERY_FORM);

  // Per-target mastery settings editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<MasteryEditForm>(DEFAULT_MASTERY_FORM);

  // Sequence builder state
  const [showSequenceForm, setShowSequenceForm] = useState(false);
  const [newSequenceName, setNewSequenceName] = useState("");
  const [expandedSequenceId, setExpandedSequenceId] = useState<string | null>(null);
  const [addTargetSelection, setAddTargetSelection] = useState<Record<string, string>>({});
  const [sequenceBusyId, setSequenceBusyId] = useState<string | null>(null);

  const [isAssignedToClient, setIsAssignedToClient] = useState(false);

  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedClient) loadData(); }, [selectedClient]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { checkAssignment(); }, [selectedClient, role, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function checkAssignment() {
    if (!selectedClient || role !== "clinician") {
      setIsAssignedToClient(false);
      return;
    }
    const { data } = await supabase
      .from("client_assignments")
      .select("id")
      .eq("client_id", selectedClient)
      .eq("user_id", userId)
      .maybeSingle();
    setIsAssignedToClient(!!data);
  }

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const { data: companyUser } = await supabase
      .from("company_users").select("company_id, role")
      .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();

    setCompanyId(companyUser?.company_id ?? "");
    setRole(companyUser?.role ?? "");

    const { data: clientData } = await supabase
      .from("clients").select("id, full_name")
      .eq("company_id", companyUser?.company_id)
      .order("full_name");

    setClients(clientData ?? []);
    setLoading(false);
  }

  async function loadData() {
    const [{ data: behaviorData }, { data: targetData }, { data: sequenceData }] = await Promise.all([
      supabase.from("custom_behaviors").select("*, severity_levels:behavior_severity_levels(*)")
        .eq("company_id", companyId).eq("client_id", selectedClient)
        .eq("is_active", true).order("display_order"),
      supabase.from("skill_targets").select("*, prompt_levels(*)")
        .eq("company_id", companyId).eq("client_id", selectedClient)
        .eq("is_active", true).order("display_order"),
      supabase.from("target_sequences")
        .select("id, name, created_at, target_sequence_steps(id, position, target_id, target:skill_targets(id, target_name, program_name, status))")
        .eq("company_id", companyId).eq("client_id", selectedClient)
        .order("created_at"),
    ]);
    setBehaviors(behaviorData ?? []);
    setTargets(targetData ?? []);

    const normalizedSequences = (sequenceData ?? []).map((s: any) => ({
      ...s,
      target_sequence_steps: (s.target_sequence_steps ?? []).sort((a: SequenceStep, b: SequenceStep) => a.position - b.position),
    }));
    setSequences(normalizedSequences);
  }

  async function saveBehavior() {
    if (!behaviorName.trim() || !selectedClient) return;
    setSaving(true);

    const { data: behavior } = await supabase.from("custom_behaviors").insert({
      company_id: companyId,
      client_id: selectedClient,
      name: behaviorName.trim(),
      description: behaviorDesc.trim() || null,
      created_by: userId,
    }).select().single();

    if (behavior) {
      await supabase.from("behavior_severity_levels").insert(
        severityLevels.filter(l => l.label.trim()).map((l, i) => ({
          behavior_id: behavior.id,
          company_id: companyId,
          level_number: i + 1,
          label: l.label.trim(),
          description: l.description.trim() || null,
          color: l.color,
        }))
      );
    }

    setBehaviorName(""); setBehaviorDesc("");
    setSeverityLevels([{ label: "Level 1", description: "", color: "#f59e0b" }]);
    setShowBehaviorForm(false);
    await loadData();
    setSaving(false);
  }

  async function saveTarget() {
    if (!programName.trim() || !targetName.trim() || !selectedClient) return;
    setSaving(true);

    const { data: target } = await supabase.from("skill_targets").insert({
      company_id: companyId,
      client_id: selectedClient,
      program_name: programName.trim(),
      target_name: targetName.trim(),
      description: targetDesc.trim() || null,
      goal: targetGoal.trim() || null,
      mastery_criteria: masteryCriteria.trim() || null,
      created_by: userId,
      status: "new",
      current_prompt_level: promptLevels[0]?.label || null,
      mastery_criteria_type: newTargetMastery.mastery_criteria_type,
      mastery_threshold_pct: newTargetMastery.mastery_threshold_pct,
      mastery_session_window_n: newTargetMastery.mastery_session_window_n,
      mastery_session_window_m: newTargetMastery.mastery_criteria_type === "x_of_last_m" ? newTargetMastery.mastery_session_window_m : null,
      advancement_mode: newTargetMastery.advancement_mode,
      prompted_counts_as: newTargetMastery.prompted_counts_as,
    }).select().single();

    if (target) {
      await supabase.from("prompt_levels").insert(
        promptLevels.filter(l => l.label.trim()).map((l, i) => ({
          target_id: target.id,
          company_id: companyId,
          level_number: i + 1,
          label: l.label.trim(),
          abbreviation: l.abbreviation.trim() || null,
          description: l.description.trim() || null,
        }))
      );
    }

    setProgramName(""); setTargetName(""); setTargetDesc(""); setTargetGoal(""); setMasteryCriteria("");
    setPromptLevels([
      { label: "Independent", abbreviation: "I", description: "" },
      { label: "Gesture", abbreviation: "G", description: "" },
      { label: "Vocal", abbreviation: "V", description: "" },
      { label: "Partial Physical", abbreviation: "PP", description: "" },
      { label: "Full Physical", abbreviation: "FP", description: "" },
      { label: "No Response", abbreviation: "NR", description: "" },
    ]);
    setNewTargetMastery(DEFAULT_MASTERY_FORM);
    setShowTargetForm(false);
    await loadData();
    setSaving(false);
  }

  async function deactivateBehavior(id: string) {
    await supabase.from("custom_behaviors").update({ is_active: false }).eq("id", id);
    await loadData();
  }

  async function deactivateTarget(id: string) {
    await supabase.from("skill_targets").update({ is_active: false }).eq("id", id);
    await loadData();
  }

  async function toggleHold(target: SkillTarget) {
    const nextStatus = target.status === "hold" ? "active" : "hold";
    await supabase.from("skill_targets").update({ status: nextStatus }).eq("id", target.id);
    await loadData();
  }

  function startEdit(t: SkillTarget) {
    setEditingId(t.id);
    setEditForm({
      mastery_criteria_type: t.mastery_criteria_type ?? "consecutive_sessions",
      mastery_threshold_pct: t.mastery_threshold_pct ?? 80,
      mastery_session_window_n: t.mastery_session_window_n ?? 3,
      mastery_session_window_m: t.mastery_session_window_m ?? 5,
      advancement_mode: t.advancement_mode ?? "flag_for_review",
      prompted_counts_as: t.prompted_counts_as ?? "incorrect",
    });
  }

  async function saveMasterySettings(targetId: string) {
    setSaving(true);
    await supabase.from("skill_targets").update({
      mastery_criteria_type: editForm.mastery_criteria_type,
      mastery_threshold_pct: editForm.mastery_threshold_pct,
      mastery_session_window_n: editForm.mastery_session_window_n,
      mastery_session_window_m: editForm.mastery_criteria_type === "x_of_last_m" ? editForm.mastery_session_window_m : null,
      advancement_mode: editForm.advancement_mode,
      prompted_counts_as: editForm.prompted_counts_as,
    }).eq("id", targetId);
    setEditingId(null);
    await loadData();
    setSaving(false);
  }

  async function callAdvancementApi(targetId: string, action: "approve-advancement" | "reject-advancement" | "manual-advance") {
    setActionLoadingId(targetId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(`/api/targets/${targetId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body?.error ?? "Action failed.");
      }
      await loadData();
    } finally {
      setActionLoadingId(null);
    }
  }

  // ---- SEQUENCE BUILDER ----

  async function createSequence() {
    if (!newSequenceName.trim() || !selectedClient) return;
    setSaving(true);
    await supabase.from("target_sequences").insert({
      company_id: companyId,
      client_id: selectedClient,
      name: newSequenceName.trim(),
      created_by: userId,
    });
    setNewSequenceName("");
    setShowSequenceForm(false);
    await loadData();
    setSaving(false);
  }

  async function deleteSequence(sequenceId: string) {
    setSequenceBusyId(sequenceId);
    await supabase.from("target_sequences").delete().eq("id", sequenceId);
    if (expandedSequenceId === sequenceId) setExpandedSequenceId(null);
    await loadData();
    setSequenceBusyId(null);
  }

  async function reindexSteps(orderedStepIds: string[]) {
    // Two-phase to avoid colliding with the (sequence_id, position) unique constraint
    for (let i = 0; i < orderedStepIds.length; i++) {
      await supabase.from("target_sequence_steps").update({ position: -(i + 1) }).eq("id", orderedStepIds[i]);
    }
    for (let i = 0; i < orderedStepIds.length; i++) {
      await supabase.from("target_sequence_steps").update({ position: i + 1 }).eq("id", orderedStepIds[i]);
    }
  }

  async function addStepToSequence(sequence: TargetSequence) {
    const targetId = addTargetSelection[sequence.id];
    if (!targetId) return;
    setSequenceBusyId(sequence.id);

    const nextPosition = sequence.target_sequence_steps.length + 1;

    await supabase.from("target_sequence_steps").insert({
      sequence_id: sequence.id,
      target_id: targetId,
      position: nextPosition,
    });

    // If this is the first step in the sequence, activate the target if it isn't already set
    if (nextPosition === 1) {
      const target = targets.find(t => t.id === targetId);
      if (target && target.status !== "mastered" && target.status !== "active") {
        await supabase.from("skill_targets").update({ status: "active" }).eq("id", targetId);
      }
    }

    setAddTargetSelection(prev => ({ ...prev, [sequence.id]: "" }));
    await loadData();
    setSequenceBusyId(null);
  }

  async function removeStep(sequence: TargetSequence, stepId: string) {
    setSequenceBusyId(sequence.id);
    await supabase.from("target_sequence_steps").delete().eq("id", stepId);
    const remainingIds = sequence.target_sequence_steps.filter(s => s.id !== stepId).map(s => s.id);
    await reindexSteps(remainingIds);
    await loadData();
    setSequenceBusyId(null);
  }

  async function moveStep(sequence: TargetSequence, stepId: string, direction: "up" | "down") {
    const ids = sequence.target_sequence_steps.map(s => s.id);
    const idx = ids.indexOf(stepId);
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= ids.length) return;

    setSequenceBusyId(sequence.id);
    const reordered = [...ids];
    [reordered[idx], reordered[swapWith]] = [reordered[swapWith], reordered[idx]];
    await reindexSteps(reordered);
    await loadData();
    setSequenceBusyId(null);
  }

  const canEdit = role === "admin" || role === "supervisor" || (role === "clinician" && isAssignedToClient);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Behaviors & Skill Targets" />

      {!canEdit && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-700">
          ⚠️ Only admins, supervisors, and the assigned clinician for this client can create and manage behaviors and targets.
        </div>
      )}

      {/* CLIENT SELECT */}
      <Section title="Select Client">
        <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">Select a client...</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
      </Section>

      {selectedClient && (
        <>
          {/* TABS */}
          <div className="flex border-b border-gray-200">
            {(["behaviors", "targets", "sequences"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                {tab === "behaviors" ? "🧠 Behaviors" : tab === "targets" ? "🎯 Skill Targets" : "🔗 Sequences"}
              </button>
            ))}
          </div>

          {/* BEHAVIORS TAB */}
          {activeTab === "behaviors" && (
            <div className="space-y-4">
              {canEdit && (
                <button onClick={() => setShowBehaviorForm(s => !s)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                  {showBehaviorForm ? "Cancel" : "+ Add Behavior"}
                </button>
              )}

              {showBehaviorForm && canEdit && (
                <Section title="New Behavior">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Behavior Name *</label>
                      <input type="text" value={behaviorName} onChange={e => setBehaviorName(e.target.value)}
                        placeholder="e.g. Physical Aggression, Spitting, Elopement"
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                      <textarea value={behaviorDesc} onChange={e => setBehaviorDesc(e.target.value)}
                        placeholder="Operational definition of the behavior..."
                        rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">Severity Levels</label>
                        <button type="button" onClick={() => setSeverityLevels(prev => [...prev, { label: `Level ${prev.length + 1}`, description: "", color: "#dc2626" }])}
                          className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                          + Add Level
                        </button>
                      </div>
                      <div className="space-y-2">
                        {severityLevels.map((level, i) => (
                          <div key={i} className="flex gap-2 items-start border border-gray-100 rounded-lg p-3">
                            <div className="flex-1 space-y-2">
                              <input type="text" value={level.label}
                                onChange={e => setSeverityLevels(prev => prev.map((l, j) => j === i ? { ...l, label: e.target.value } : l))}
                                placeholder={`Level ${i + 1} label`}
                                className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                              <input type="text" value={level.description}
                                onChange={e => setSeverityLevels(prev => prev.map((l, j) => j === i ? { ...l, description: e.target.value } : l))}
                                placeholder="Description (e.g. touching, tapping, hitting with open fist)"
                                className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                            </div>
                            <input type="color" value={level.color}
                              onChange={e => setSeverityLevels(prev => prev.map((l, j) => j === i ? { ...l, color: e.target.value } : l))}
                              className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
                            {severityLevels.length > 1 && (
                              <button type="button" onClick={() => setSeverityLevels(prev => prev.filter((_, j) => j !== i))}
                                className="text-red-400 hover:text-red-600 text-xs">✕</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <button onClick={saveBehavior} disabled={saving || !behaviorName.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                      {saving ? "Saving..." : "Save Behavior"}
                    </button>
                  </div>
                </Section>
              )}

              {behaviors.length === 0 && (
                <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
                  <p className="text-3xl mb-3">🧠</p>
                  <p className="text-gray-600 font-medium">No behaviors added yet</p>
                  <p className="text-gray-400 text-sm mt-1">Add behaviors and severity levels for this client.</p>
                </div>
              )}

              <div className="space-y-3">
                {behaviors.map(behavior => (
                  <div key={behavior.id} className="border border-gray-100 rounded-xl p-4 bg-white">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold text-gray-800">{behavior.name}</p>
                        {behavior.description && <p className="text-xs text-gray-500 mt-0.5">{behavior.description}</p>}
                      </div>
                      {canEdit && (
                        <button onClick={() => deactivateBehavior(behavior.id)}
                          className="text-xs text-gray-300 hover:text-red-400 transition-colors">Remove</button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(behavior.severity_levels ?? []).sort((a, b) => a.level_number - b.level_number).map(level => (
                        <div key={level.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs"
                          style={{ borderColor: level.color, backgroundColor: `${level.color}15` }}>
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: level.color }} />
                          <span className="font-medium" style={{ color: level.color }}>{level.label}</span>
                          {level.description && <span className="text-gray-500">— {level.description}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TARGETS TAB */}
          {activeTab === "targets" && (
            <div className="space-y-4">
              {canEdit && (
                <button onClick={() => setShowTargetForm(s => !s)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                  {showTargetForm ? "Cancel" : "+ Add Skill Target"}
                </button>
              )}

              {showTargetForm && canEdit && (
                <Section title="New Skill Target">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Program Name *</label>
                        <input type="text" value={programName} onChange={e => setProgramName(e.target.value)}
                          placeholder="e.g. Mand Training, Tact Training, Imitation"
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Target Name *</label>
                        <input type="text" value={targetName} onChange={e => setTargetName(e.target.value)}
                          placeholder="e.g. Cup, Ball, Patterns, Colors"
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                        <textarea value={targetDesc} onChange={e => setTargetDesc(e.target.value)}
                          placeholder="Description of the target..."
                          rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Goal</label>
                        <input type="text" value={targetGoal} onChange={e => setTargetGoal(e.target.value)}
                          placeholder="e.g. Client will independently mand for cup"
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Mastery Criteria (description)</label>
                        <input type="text" value={masteryCriteria} onChange={e => setMasteryCriteria(e.target.value)}
                          placeholder="e.g. 80% across 3 consecutive sessions"
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                    </div>

                    {/* MASTERY & ADVANCEMENT CONFIG */}
                    <div className="border border-purple-100 bg-purple-50/40 rounded-xl p-4 space-y-3">
                      <p className="text-sm font-medium text-purple-800">🎯 Mastery & Advancement Rules</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Criteria Type</label>
                          <select value={newTargetMastery.mastery_criteria_type}
                            onChange={e => setNewTargetMastery(prev => ({ ...prev, mastery_criteria_type: e.target.value }))}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
                            {Object.entries(CRITERIA_LABELS).map(([val, label]) => (
                              <option key={val} value={val}>{label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Advancement Mode</label>
                          <select value={newTargetMastery.advancement_mode}
                            onChange={e => setNewTargetMastery(prev => ({ ...prev, advancement_mode: e.target.value }))}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
                            {Object.entries(ADVANCEMENT_LABELS).map(([val, label]) => (
                              <option key={val} value={val}>{label}</option>
                            ))}
                          </select>
                        </div>

                        {newTargetMastery.mastery_criteria_type !== "custom" && (
                          <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Threshold %</label>
                            <input type="number" min={0} max={100} value={newTargetMastery.mastery_threshold_pct}
                              onChange={e => setNewTargetMastery(prev => ({ ...prev, mastery_threshold_pct: Number(e.target.value) }))}
                              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                          </div>
                        )}

                        {(newTargetMastery.mastery_criteria_type === "consecutive_sessions" || newTargetMastery.mastery_criteria_type === "x_of_last_m") && (
                          <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">
                              {newTargetMastery.mastery_criteria_type === "consecutive_sessions" ? "Consecutive sessions (N)" : "Sessions meeting threshold (N)"}
                            </label>
                            <input type="number" min={1} value={newTargetMastery.mastery_session_window_n}
                              onChange={e => setNewTargetMastery(prev => ({ ...prev, mastery_session_window_n: Number(e.target.value) }))}
                              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                          </div>
                        )}

                        {newTargetMastery.mastery_criteria_type === "x_of_last_m" && (
                          <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Out of last M sessions</label>
                            <input type="number" min={1} value={newTargetMastery.mastery_session_window_m}
                              onChange={e => setNewTargetMastery(prev => ({ ...prev, mastery_session_window_m: Number(e.target.value) }))}
                              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                          </div>
                        )}

                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Prompted trials count as</label>
                          <select value={newTargetMastery.prompted_counts_as}
                            onChange={e => setNewTargetMastery(prev => ({ ...prev, prompted_counts_as: e.target.value }))}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
                            <option value="incorrect">Incorrect</option>
                            <option value="correct">Correct</option>
                          </select>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">
                        {newTargetMastery.advancement_mode === "auto" && "The system will advance this target automatically the moment criteria is met — you'll just get a notification."}
                        {newTargetMastery.advancement_mode === "flag_for_review" && "When criteria is met, this target is flagged and waits for your approval before advancing."}
                        {newTargetMastery.advancement_mode === "manual" && "When criteria is met, you'll see a badge — advancing is entirely up to you, whenever you're ready."}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">Prompt Levels</label>
                        <button type="button" onClick={() => setPromptLevels(prev => [...prev, { label: "", abbreviation: "", description: "" }])}
                          className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                          + Add Level
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mb-2">List from most independent to most support (e.g. Independent → Gesture → Vocal → Partial Physical → Full Physical). Fading advances toward the top of this list.</p>
                      <div className="space-y-2">
                        {promptLevels.map((level, i) => (
                          <div key={i} className="flex gap-2 items-center border border-gray-100 rounded-lg p-3">
                            <input type="text" value={level.abbreviation}
                              onChange={e => setPromptLevels(prev => prev.map((l, j) => j === i ? { ...l, abbreviation: e.target.value } : l))}
                              placeholder="Abbr"
                              className="w-16 border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-300" />
                            <input type="text" value={level.label}
                              onChange={e => setPromptLevels(prev => prev.map((l, j) => j === i ? { ...l, label: e.target.value } : l))}
                              placeholder="Prompt level label"
                              className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                            <input type="text" value={level.description}
                              onChange={e => setPromptLevels(prev => prev.map((l, j) => j === i ? { ...l, description: e.target.value } : l))}
                              placeholder="Description (optional)"
                              className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                            <button type="button" onClick={() => setPromptLevels(prev => prev.filter((_, j) => j !== i))}
                              className="text-red-400 hover:text-red-600 text-xs">✕</button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button onClick={saveTarget} disabled={saving || !programName.trim() || !targetName.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                      {saving ? "Saving..." : "Save Target"}
                    </button>
                  </div>
                </Section>
              )}

              {targets.length === 0 && (
                <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
                  <p className="text-3xl mb-3">🎯</p>
                  <p className="text-gray-600 font-medium">No skill targets added yet</p>
                  <p className="text-gray-400 text-sm mt-1">Add skill targets and prompt levels for this client.</p>
                </div>
              )}

              <div className="space-y-3">
                {targets.map(target => {
                  const isPending = !!target.pending_advancement;
                  const isMastered = target.status === "mastered";
                  const isOnHold = target.status === "hold";
                  const isEditingThis = editingId === target.id;
                  const isActingOnThis = actionLoadingId === target.id;

                  return (
                    <div key={target.id} className={`border rounded-xl p-4 bg-white ${isPending ? "border-amber-300 bg-amber-50/40" : isOnHold ? "border-gray-200 bg-gray-50/60" : "border-gray-100"}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-xs text-blue-600 font-medium">{target.program_name}</p>
                          <p className="font-semibold text-gray-800">{target.target_name}</p>
                          {target.description && <p className="text-xs text-gray-500 mt-0.5">{target.description}</p>}
                          {target.goal && <p className="text-xs text-gray-400 mt-1">Goal: {target.goal}</p>}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle(target.status)}`}>
                              {statusLabel(target.status)}
                            </span>
                            {target.current_prompt_level && !isMastered && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                                Current: {target.current_prompt_level}
                              </span>
                            )}
                            {isPending && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 font-medium">⏳ Criteria met — pending action</span>
                            )}
                            <span className="text-xs text-gray-400">{masterySummary(target)}</span>
                          </div>
                        </div>
                        {canEdit && (
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <button onClick={() => isEditingThis ? setEditingId(null) : startEdit(target)}
                              className="text-xs text-purple-500 hover:text-purple-700 transition-colors">
                              {isEditingThis ? "Close settings" : "⚙ Mastery Settings"}
                            </button>
                            {!isMastered && (
                              <button onClick={() => toggleHold(target)}
                                className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                                {isOnHold ? "▶ Resume" : "⏸ Put on hold"}
                              </button>
                            )}
                            <button onClick={() => deactivateTarget(target.id)}
                              className="text-xs text-gray-300 hover:text-red-400 transition-colors">Remove</button>
                          </div>
                        )}
                      </div>

                      {/* PENDING ACTION BUTTONS */}
                      {isPending && canEdit && (
                        <div className="flex gap-2 mb-3">
                          {target.advancement_mode === "flag_for_review" && (
                            <>
                              <button disabled={isActingOnThis} onClick={() => callAdvancementApi(target.id, "approve-advancement")}
                                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                                {isActingOnThis ? "Working..." : "✓ Approve advancement"}
                              </button>
                              <button disabled={isActingOnThis} onClick={() => callAdvancementApi(target.id, "reject-advancement")}
                                className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-50">
                                Dismiss
                              </button>
                            </>
                          )}
                          {target.advancement_mode === "manual" && (
                            <button disabled={isActingOnThis} onClick={() => callAdvancementApi(target.id, "manual-advance")}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                              {isActingOnThis ? "Working..." : "Advance now"}
                            </button>
                          )}
                        </div>
                      )}

                      {/* INLINE MASTERY SETTINGS EDITOR */}
                      {isEditingThis && (
                        <div className="border border-purple-100 bg-purple-50/40 rounded-xl p-4 space-y-3 mb-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-medium text-gray-600 mb-1 block">Criteria Type</label>
                              <select value={editForm.mastery_criteria_type}
                                onChange={e => setEditForm(prev => ({ ...prev, mastery_criteria_type: e.target.value }))}
                                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
                                {Object.entries(CRITERIA_LABELS).map(([val, label]) => (
                                  <option key={val} value={val}>{label}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600 mb-1 block">Advancement Mode</label>
                              <select value={editForm.advancement_mode}
                                onChange={e => setEditForm(prev => ({ ...prev, advancement_mode: e.target.value }))}
                                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
                                {Object.entries(ADVANCEMENT_LABELS).map(([val, label]) => (
                                  <option key={val} value={val}>{label}</option>
                                ))}
                              </select>
                            </div>

                            {editForm.mastery_criteria_type !== "custom" && (
                              <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">Threshold %</label>
                                <input type="number" min={0} max={100} value={editForm.mastery_threshold_pct}
                                  onChange={e => setEditForm(prev => ({ ...prev, mastery_threshold_pct: Number(e.target.value) }))}
                                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                              </div>
                            )}

                            {(editForm.mastery_criteria_type === "consecutive_sessions" || editForm.mastery_criteria_type === "x_of_last_m") && (
                              <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">
                                  {editForm.mastery_criteria_type === "consecutive_sessions" ? "Consecutive sessions (N)" : "Sessions meeting threshold (N)"}
                                </label>
                                <input type="number" min={1} value={editForm.mastery_session_window_n}
                                  onChange={e => setEditForm(prev => ({ ...prev, mastery_session_window_n: Number(e.target.value) }))}
                                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                              </div>
                            )}

                            {editForm.mastery_criteria_type === "x_of_last_m" && (
                              <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">Out of last M sessions</label>
                                <input type="number" min={1} value={editForm.mastery_session_window_m}
                                  onChange={e => setEditForm(prev => ({ ...prev, mastery_session_window_m: Number(e.target.value) }))}
                                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                              </div>
                            )}

                            <div>
                              <label className="text-xs font-medium text-gray-600 mb-1 block">Prompted trials count as</label>
                              <select value={editForm.prompted_counts_as}
                                onChange={e => setEditForm(prev => ({ ...prev, prompted_counts_as: e.target.value }))}
                                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
                                <option value="incorrect">Incorrect</option>
                                <option value="correct">Correct</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => saveMasterySettings(target.id)} disabled={saving}
                              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50">
                              {saving ? "Saving..." : "Save Settings"}
                            </button>
                            <button onClick={() => setEditingId(null)}
                              className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {(target.prompt_levels ?? []).sort((a, b) => a.level_number - b.level_number).map(level => (
                          <div key={level.id} className={`px-2 py-1 rounded-lg border text-xs ${level.label === target.current_prompt_level ? "bg-purple-100 border-purple-300" : "bg-purple-50 border-purple-100"}`}>
                            <span className="font-bold text-purple-700">{level.abbreviation}</span>
                            {level.abbreviation && <span className="text-gray-400 mx-1">·</span>}
                            <span className="text-gray-600">{level.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SEQUENCES TAB */}
          {activeTab === "sequences" && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">
                Chain targets together so mastering one automatically unlocks the next. Works for either a curriculum of separate targets, or a single skill broken into stages — your call.
              </p>

              {canEdit && (
                <button onClick={() => setShowSequenceForm(s => !s)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                  {showSequenceForm ? "Cancel" : "+ New Sequence"}
                </button>
              )}

              {showSequenceForm && canEdit && (
                <Section title="New Sequence">
                  <div className="flex gap-2">
                    <input type="text" value={newSequenceName} onChange={e => setNewSequenceName(e.target.value)}
                      placeholder="e.g. Mand Training Progression, Colors Curriculum"
                      className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    <button onClick={createSequence} disabled={saving || !newSequenceName.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                      {saving ? "Creating..." : "Create"}
                    </button>
                  </div>
                </Section>
              )}

              {sequences.length === 0 && (
                <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
                  <p className="text-3xl mb-3">🔗</p>
                  <p className="text-gray-600 font-medium">No sequences yet</p>
                  <p className="text-gray-400 text-sm mt-1">Create a sequence to chain targets together for this client.</p>
                </div>
              )}

              <div className="space-y-3">
                {sequences.map(seq => {
                  const isExpanded = expandedSequenceId === seq.id;
                  const isBusy = sequenceBusyId === seq.id;
                  const usedTargetIds = new Set(seq.target_sequence_steps.map(s => s.target_id));
                  const availableTargets = targets.filter(t => !usedTargetIds.has(t.id));

                  return (
                    <div key={seq.id} className="border border-gray-100 rounded-xl p-4 bg-white">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-gray-800">{seq.name}</p>
                          <p className="text-xs text-gray-400">{seq.target_sequence_steps.length} step{seq.target_sequence_steps.length !== 1 ? "s" : ""}</p>
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-3">
                            <button onClick={() => setExpandedSequenceId(isExpanded ? null : seq.id)}
                              className="text-xs text-blue-600 hover:text-blue-700">
                              {isExpanded ? "Collapse" : "Manage steps"}
                            </button>
                            <button onClick={() => deleteSequence(seq.id)} disabled={isBusy}
                              className="text-xs text-gray-300 hover:text-red-400 transition-colors">Delete</button>
                          </div>
                        )}
                      </div>

                      {/* Always-visible compact step chain */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {seq.target_sequence_steps.map((step, i) => {
                          const t = step.target;
                          const stepMastered = t?.status === "mastered";
                          const stepActive = t?.status === "active";
                          return (
                            <div key={step.id} className="flex items-center gap-1.5">
                              <span className={`text-xs px-2 py-1 rounded-lg border font-medium ${
                                stepMastered ? "bg-green-50 border-green-200 text-green-700"
                                : stepActive ? "bg-blue-50 border-blue-200 text-blue-700"
                                : "bg-gray-50 border-gray-200 text-gray-500"
                              }`}>
                                {i + 1}. {t?.target_name ?? "Unknown target"} {stepMastered ? "✓" : stepActive ? "●" : ""}
                              </span>
                              {i < seq.target_sequence_steps.length - 1 && <span className="text-gray-300">→</span>}
                            </div>
                          );
                        })}
                      </div>

                      {/* Expanded management */}
                      {isExpanded && canEdit && (
                        <div className="mt-4 border-t border-gray-100 pt-4 space-y-2">
                          {seq.target_sequence_steps.map((step, i) => (
                            <div key={step.id} className="flex items-center gap-2 border border-gray-100 rounded-lg p-2">
                              <span className="text-xs text-gray-400 w-6 text-center">{i + 1}</span>
                              <div className="flex-1">
                                <p className="text-sm text-gray-800">{step.target?.target_name ?? "Unknown target"}</p>
                                <p className="text-xs text-gray-400">{step.target?.program_name}</p>
                              </div>
                              <button disabled={isBusy || i === 0} onClick={() => moveStep(seq, step.id, "up")}
                                className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30">↑</button>
                              <button disabled={isBusy || i === seq.target_sequence_steps.length - 1} onClick={() => moveStep(seq, step.id, "down")}
                                className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30">↓</button>
                              <button disabled={isBusy} onClick={() => removeStep(seq, step.id)}
                                className="text-xs px-2 py-1 rounded border border-gray-200 text-red-400 hover:bg-red-50 disabled:opacity-30">✕</button>
                            </div>
                          ))}

                          {availableTargets.length > 0 ? (
                            <div className="flex gap-2 pt-2">
                              <select value={addTargetSelection[seq.id] ?? ""} onChange={e => setAddTargetSelection(prev => ({ ...prev, [seq.id]: e.target.value }))}
                                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                                <option value="">Add a target to this sequence...</option>
                                {availableTargets.map(t => (
                                  <option key={t.id} value={t.id}>{t.program_name} — {t.target_name}</option>
                                ))}
                              </select>
                              <button disabled={isBusy || !addTargetSelection[seq.id]} onClick={() => addStepToSequence(seq)}
                                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                                Add
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 pt-2">All of this client's targets are already in this sequence.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
