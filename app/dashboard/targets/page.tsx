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
  prompt_levels: PromptLevel[];
};

type PromptLevel = {
  id: string;
  level_number: number;
  label: string;
  abbreviation: string | null;
  description: string | null;
};

export default function TargetsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [targets, setTargets] = useState<SkillTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"behaviors" | "targets">("behaviors");
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

  const [saving, setSaving] = useState(false);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedClient) loadData(); }, [selectedClient]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const [{ data: behaviorData }, { data: targetData }] = await Promise.all([
      supabase.from("custom_behaviors").select("*, severity_levels:behavior_severity_levels(*)")
        .eq("company_id", companyId).eq("client_id", selectedClient)
        .eq("is_active", true).order("display_order"),
      supabase.from("skill_targets").select("*, prompt_levels(*)")
        .eq("company_id", companyId).eq("client_id", selectedClient)
        .eq("is_active", true).order("display_order"),
    ]);
    setBehaviors(behaviorData ?? []);
    setTargets(targetData ?? []);
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

  const canEdit = ["bcba", "supervisor", "admin", "clinical_director"].includes(role);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Behaviors & Skill Targets" />

      {!canEdit && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-700">
          ⚠️ Only BCBAs and supervisors can create and manage targets.
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
            {(["behaviors", "targets"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                {tab === "behaviors" ? "🧠 Behaviors" : "🎯 Skill Targets"}
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
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Mastery Criteria</label>
                        <input type="text" value={masteryCriteria} onChange={e => setMasteryCriteria(e.target.value)}
                          placeholder="e.g. 80% across 3 consecutive sessions"
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">Prompt Levels</label>
                        <button type="button" onClick={() => setPromptLevels(prev => [...prev, { label: "", abbreviation: "", description: "" }])}
                          className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                          + Add Level
                        </button>
                      </div>
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
                {targets.map(target => (
                  <div key={target.id} className="border border-gray-100 rounded-xl p-4 bg-white">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-xs text-blue-600 font-medium">{target.program_name}</p>
                        <p className="font-semibold text-gray-800">{target.target_name}</p>
                        {target.description && <p className="text-xs text-gray-500 mt-0.5">{target.description}</p>}
                        {target.goal && <p className="text-xs text-gray-400 mt-1">Goal: {target.goal}</p>}
                        {target.mastery_criteria && <p className="text-xs text-gray-400">Mastery: {target.mastery_criteria}</p>}
                      </div>
                      {canEdit && (
                        <button onClick={() => deactivateTarget(target.id)}
                          className="text-xs text-gray-300 hover:text-red-400 transition-colors">Remove</button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(target.prompt_levels ?? []).sort((a, b) => a.level_number - b.level_number).map(level => (
                        <div key={level.id} className="px-2 py-1 bg-purple-50 border border-purple-100 rounded-lg text-xs">
                          <span className="font-bold text-purple-700">{level.abbreviation}</span>
                          {level.abbreviation && <span className="text-gray-400 mx-1">·</span>}
                          <span className="text-gray-600">{level.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}