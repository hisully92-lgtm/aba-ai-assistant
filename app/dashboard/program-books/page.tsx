"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type ProgramBook = { id: string; name: string; description: string | null; created_at: string };
type SkillTarget = {
  id: string;
  program_name: string;
  target_name: string;
  description: string | null;
  goal: string | null;
  mastery_criteria: string | null;
  instructions: string | null;
  current_prompt_level: string | null;
  sets_per_session: number;
  trials_per_set: number;
  current_accuracy: number;
  sessions_at_mastery: number;
  mastery_sessions_required: number;
  status: string;
  bcba_notes: string | null;
  materials: string | null;
  sd_text: string | null;
  is_active: boolean;
  prompt_levels: { id: string; level_number: number; label: string; abbreviation: string | null }[];
};
type CustomBehavior = {
  id: string;
  name: string;
  description: string | null;
  operational_definition: string | null;
  antecedent: string | null;
  consequence: string | null;
  bcba_notes: string | null;
  replacement_behavior: string | null;
  is_active: boolean;
  severity_levels: { id: string; level_number: number; label: string; description: string | null; color: string }[];
};

export default function ProgramBooksPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [programBooks, setProgramBooks] = useState<ProgramBook[]>([]);
  const [targets, setTargets] = useState<SkillTarget[]>([]);
  const [behaviors, setBehaviors] = useState<CustomBehavior[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "behaviors" | "targets">("overview");
  const [expandedTarget, setExpandedTarget] = useState<string | null>(null);
  const [expandedBehavior, setExpandedBehavior] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState("");
  const [role, setRole] = useState("");
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);

  // Target form
  const [showTargetForm, setShowTargetForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState<SkillTarget | null>(null);
  const [targetForm, setTargetForm] = useState({
    program_name: "", target_name: "", description: "", goal: "",
    mastery_criteria: "80% across 3 consecutive sessions",
    instructions: "", current_prompt_level: "", sets_per_session: 5,
    trials_per_set: 10, mastery_sessions_required: 3, bcba_notes: "",
    materials: "", sd_text: "", status: "in_progress",
  });

  // Behavior form
  const [showBehaviorForm, setShowBehaviorForm] = useState(false);
  const [editingBehavior, setEditingBehavior] = useState<CustomBehavior | null>(null);
  const [behaviorForm, setBehaviorForm] = useState({
    name: "", description: "", operational_definition: "",
    antecedent: "", consequence: "", bcba_notes: "", replacement_behavior: "",
  });
  const [severityLevels, setSeverityLevels] = useState<{ label: string; description: string; color: string }[]>([
    { label: "Level 1", description: "", color: "#f59e0b" },
  ]);

  // Prompt levels for target form
  const [promptLevels, setPromptLevels] = useState<{ label: string; abbreviation: string }[]>([
    { label: "Independent", abbreviation: "I" },
    { label: "Gesture", abbreviation: "G" },
    { label: "Vocal", abbreviation: "V" },
    { label: "Partial Physical", abbreviation: "PP" },
    { label: "Full Physical", abbreviation: "FP" },
    { label: "No Response", abbreviation: "NR" },
  ]);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedClient) loadClientData(); }, [selectedClient]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const { data } = await supabase.from("clients").select("id, full_name")
      .eq("company_id", companyUser?.company_id).order("full_name");
    setClients(data ?? []);
    setLoading(false);
  }

  async function loadClientData() {
    const [{ data: targetData }, { data: behaviorData }, { data: bookData }] = await Promise.all([
      supabase.from("skill_targets").select("*, prompt_levels(*)")
        .eq("company_id", companyId).eq("client_id", selectedClient)
        .eq("is_active", true).order("program_name").order("display_order"),
      supabase.from("custom_behaviors").select("*, severity_levels:behavior_severity_levels(*)")
        .eq("company_id", companyId).eq("client_id", selectedClient)
        .eq("is_active", true).order("display_order"),
      supabase.from("program_books").select("*")
        .eq("company_id", companyId).eq("client_id", selectedClient)
        .order("created_at"),
    ]);
    setTargets(targetData ?? []);
    setBehaviors(behaviorData ?? []);
    setProgramBooks(bookData ?? []);
  }

  const canEdit = ["bcba", "supervisor", "admin", "clinical_director"].includes(role);

  function statusColor(status: string) {
    if (status === "mastered") return "bg-green-100 text-green-700";
    if (status === "in_progress") return "bg-blue-100 text-blue-700";
    if (status === "on_hold") return "bg-yellow-100 text-yellow-700";
    if (status === "discontinued") return "bg-gray-100 text-gray-500";
    return "bg-gray-100 text-gray-600";
  }

  function statusLabel(status: string) {
    if (status === "mastered") return "✓ Mastered";
    if (status === "in_progress") return "In Progress";
    if (status === "on_hold") return "On Hold";
    if (status === "discontinued") return "Discontinued";
    return status;
  }

  function resetTargetForm() {
    setTargetForm({
      program_name: "", target_name: "", description: "", goal: "",
      mastery_criteria: "80% across 3 consecutive sessions",
      instructions: "", current_prompt_level: "", sets_per_session: 5,
      trials_per_set: 10, mastery_sessions_required: 3, bcba_notes: "",
      materials: "", sd_text: "", status: "in_progress",
    });
    setPromptLevels([
      { label: "Independent", abbreviation: "I" },
      { label: "Gesture", abbreviation: "G" },
      { label: "Vocal", abbreviation: "V" },
      { label: "Partial Physical", abbreviation: "PP" },
      { label: "Full Physical", abbreviation: "FP" },
      { label: "No Response", abbreviation: "NR" },
    ]);
    setEditingTarget(null);
    setShowTargetForm(false);
  }

  function resetBehaviorForm() {
    setBehaviorForm({
      name: "", description: "", operational_definition: "",
      antecedent: "", consequence: "", bcba_notes: "", replacement_behavior: "",
    });
    setSeverityLevels([{ label: "Level 1", description: "", color: "#f59e0b" }]);
    setEditingBehavior(null);
    setShowBehaviorForm(false);
  }

  function startEditTarget(target: SkillTarget) {
    setEditingTarget(target);
    setTargetForm({
      program_name: target.program_name,
      target_name: target.target_name,
      description: target.description ?? "",
      goal: target.goal ?? "",
      mastery_criteria: target.mastery_criteria ?? "80% across 3 consecutive sessions",
      instructions: target.instructions ?? "",
      current_prompt_level: target.current_prompt_level ?? "",
      sets_per_session: target.sets_per_session,
      trials_per_set: target.trials_per_set,
      mastery_sessions_required: target.mastery_sessions_required,
      bcba_notes: target.bcba_notes ?? "",
      materials: target.materials ?? "",
      sd_text: target.sd_text ?? "",
      status: target.status,
    });
    setPromptLevels(target.prompt_levels?.sort((a, b) => a.level_number - b.level_number).map(p => ({
      label: p.label, abbreviation: p.abbreviation ?? "",
    })) ?? []);
    setShowTargetForm(true);
  }

  function startEditBehavior(behavior: CustomBehavior) {
    setEditingBehavior(behavior);
    setBehaviorForm({
      name: behavior.name,
      description: behavior.description ?? "",
      operational_definition: behavior.operational_definition ?? "",
      antecedent: behavior.antecedent ?? "",
      consequence: behavior.consequence ?? "",
      bcba_notes: behavior.bcba_notes ?? "",
      replacement_behavior: behavior.replacement_behavior ?? "",
    });
    setSeverityLevels(behavior.severity_levels?.sort((a, b) => a.level_number - b.level_number).map(s => ({
      label: s.label, description: s.description ?? "", color: s.color,
    })) ?? [{ label: "Level 1", description: "", color: "#f59e0b" }]);
    setShowBehaviorForm(true);
  }

  async function saveTarget() {
    if (!targetForm.program_name.trim() || !targetForm.target_name.trim()) return;
    setSaving(true);

    if (editingTarget) {
      await supabase.from("skill_targets").update({
        ...targetForm,
        updated_at: new Date().toISOString(),
      }).eq("id", editingTarget.id);

      // Update prompt levels
      await supabase.from("prompt_levels").delete().eq("target_id", editingTarget.id);
      if (promptLevels.filter(p => p.label.trim()).length > 0) {
        await supabase.from("prompt_levels").insert(
          promptLevels.filter(p => p.label.trim()).map((p, i) => ({
            target_id: editingTarget.id,
            company_id: companyId,
            level_number: i + 1,
            label: p.label.trim(),
            abbreviation: p.abbreviation.trim() || null,
          }))
        );
      }
    } else {
      const { data: target } = await supabase.from("skill_targets").insert({
        ...targetForm,
        company_id: companyId,
        client_id: selectedClient,
        is_active: true,
        created_by: userId,
      }).select().single();

      if (target && promptLevels.filter(p => p.label.trim()).length > 0) {
        await supabase.from("prompt_levels").insert(
          promptLevels.filter(p => p.label.trim()).map((p, i) => ({
            target_id: target.id,
            company_id: companyId,
            level_number: i + 1,
            label: p.label.trim(),
            abbreviation: p.abbreviation.trim() || null,
          }))
        );
      }
    }

    await loadClientData();
    resetTargetForm();
    setSaving(false);
  }

  async function saveBehavior() {
    if (!behaviorForm.name.trim()) return;
    setSaving(true);

    if (editingBehavior) {
      await supabase.from("custom_behaviors").update({
        ...behaviorForm,
        updated_at: new Date().toISOString(),
      }).eq("id", editingBehavior.id);

      await supabase.from("behavior_severity_levels").delete().eq("behavior_id", editingBehavior.id);
      if (severityLevels.filter(s => s.label.trim()).length > 0) {
        await supabase.from("behavior_severity_levels").insert(
          severityLevels.filter(s => s.label.trim()).map((s, i) => ({
            behavior_id: editingBehavior.id,
            company_id: companyId,
            level_number: i + 1,
            label: s.label.trim(),
            description: s.description.trim() || null,
            color: s.color,
          }))
        );
      }
    } else {
      const { data: behavior } = await supabase.from("custom_behaviors").insert({
        ...behaviorForm,
        company_id: companyId,
        client_id: selectedClient,
        is_active: true,
        created_by: userId,
      }).select().single();

      if (behavior && severityLevels.filter(s => s.label.trim()).length > 0) {
        await supabase.from("behavior_severity_levels").insert(
          severityLevels.filter(s => s.label.trim()).map((s, i) => ({
            behavior_id: behavior.id,
            company_id: companyId,
            level_number: i + 1,
            label: s.label.trim(),
            description: s.description.trim() || null,
            color: s.color,
          }))
        );
      }
    }

    await loadClientData();
    resetBehaviorForm();
    setSaving(false);
  }

  async function deactivateTarget(id: string) {
    await supabase.from("skill_targets").update({ is_active: false }).eq("id", id);
    await loadClientData();
  }

  async function deactivateBehavior(id: string) {
    await supabase.from("custom_behaviors").update({ is_active: false }).eq("id", id);
    await loadClientData();
  }

  async function updateTargetStatus(id: string, status: string) {
    await supabase.from("skill_targets").update({ status }).eq("id", id);
    setTargets(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  }

  // Group targets by program
  const targetsByProgram = targets.reduce((acc, t) => {
    if (!acc[t.program_name]) acc[t.program_name] = [];
    acc[t.program_name].push(t);
    return acc;
  }, {} as Record<string, SkillTarget[]>);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Program Books">
        <p className="text-sm text-gray-500">Clinical programs, behavior plans, and RBT instructions.</p>
      </PageHeader>

      {/* CLIENT SELECT */}
      <div className="flex gap-3 flex-wrap items-center">
        <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">Select client...</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
      </div>

      {!selectedClient && (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
          <p className="text-4xl mb-3">📚</p>
          <p className="text-gray-600 font-medium">Select a client to view their program book</p>
          <p className="text-gray-400 text-sm mt-1">All behaviors, skill targets, and RBT instructions in one place.</p>
        </div>
      )}

      {selectedClient && (
        <>
          {/* TABS */}
          <div className="flex border-b border-gray-200">
            {(["overview", "behaviors", "targets"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${activeTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                {tab === "overview" ? "📋 Overview" : tab === "behaviors" ? `🧠 Behaviors (${behaviors.length})` : `🎯 Skill Targets (${targets.length})`}
              </button>
            ))}
          </div>

          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* SUMMARY CARDS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-xs text-blue-600 font-semibold uppercase">Active Targets</p>
                  <p className="text-3xl font-bold text-blue-700 mt-1">{targets.filter(t => t.status === "in_progress").length}</p>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                  <p className="text-xs text-green-600 font-semibold uppercase">Mastered</p>
                  <p className="text-3xl font-bold text-green-700 mt-1">{targets.filter(t => t.status === "mastered").length}</p>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <p className="text-xs text-red-600 font-semibold uppercase">Behaviors</p>
                  <p className="text-3xl font-bold text-red-700 mt-1">{behaviors.length}</p>
                </div>
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                  <p className="text-xs text-purple-600 font-semibold uppercase">Programs</p>
                  <p className="text-3xl font-bold text-purple-700 mt-1">{Object.keys(targetsByProgram).length}</p>
                </div>
              </div>

              {/* RBT QUICK REFERENCE */}
              <Section title="📋 RBT Quick Reference">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
                  <p className="text-xs font-semibold text-blue-700 uppercase mb-2">For RBTs — Session at a Glance</p>
                  <p className="text-xs text-blue-600">Review this before starting your session. All active targets and behaviors are listed below.</p>
                </div>

                {behaviors.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">🧠 Behaviors to Track</p>
                    <div className="space-y-2">
                      {behaviors.map(b => (
                        <div key={b.id} className="border border-red-100 rounded-lg p-3 bg-red-50">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-semibold text-red-800">{b.name}</p>
                            <div className="flex gap-1">
                              {b.severity_levels?.sort((a, b) => a.level_number - b.level_number).map(s => (
                                <span key={s.id} className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                                  style={{ backgroundColor: s.color }}>{s.label}</span>
                              ))}
                            </div>
                          </div>
                          {b.operational_definition && <p className="text-xs text-red-700 mt-1"><strong>Definition:</strong> {b.operational_definition}</p>}
                          {b.replacement_behavior && <p className="text-xs text-orange-700 mt-1"><strong>Replacement:</strong> {b.replacement_behavior}</p>}
                          {b.bcba_notes && <p className="text-xs text-gray-600 mt-1 italic">BCBA Note: {b.bcba_notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Object.entries(targetsByProgram).map(([program, programTargets]) => (
                  <div key={program} className="mb-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">🎯 {program}</p>
                    <div className="space-y-2">
                      {programTargets.map(t => (
                        <div key={t.id} className={`border rounded-lg p-3 ${t.status === "mastered" ? "bg-green-50 border-green-100" : "bg-white border-gray-100"}`}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-semibold text-gray-800">{t.target_name}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(t.status)}`}>{statusLabel(t.status)}</span>
                          </div>
                          <div className="flex gap-4 text-xs text-gray-500 mt-1">
                            <span>📊 {t.sets_per_session} sets × {t.trials_per_set} trials</span>
                            {t.current_prompt_level && <span>📍 Current: <strong className="text-blue-600">{t.current_prompt_level}</strong></span>}
                            {t.current_accuracy > 0 && <span>✓ {t.current_accuracy}% accuracy</span>}
                          </div>
                          {t.sd_text && <p className="text-xs text-gray-600 mt-1"><strong>SD:</strong> {t.sd_text}</p>}
                          {t.instructions && (
                            <div className="mt-2 bg-yellow-50 border border-yellow-100 rounded-lg p-2">
                              <p className="text-xs font-semibold text-yellow-700 mb-1">📝 How to run this program:</p>
                              <p className="text-xs text-yellow-800 whitespace-pre-wrap">{t.instructions}</p>
                            </div>
                          )}
                          {t.materials && <p className="text-xs text-gray-500 mt-1">🧰 Materials: {t.materials}</p>}
                          {t.bcba_notes && <p className="text-xs text-purple-700 mt-1 italic">BCBA Note: {t.bcba_notes}</p>}
                          {t.prompt_levels && t.prompt_levels.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {t.prompt_levels.sort((a, b) => a.level_number - b.level_number).map(p => (
                                <span key={p.id} className={`text-xs px-2 py-0.5 rounded-full border ${t.current_prompt_level === p.label ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                                  {p.abbreviation ? `${p.abbreviation} — ` : ""}{p.label}
                                </span>
                              ))}
                            </div>
                          )}
                          {t.mastery_criteria && (
                            <p className="text-xs text-gray-400 mt-1">Mastery: {t.mastery_criteria} ({t.sessions_at_mastery}/{t.mastery_sessions_required} sessions)</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {targets.length === 0 && behaviors.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <p>No programs or behaviors set up yet.</p>
                    {canEdit && <p className="text-sm mt-1">Use the Behaviors and Skill Targets tabs to add them.</p>}
                  </div>
                )}
              </Section>
            </div>
          )}

          {/* BEHAVIORS TAB */}
          {activeTab === "behaviors" && (
            <div className="space-y-4">
              {canEdit && (
                <button onClick={() => { resetBehaviorForm(); setShowBehaviorForm(s => !s); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                  {showBehaviorForm && !editingBehavior ? "Cancel" : "+ Add Behavior"}
                </button>
              )}

              {showBehaviorForm && canEdit && (
                <Section title={editingBehavior ? "Edit Behavior" : "New Behavior"}>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Behavior Name *</label>
                        <input type="text" value={behaviorForm.name} onChange={e => setBehaviorForm(p => ({ ...p, name: e.target.value }))}
                          placeholder="e.g. Physical Aggression, Elopement, SIB"
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Operational Definition *</label>
                        <textarea value={behaviorForm.operational_definition} onChange={e => setBehaviorForm(p => ({ ...p, operational_definition: e.target.value }))}
                          placeholder="Clearly define the behavior so any RBT can identify it consistently..."
                          rows={3} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Common Antecedents</label>
                        <textarea value={behaviorForm.antecedent} onChange={e => setBehaviorForm(p => ({ ...p, antecedent: e.target.value }))}
                          placeholder="What typically triggers this behavior?"
                          rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Consequence Procedure</label>
                        <textarea value={behaviorForm.consequence} onChange={e => setBehaviorForm(p => ({ ...p, consequence: e.target.value }))}
                          placeholder="What should staff do when this behavior occurs?"
                          rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Replacement Behavior</label>
                        <input type="text" value={behaviorForm.replacement_behavior} onChange={e => setBehaviorForm(p => ({ ...p, replacement_behavior: e.target.value }))}
                          placeholder="What should the client do instead?"
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-700 mb-1 block">BCBA Notes for Staff</label>
                        <textarea value={behaviorForm.bcba_notes} onChange={e => setBehaviorForm(p => ({ ...p, bcba_notes: e.target.value }))}
                          placeholder="Notes visible to RBTs during session..."
                          rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                    </div>

                    {/* SEVERITY LEVELS */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">Severity Levels</label>
                        <button type="button" onClick={() => setSeverityLevels(prev => [...prev, { label: `Level ${prev.length + 1}`, description: "", color: "#dc2626" }])}
                          className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">+ Add Level</button>
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
                                className="text-red-400 hover:text-red-600 text-xs mt-1">✕</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={saveBehavior} loading={saving}>
                        {editingBehavior ? "Update Behavior" : "Save Behavior"}
                      </Button>
                      <Button variant="outline" onClick={resetBehaviorForm}>Cancel</Button>
                    </div>
                  </div>
                </Section>
              )}

              {behaviors.length === 0 && !showBehaviorForm && (
                <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
                  <p className="text-3xl mb-3">🧠</p>
                  <p className="text-gray-600 font-medium">No behaviors added yet</p>
                  {canEdit && <p className="text-gray-400 text-sm mt-1">Add behaviors with operational definitions and severity levels.</p>}
                </div>
              )}

              <div className="space-y-3">
                {behaviors.map(behavior => (
                  <div key={behavior.id} className="border border-gray-100 rounded-xl bg-white overflow-hidden">
                    <button type="button" className="w-full text-left p-4"
                      onClick={() => setExpandedBehavior(expandedBehavior === behavior.id ? null : behavior.id)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">🧠</span>
                          <div>
                            <p className="font-semibold text-gray-800">{behavior.name}</p>
                            {behavior.operational_definition && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{behavior.operational_definition}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {behavior.severity_levels?.sort((a, b) => a.level_number - b.level_number).map(s => (
                              <span key={s.id} className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                            ))}
                          </div>
                          <span className="text-gray-400">{expandedBehavior === behavior.id ? "▼" : "▶"}</span>
                        </div>
                      </div>
                    </button>

                    {expandedBehavior === behavior.id && (
                      <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
                        {behavior.operational_definition && (
                          <div className="bg-red-50 rounded-lg p-3">
                            <p className="text-xs font-semibold text-red-700 mb-1">Operational Definition</p>
                            <p className="text-sm text-red-800">{behavior.operational_definition}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {behavior.antecedent && (
                            <div className="bg-orange-50 rounded-lg p-3">
                              <p className="text-xs font-semibold text-orange-700 mb-1">Common Antecedents</p>
                              <p className="text-sm text-orange-800">{behavior.antecedent}</p>
                            </div>
                          )}
                          {behavior.consequence && (
                            <div className="bg-blue-50 rounded-lg p-3">
                              <p className="text-xs font-semibold text-blue-700 mb-1">Consequence Procedure</p>
                              <p className="text-sm text-blue-800">{behavior.consequence}</p>
                            </div>
                          )}
                        </div>
                        {behavior.replacement_behavior && (
                          <div className="bg-green-50 rounded-lg p-3">
                            <p className="text-xs font-semibold text-green-700 mb-1">Replacement Behavior</p>
                            <p className="text-sm text-green-800">{behavior.replacement_behavior}</p>
                          </div>
                        )}
                        {behavior.bcba_notes && (
                          <div className="bg-purple-50 rounded-lg p-3">
                            <p className="text-xs font-semibold text-purple-700 mb-1">BCBA Notes for Staff</p>
                            <p className="text-sm text-purple-800">{behavior.bcba_notes}</p>
                          </div>
                        )}
                        {behavior.severity_levels && behavior.severity_levels.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Severity Levels</p>
                            <div className="space-y-1">
                              {behavior.severity_levels.sort((a, b) => a.level_number - b.level_number).map(s => (
                                <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg border-l-4"
                                  style={{ borderLeftColor: s.color, backgroundColor: `${s.color}15` }}>
                                  <span className="text-xs font-semibold" style={{ color: s.color }}>{s.label}</span>
                                  {s.description && <span className="text-xs text-gray-500">— {s.description}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {canEdit && (
                          <div className="flex gap-2 pt-2 border-t border-gray-100">
                            <button onClick={() => startEditBehavior(behavior)}
                              className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">Edit</button>
                            <button onClick={() => deactivateBehavior(behavior.id)}
                              className="text-xs px-3 py-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100">Remove</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TARGETS TAB */}
          {activeTab === "targets" && (
            <div className="space-y-4">
              {canEdit && (
                <button onClick={() => { resetTargetForm(); setShowTargetForm(s => !s); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                  {showTargetForm && !editingTarget ? "Cancel" : "+ Add Skill Target"}
                </button>
              )}

              {showTargetForm && canEdit && (
                <Section title={editingTarget ? "Edit Skill Target" : "New Skill Target"}>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Program Name *</label>
                        <input type="text" value={targetForm.program_name} onChange={e => setTargetForm(p => ({ ...p, program_name: e.target.value }))}
                          placeholder="e.g. Mand Training, Tact Training, Imitation"
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Target Name *</label>
                        <input type="text" value={targetForm.target_name} onChange={e => setTargetForm(p => ({ ...p, target_name: e.target.value }))}
                          placeholder="e.g. Cup, Ball, Colors, Patterns"
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
                        <select value={targetForm.status} onChange={e => setTargetForm(p => ({ ...p, status: e.target.value }))}
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                          <option value="in_progress">In Progress</option>
                          <option value="mastered">Mastered</option>
                          <option value="on_hold">On Hold</option>
                          <option value="discontinued">Discontinued</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Current Prompt Level</label>
                        <input type="text" value={targetForm.current_prompt_level} onChange={e => setTargetForm(p => ({ ...p, current_prompt_level: e.target.value }))}
                          placeholder="e.g. Gesture, Partial Physical"
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Sets per Session</label>
                        <input type="number" value={targetForm.sets_per_session} onChange={e => setTargetForm(p => ({ ...p, sets_per_session: parseInt(e.target.value) }))}
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Trials per Set</label>
                        <input type="number" value={targetForm.trials_per_set} onChange={e => setTargetForm(p => ({ ...p, trials_per_set: parseInt(e.target.value) }))}
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Mastery Criteria</label>
                        <input type="text" value={targetForm.mastery_criteria} onChange={e => setTargetForm(p => ({ ...p, mastery_criteria: e.target.value }))}
                          placeholder="e.g. 80% across 3 consecutive sessions"
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Sessions Required for Mastery</label>
                        <input type="number" value={targetForm.mastery_sessions_required} onChange={e => setTargetForm(p => ({ ...p, mastery_sessions_required: parseInt(e.target.value) }))}
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-700 mb-1 block">SD (Discriminative Stimulus)</label>
                        <input type="text" value={targetForm.sd_text} onChange={e => setTargetForm(p => ({ ...p, sd_text: e.target.value }))}
                          placeholder='e.g. "What do you want?" or point to items'
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Materials Needed</label>
                        <input type="text" value={targetForm.materials} onChange={e => setTargetForm(p => ({ ...p, materials: e.target.value }))}
                          placeholder="e.g. Cup, ball, flashcards, token board"
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-700 mb-1 block">How to Run This Program (RBT Instructions)</label>
                        <textarea value={targetForm.instructions} onChange={e => setTargetForm(p => ({ ...p, instructions: e.target.value }))}
                          placeholder="Step by step instructions for the RBT. e.g. 1. Present the item in front of client. 2. Wait 3 seconds for mand. 3. If no response, use gesture prompt. 4. Reinforce immediately..."
                          rows={5} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Goal</label>
                        <input type="text" value={targetForm.goal} onChange={e => setTargetForm(p => ({ ...p, goal: e.target.value }))}
                          placeholder="e.g. Client will independently mand for preferred items"
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-700 mb-1 block">BCBA Notes for Staff</label>
                        <textarea value={targetForm.bcba_notes} onChange={e => setTargetForm(p => ({ ...p, bcba_notes: e.target.value }))}
                          placeholder="Notes visible to RBTs during session..."
                          rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                    </div>

                    {/* PROMPT LEVELS */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">Prompt Hierarchy</label>
                        <button type="button" onClick={() => setPromptLevels(prev => [...prev, { label: "", abbreviation: "" }])}
                          className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">+ Add Level</button>
                      </div>
                      <div className="space-y-2">
                        {promptLevels.map((level, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <input type="text" value={level.abbreviation}
                              onChange={e => setPromptLevels(prev => prev.map((l, j) => j === i ? { ...l, abbreviation: e.target.value } : l))}
                              placeholder="Abbr" className="w-16 border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-300" />
                            <input type="text" value={level.label}
                              onChange={e => setPromptLevels(prev => prev.map((l, j) => j === i ? { ...l, label: e.target.value } : l))}
                              placeholder="Prompt level label"
                              className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                            <button type="button" onClick={() => setPromptLevels(prev => prev.filter((_, j) => j !== i))}
                              className="text-red-400 hover:text-red-600 text-xs">✕</button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={saveTarget} loading={saving}>
                        {editingTarget ? "Update Target" : "Save Target"}
                      </Button>
                      <Button variant="outline" onClick={resetTargetForm}>Cancel</Button>
                    </div>
                  </div>
                </Section>
              )}

              {targets.length === 0 && !showTargetForm && (
                <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
                  <p className="text-3xl mb-3">🎯</p>
                  <p className="text-gray-600 font-medium">No skill targets added yet</p>
                  {canEdit && <p className="text-gray-400 text-sm mt-1">Add skill targets with RBT instructions and prompt hierarchies.</p>}
                </div>
              )}

              {Object.entries(targetsByProgram).map(([program, programTargets]) => (
                <div key={program}>
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">{program}</h3>
                  <div className="space-y-3">
                    {programTargets.map(target => (
                      <div key={target.id} className="border border-gray-100 rounded-xl bg-white overflow-hidden">
                        <button type="button" className="w-full text-left p-4"
                          onClick={() => setExpandedTarget(expandedTarget === target.id ? null : target.id)}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-lg">🎯</span>
                              <div>
                                <p className="font-semibold text-gray-800">{target.target_name}</p>
                                <div className="flex items-center gap-3 mt-0.5">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(target.status)}`}>
                                    {statusLabel(target.status)}
                                  </span>
                                  <span className="text-xs text-gray-400">{target.sets_per_session} sets × {target.trials_per_set} trials</span>
                                  {target.current_prompt_level && (
                                    <span className="text-xs text-blue-600 font-medium">📍 {target.current_prompt_level}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {canEdit && (
                                <select value={target.status}
                                  onChange={e => { e.stopPropagation(); updateTargetStatus(target.id, e.target.value); }}
                                  onClick={e => e.stopPropagation()}
                                  className="text-xs border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300">
                                  <option value="in_progress">In Progress</option>
                                  <option value="mastered">Mastered</option>
                                  <option value="on_hold">On Hold</option>
                                  <option value="discontinued">Discontinued</option>
                                </select>
                              )}
                              <span className="text-gray-400">{expandedTarget === target.id ? "▼" : "▶"}</span>
                            </div>
                          </div>
                        </button>

                        {expandedTarget === target.id && (
                          <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
                            {target.sd_text && (
                              <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-xs font-semibold text-gray-600 mb-1">SD (Discriminative Stimulus)</p>
                                <p className="text-sm text-gray-700 font-medium">"{target.sd_text}"</p>
                              </div>
                            )}
                            {target.materials && (
                              <p className="text-xs text-gray-500">🧰 <strong>Materials:</strong> {target.materials}</p>
                            )}
                            {target.instructions && (
                              <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3">
                                <p className="text-xs font-semibold text-yellow-700 mb-2">📝 How to Run This Program</p>
                                <p className="text-sm text-yellow-800 whitespace-pre-wrap">{target.instructions}</p>
                              </div>
                            )}
                            {target.prompt_levels && target.prompt_levels.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Prompt Hierarchy</p>
                                <div className="flex flex-wrap gap-2">
                                  {target.prompt_levels.sort((a, b) => a.level_number - b.level_number).map(p => (
                                    <div key={p.id} className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${target.current_prompt_level === p.label ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>
                                      {p.abbreviation && <span className="font-bold mr-1">{p.abbreviation}</span>}
                                      {p.label}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {target.goal && <p className="text-xs text-gray-500"><strong>Goal:</strong> {target.goal}</p>}
                            {target.mastery_criteria && (
                              <p className="text-xs text-gray-500">
                                <strong>Mastery:</strong> {target.mastery_criteria} ({target.sessions_at_mastery}/{target.mastery_sessions_required} sessions)
                              </p>
                            )}
                            {target.bcba_notes && (
                              <div className="bg-purple-50 rounded-lg p-3">
                                <p className="text-xs font-semibold text-purple-700 mb-1">BCBA Notes for Staff</p>
                                <p className="text-sm text-purple-800">{target.bcba_notes}</p>
                              </div>
                            )}
                            {canEdit && (
                              <div className="flex gap-2 pt-2 border-t border-gray-100">
                                <button onClick={() => startEditTarget(target)}
                                  className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">Edit</button>
                                <button onClick={() => deactivateTarget(target.id)}
                                  className="text-xs px-3 py-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100">Remove</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}