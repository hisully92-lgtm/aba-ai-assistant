"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string; diagnosis: string | null; goals: string | null };

export default function AITreatmentPlansPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [focusArea, setFocusArea] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [currentLevel, setCurrentLevel] = useState("");

  const FOCUS_AREAS = ["Communication", "Social Skills", "Behavior Reduction", "Daily Living Skills", "Academic Skills", "Motor Skills", "Feeding", "Toilet Training"];
  const AGE_GROUPS = ["Toddler (1-3)", "Preschool (3-5)", "School Age (6-12)", "Adolescent (13-17)", "Adult (18+)"];
  const SKILL_LEVELS = ["Early Learner", "Intermediate", "Advanced"];

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("clients").select("id, full_name, diagnosis, goals").eq("created_by", user.id);
    setClients(data ?? []);
    setLoading(false);
  }

  async function generatePlan() {
    if (!selectedClientId) return;
    setGenerating(true);
    setPlan(null);
    setSaved(false);

    const client = clients.find((c) => c.id === selectedClientId);

    const [{ data: sessions }, { data: behaviors }, { data: programs }] = await Promise.all([
      supabase.from("sessions").select("behaviors_observed, programs_targeted, client_response").eq("client_id", selectedClientId).order("created_at", { ascending: false }).limit(10),
      supabase.from("behaviors").select("behavior_name, function_hypothesis, intervention_used").eq("client_id", selectedClientId).order("created_at", { ascending: false }).limit(10),
      supabase.from("programs").select("program_name, prompt_level, mastery_criteria, trial_data").eq("client_id", selectedClientId).order("created_at", { ascending: false }).limit(10),
    ]);

    const masteredPrograms = programs?.filter((p) => {
      const match = p.trial_data?.match(/(\d+)/);
      const pct = match ? parseInt(match[1]) : 0;
      const masteryMatch = p.mastery_criteria?.match(/(\d+)%/);
      const mastery = masteryMatch ? parseInt(masteryMatch[1]) : 80;
      return pct >= mastery;
    }).map((p) => p.program_name) ?? [];

    const prompt = `You are an expert BCBA creating a comprehensive ABA treatment plan.

Client Information:
- Name: ${client?.full_name}
- Diagnosis: ${client?.diagnosis ?? "Not specified"}
- Current Goals: ${client?.goals ?? "Not specified"}
- Age Group: ${ageGroup || "Not specified"}
- Current Skill Level: ${currentLevel || "Not specified"}
- Focus Area: ${focusArea || "General"}

Recent Clinical Data:
Sessions (last 10):
${sessions?.map((s) => `- Behaviors: ${s.behaviors_observed ?? "None"} | Programs: ${s.programs_targeted ?? "None"} | Response: ${s.client_response ?? "Unknown"}`).join("\n") ?? "No sessions"}

Current Behaviors of Concern:
${behaviors?.map((b) => `- ${b.behavior_name}: Function = ${b.function_hypothesis ?? "Unknown"}, Intervention = ${b.intervention_used ?? "Unknown"}`).join("\n") ?? "No behaviors"}

Current Programs:
${programs?.map((p) => `- ${p.program_name}: ${p.prompt_level ?? "Unknown prompt"}, Data: ${p.trial_data ?? "No data"}`).join("\n") ?? "No programs"}

Mastered Skills: ${masteredPrograms.join(", ") || "None yet"}

Please create a comprehensive ABA treatment plan with these sections:

1. ASSESSMENT SUMMARY
   - Present levels of performance
   - Strengths
   - Areas of need

2. BEHAVIOR REDUCTION GOALS (if applicable)
   - Target behaviors with operational definitions
   - Hypothesized function
   - Intervention strategies
   - Measurable goals

3. SKILL ACQUISITION GOALS (3-5 goals)
   - Goal statement (SMART format)
   - Baseline
   - Target criteria
   - Teaching procedure
   - Suggested programs

4. RECOMMENDED TEACHING STRATEGIES
   - Primary teaching format (DTT, NET, etc.)
   - Reinforcement recommendations
   - Prompt hierarchy

5. PARENT/CAREGIVER TRAINING TARGETS
   - Home implementation goals
   - Generalization targets

6. DATA COLLECTION RECOMMENDATIONS

7. SHORT-TERM OBJECTIVES (3 months)

8. LONG-TERM GOALS (6-12 months)

Be specific, evidence-based, and use ABA terminology throughout.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await res.json();
      setPlan(data.content?.[0]?.text ?? "Unable to generate plan.");
    } catch {
      setPlan("AI generation failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function savePlan() {
    if (!plan || !selectedClientId) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const client = clients.find((c) => c.id === selectedClientId);

    await supabase.from("treatment_plans").insert([{
      client_id: selectedClientId,
      plan_name: `AI Generated Plan — ${new Date().toLocaleDateString()}`,
      goals: JSON.stringify([{
        description: "See full AI-generated plan in notes",
        target: focusArea || "General",
        mastery_criteria: "As defined in plan",
        status: "In Progress",
      }]),
      notes: plan,
      start_date: new Date().toISOString().split("T")[0],
      status: "active",
      created_by: user.id,
    }]);

    setSaved(true);
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="AI Treatment Plan Generator">
        <p className="text-gray-500 text-sm">Generate evidence-based treatment plans using clinical data.</p>
      </PageHeader>

      <Section title="Plan Parameters">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
            <select value={selectedClientId} onChange={(e) => { setSelectedClientId(e.target.value); setPlan(null); setSaved(false); }}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">Select client...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name} {c.diagnosis ? `(${c.diagnosis})` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Primary Focus Area</label>
            <select value={focusArea} onChange={(e) => setFocusArea(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">General / All Areas</option>
              {FOCUS_AREAS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Age Group</label>
            <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">Select age group...</option>
              {AGE_GROUPS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Current Skill Level</label>
            <select value={currentLevel} onChange={(e) => setCurrentLevel(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">Select level...</option>
              {SKILL_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <Button onClick={generatePlan} loading={generating} disabled={!selectedClientId}>
            🤖 Generate AI Treatment Plan
          </Button>
          {plan && !saved && (
            <Button variant="outline" onClick={savePlan} loading={saving}>
              💾 Save to Treatment Plans
            </Button>
          )}
          {saved && (
            <span className="text-sm text-green-600 flex items-center">✓ Saved to Treatment Plans</span>
          )}
        </div>
      </Section>

      {generating && (
        <Section title="Generating Plan...">
          <div className="flex items-center gap-3 py-4">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Analyzing clinical data and generating evidence-based treatment plan...</p>
          </div>
        </Section>
      )}

      {plan && (
        <Section title="Generated Treatment Plan">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
            {plan}
          </div>
          <div className="mt-4 flex gap-2">
            {!saved && (
              <Button onClick={savePlan} loading={saving}>
                💾 Save to Treatment Plans
              </Button>
            )}
            <Button variant="outline" onClick={() => { setPlan(null); setSaved(false); }}>
              Clear
            </Button>
            <Button variant="outline" onClick={generatePlan} loading={generating}>
              🔄 Regenerate
            </Button>
          </div>
          {saved && (
            <p className="text-sm text-green-600 mt-2">✓ Plan saved to Treatment Plans page.</p>
          )}
        </Section>
      )}
    </div>
  );
}