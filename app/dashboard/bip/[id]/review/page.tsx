"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";

export default function BIPReviewPage({ params }: { params: { id: string } }) {
  const bipId = params.id;
  const router = useRouter();
  const [bip, setBip] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [behaviors, setBehaviors] = useState<any[]>([]);
  const [skillPrograms, setSkillPrograms] = useState<any[]>([]);
  const [caregiverTraining, setCaregiverTraining] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [reviewType, setReviewType] = useState("quarterly");
  const [reviewDate, setReviewDate] = useState(new Date().toISOString().split("T")[0]);
  const [summary, setSummary] = useState("");
  const [goalsMastered, setGoalsMastered] = useState<string[]>([]);
  const [goalsInProgress, setGoalsInProgress] = useState<string[]>([]);
  const [goalsDiscontinued, setGoalsDiscontinued] = useState<string[]>([]);
  const [modificationsMade, setModificationsMade] = useState("");
  const [continuedMedicalNecessity, setContinuedMedicalNecessity] = useState("");
  const [hoursRecommended, setHoursRecommended] = useState(20);
  const [nextReviewDate, setNextReviewDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 3); return d.toISOString().split("T")[0];
  });
  const [aiGenerating, setAiGenerating] = useState(false);

  useEffect(() => { init(); }, [bipId]);

  async function init() {
    const [{ data: bipData }, { data: behaviorData }, { data: skillData }, { data: careData }] = await Promise.all([
      supabase.from("behavior_intervention_plans").select("*").eq("id", bipId).single(),
      supabase.from("bip_target_behaviors").select("*").eq("bip_id", bipId),
      supabase.from("bip_skill_programs").select("*").eq("bip_id", bipId),
      supabase.from("bip_caregiver_training").select("*").eq("bip_id", bipId),
    ]);

    setBip(bipData);
    setBehaviors(behaviorData ?? []);
    setSkillPrograms(skillData ?? []);
    setCaregiverTraining(careData ?? []);
    if (bipData?.recommended_hours_per_week) setHoursRecommended(bipData.recommended_hours_per_week);

    if (bipData?.client_id) {
      const { data: clientData } = await supabase.from("clients").select("*").eq("id", bipData.client_id).single();
      setClient(clientData);
    }

    setLoading(false);
  }

  async function generateWithAI() {
    if (!client || !bip) return;
    setAiGenerating(true);

    try {
      const response = await fetch("/api/ai", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    type: "bip_review",
    model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `Write a quarterly BIP review summary for an ABA therapy client.

Client: ${client.full_name}
Diagnosis: ${bip.diagnosis_code}
Plan period: ${bip.plan_start_date} to ${bip.plan_end_date}
Recommended hours: ${bip.recommended_hours_per_week}h/week

Target behaviors: ${behaviors.map((b: any) => b.behavior_name).join(", ")}
Skill programs: ${skillPrograms.map((p: any) => p.program_name).join(", ")}

Write a professional clinical quarterly review summary (3-4 sentences) suitable for insurance reauthorization that:
1. Documents progress on target behaviors
2. Notes skill acquisition progress
3. Justifies continued medical necessity
4. Recommends continued services

Be clinical and objective. Do not include any preamble.`
          }]
        })
      });

      const data = await response.json();
      const text = data.result ?? data.content?.[0]?.text ?? data.text ?? "";
      if (text) {
        setSummary(text);
        setContinuedMedicalNecessity(`Continued ABA services are medically necessary for ${client.full_name} to maintain progress on targeted behaviors and skill acquisition programs as documented in this quarterly review.`);
      }
    } catch (err) {
      console.error("AI generation failed:", err);
    }

    setAiGenerating(false);
  }

  async function handleSave(status: string) {
    if (!summary) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data: review } = await supabase.from("bip_reviews").insert([{
      bip_id: bipId,
      review_date: reviewDate,
      review_type: reviewType,
      summary,
      goals_mastered: JSON.stringify(goalsMastered),
      goals_in_progress: JSON.stringify(goalsInProgress),
      goals_discontinued: JSON.stringify(goalsDiscontinued),
      modifications_made: modificationsMade || null,
      continued_medical_necessity: continuedMedicalNecessity || null,
      hours_recommended: hoursRecommended,
      next_review_date: nextReviewDate,
      status,
      created_by: user.id,
    }]).select().single();

    // Update BIP review date and version
    await supabase.from("behavior_intervention_plans").update({
      review_date: nextReviewDate,
      reauth_due_date: nextReviewDate,
      updated_at: new Date().toISOString(),
      version: (bip?.version ?? 1) + 1,
      status: status === "final" ? "under_review" : bip?.status,
    }).eq("id", bipId);

    setSaving(false);
    router.push(`/dashboard/bip/${bipId}`);
  }

  function exportReviewPDF() {
    if (!client || !bip) return;
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("BIP QUARTERLY REVIEW", 105, y, { align: "center" });
    y += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Client: ${client.full_name} | Date: ${reviewDate} | Type: ${reviewType}`, 105, y, { align: "center" });
    y += 6;
    doc.line(20, y, 190, y); y += 8;

    const field = (label: string, value: string) => {
      if (!value) return;
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`${label}:`, 20, y); y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(value, 170);
      doc.text(lines, 20, y);
      y += lines.length * 5 + 4;
    };

    field("Clinical Summary", summary);
    field("Continued Medical Necessity", continuedMedicalNecessity);
    field("Modifications Made", modificationsMade);
    if (goalsMastered.length > 0) field("Goals Mastered", goalsMastered.join(", "));
    if (goalsInProgress.length > 0) field("Goals In Progress", goalsInProgress.join(", "));
    if (goalsDiscontinued.length > 0) field("Goals Discontinued", goalsDiscontinued.join(", "));
    field("Hours Recommended", `${hoursRecommended} hours/week`);
    field("Next Review Date", nextReviewDate);

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("CONFIDENTIAL — For clinical use only. Protected Health Information.", 105, 290, { align: "center" });

    doc.save(`BIP-Review-${client.full_name.replace(/\s/g, "-")}-${reviewDate}.pdf`);
  }

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title={`Quarterly BIP Review — ${client?.full_name}`}>
        <Button variant="outline" onClick={exportReviewPDF}>📄 Export PDF</Button>
      </PageHeader>

      <Section title="Review Details">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Review Type</label>
            <select value={reviewType} onChange={(e) => setReviewType(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              {["quarterly", "annual", "reauth", "modification", "crisis", "team_meeting"].map((t) => (
                <option key={t} value={t}>{t.replace("_", " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Review Date</label>
            <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Next Review Date</label>
            <input type="date" value={nextReviewDate} onChange={(e) => setNextReviewDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
        </div>
      </Section>

      {/* GOAL STATUS */}
      <Section title="Goal Status Update">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "✅ Goals Mastered", items: goalsMastered, setter: setGoalsMastered, color: "bg-green-50 border-green-200" },
            { label: "⟳ Goals In Progress", items: goalsInProgress, setter: setGoalsInProgress, color: "bg-blue-50 border-blue-200" },
            { label: "❌ Goals Discontinued", items: goalsDiscontinued, setter: setGoalsDiscontinued, color: "bg-red-50 border-red-200" },
          ].map((section) => (
            <div key={section.label} className={`border rounded-xl p-4 ${section.color}`}>
              <p className="text-sm font-semibold text-gray-700 mb-2">{section.label}</p>
              <div className="space-y-1 mb-2">
                {section.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-1 text-xs text-gray-700">
                    <span className="flex-1">{item}</span>
                    <button onClick={() => section.setter((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-gray-400 hover:text-red-400">✕</button>
                  </div>
                ))}
              </div>
              {/* Quick add from existing programs/behaviors */}
              <select onChange={(e) => { if (e.target.value) { section.setter((prev) => [...prev, e.target.value]); e.target.value = ""; } }}
                className="w-full border rounded-lg px-2 py-1 text-xs focus:outline-none bg-white">
                <option value="">+ Add goal...</option>
                {behaviors.map((b: any) => <option key={b.id} value={b.behavior_name}>{b.behavior_name}</option>)}
                {skillPrograms.map((p: any) => <option key={p.id} value={p.program_name}>{p.program_name}</option>)}
              </select>
            </div>
          ))}
        </div>
      </Section>

      {/* CLINICAL SUMMARY */}
      <Section title="Clinical Summary">
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-bold text-purple-700 mb-2">✨ AI Review Generator</p>
          <p className="text-xs text-purple-600 mb-3">Generate a clinical summary suitable for insurance reauthorization using current BIP data.</p>
          <Button onClick={generateWithAI} loading={aiGenerating} className="bg-purple-600 hover:bg-purple-700">
            ✨ Generate with AI
          </Button>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Clinical Summary *</label>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)}
            placeholder="Document client's progress, response to interventions, and clinical observations this review period..."
            rows={6} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
      </Section>

      <Section title="Medical Necessity & Modifications">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Continued Medical Necessity Justification</label>
            <textarea value={continuedMedicalNecessity} onChange={(e) => setContinuedMedicalNecessity(e.target.value)}
              placeholder="Justify why continued ABA services are medically necessary at this time..."
              rows={4} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">BIP Modifications Made This Period</label>
            <textarea value={modificationsMade} onChange={(e) => setModificationsMade(e.target.value)}
              placeholder="Document any changes to goals, strategies, teaching procedures, or intervention plans..."
              rows={3} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Recommended Hours/Week</label>
            <input type="number" min={1} max={40} value={hoursRecommended}
              onChange={(e) => setHoursRecommended(parseInt(e.target.value) || 0)}
              className="w-48 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
        </div>
      </Section>

      {/* CAREGIVER TRAINING SUMMARY */}
      {caregiverTraining.length > 0 && (
        <Section title="Caregiver Training This Period">
          <div className="space-y-1">
            {caregiverTraining.map((t: any) => (
              <div key={t.id} className={`flex items-center gap-2 text-sm border rounded-lg p-2 ${t.completed ? "border-green-100 bg-green-50" : "border-gray-100"}`}>
                <span className={t.completed ? "text-green-500" : "text-gray-300"}>{t.completed ? "✓" : "○"}</span>
                <span className="text-gray-700">{t.training_topic}</span>
                {t.caregiver_name && <span className="text-gray-400 text-xs">— {t.caregiver_name}</span>}
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="flex gap-3">
        <Button onClick={() => handleSave("draft")} loading={saving} variant="outline">Save as Draft</Button>
        <Button onClick={() => handleSave("final")} loading={saving} disabled={!summary}>
          ✓ Finalize Review
        </Button>
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </div>
  );
}