"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";

type Client = { id: string; full_name: string };
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

export default function ProgramSkillTargetsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [targets, setTargets] = useState<SkillTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState("");
  const [role, setRole] = useState("");
  const [userId, setUserId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [programName, setProgramName] = useState("");
  const [targetName, setTargetName] = useState("");
  const [targetDesc, setTargetDesc] = useState("");
  const [targetGoal, setTargetGoal] = useState("");
  const [masteryCriteria, setMasteryCriteria] = useState("");
  const [promptLevels, setPromptLevels] = useState([
    { label: "Independent", abbreviation: "I", description: "" },
    { label: "Gesture", abbreviation: "G", description: "" },
    { label: "Vocal", abbreviation: "V", description: "" },
    { label: "Partial Physical", abbreviation: "PP", description: "" },
    { label: "Full Physical", abbreviation: "FP", description: "" },
    { label: "No Response", abbreviation: "NR", description: "" },
  ]);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedClient) loadTargets(); }, [selectedClient]); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const { data: cu } = await supabase.from("company_users")
      .select("company_id, role").eq("user_id", user.id)
      .eq("status", "active").limit(1).maybeSingle();

    setCompanyId(cu?.company_id ?? "");
    setRole(cu?.role ?? "");

    const { data: clientData } = await supabase.from("clients")
      .select("id, full_name").eq("company_id", cu?.company_id).order("full_name");

    setClients(clientData ?? []);
    setLoading(false);
  }

  async function loadTargets() {
    const { data } = await supabase.from("skill_targets")
      .select("*, prompt_levels(*)")
      .eq("company_id", companyId)
      .eq("client_id", selectedClient)
      .eq("is_active", true)
      .order("display_order");
    setTargets(data ?? []);
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

    setProgramName(""); setTargetName(""); setTargetDesc("");
    setTargetGoal(""); setMasteryCriteria("");
    setPromptLevels([
      { label: "Independent", abbreviation: "I", description: "" },
      { label: "Gesture", abbreviation: "G", description: "" },
      { label: "Vocal", abbreviation: "V", description: "" },
      { label: "Partial Physical", abbreviation: "PP", description: "" },
      { label: "Full Physical", abbreviation: "FP", description: "" },
      { label: "No Response", abbreviation: "NR", description: "" },
    ]);
    setShowForm(false);
    await loadTargets();
    setSaving(false);
  }

  async function deactivateTarget(id: string) {
    await supabase.from("skill_targets").update({ is_active: false }).eq("id", id);
    await loadTargets();
  }

  const canEdit = ["bcba", "supervisor", "admin", "clinical_director"].includes(role);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Skill Targets" />

      {!canEdit && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-700">
          ⚠️ Only BCBAs and supervisors can create and manage skill targets.
        </div>
      )}

      <Section title="Select Client">
        <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">Select a client...</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
      </Section>

      {selectedClient && (
        <div className="space-y-4">
          {canEdit && (
            <button onClick={() => setShowForm(s => !s)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              {showForm ? "Cancel" : "+ Add Skill Target"}
            </button>
          )}

          {showForm && canEdit && (
            <Section title="New Skill Target">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Program Name *</label>
                    <input type="text" value={programName} onChange={e => setProgramName(e.target.value)}
                      placeholder="e.g. Mand Training, Tact Training"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Target Name *</label>
                    <input type="text" value={targetName} onChange={e => setTargetName(e.target.value)}
                      placeholder="e.g. Cup, Ball, Colors"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                    <textarea value={targetDesc} onChange={e => setTargetDesc(e.target.value)}
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
                    <button type="button"
                      onClick={() => setPromptLevels(prev => [...prev, { label: "", abbreviation: "", description: "" }])}
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

          {targets.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
              <p className="text-3xl mb-3">🎯</p>
              <p className="text-gray-600 font-medium">No skill targets yet</p>
              <p className="text-gray-400 text-sm mt-1">Add skill targets and prompt levels for this client.</p>
            </div>
          ) : (
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
          )}
        </div>
      )}
    </div>
  );
}
