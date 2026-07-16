"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Link from "next/link";
import jsPDF from "jspdf";

function GraphsTab({ bipId, clientId }: { bipId: string; clientId: string }) {
  const [images, setImages] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("bip_graph_images").select("*").eq("bip_id", bipId)
      .order("created_at", { ascending: false })
      .then(({ data }: { data: any[] | null }) => setImages(data ?? []));
  }, [bipId]);
  if (images.length === 0) return (
    <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
      <p className="text-3xl mb-3">📈</p>
      <p className="text-gray-600 font-medium">No graphs saved yet</p>
      <p className="text-gray-400 text-sm mt-1">Go to Analytics → Graphs, select this client, and click "Save to BIP"</p>
    </div>
  );
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {images.map((img: any) => (
        <div key={img.id} className="border border-gray-100 rounded-xl overflow-hidden bg-white">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <p className="text-xs font-semibold text-gray-700 capitalize">{img.graph_type} Graph</p>
            <p className="text-xs text-gray-400">{img.date_range_from} → {img.date_range_to}</p>
          </div>
          <img src={img.image_url} alt={img.graph_type} className="w-full" />
          <div className="px-4 py-2 flex justify-between items-center">
            <p className="text-xs text-gray-400">{new Date(img.created_at).toLocaleDateString()}</p>
            <a href={img.image_url} download target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:underline">⬇ Download</a>
          </div>
        </div>
      ))}
    </div>
  );
}

type BIP = any;
type TargetBehavior = any;
type SkillProgram = any;
type AntecedentStrategy = any;
type ConsequenceStrategy = any;
type ReplacementBehavior = any;
type CaregiverTraining = any;
type BIPReview = any;

export default function BIPDetailPage({ params }: { params: { id: string } }) {
  const bipId = params.id;
  const [bip, setBip] = useState<BIP | null>(null);
  const [client, setClient] = useState<any>(null);
  const [behaviors, setBehaviors] = useState<TargetBehavior[]>([]);
  const [skillPrograms, setSkillPrograms] = useState<SkillProgram[]>([]);
  const [antecedentStrategies, setAntecedentStrategies] = useState<AntecedentStrategy[]>([]);
  const [consequenceStrategies, setConsequenceStrategies] = useState<ConsequenceStrategy[]>([]);
  const [replacementBehaviors, setReplacementBehaviors] = useState<ReplacementBehavior[]>([]);
  const [fidelityChecks, setFidelityChecks] = useState<any[]>([]);
  const [caregiverTraining, setCaregiverTraining] = useState<CaregiverTraining[]>([]);
  const [reviews, setReviews] = useState<BIPReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => { init(); }, [bipId]);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [
      { data: bipData },
      { data: behaviorData },
      { data: skillData },
      { data: antData },
      { data: conData },
      { data: repData },
      { data: fidData },
      { data: careData },
      { data: reviewData },
    ] = await Promise.all([
      supabase.from("behavior_intervention_plans").select("*").eq("id", bipId).single(),
      supabase.from("bip_target_behaviors").select("*").eq("bip_id", bipId).order("priority"),
      supabase.from("bip_skill_programs").select("*").eq("bip_id", bipId),
      supabase.from("bip_antecedent_strategies").select("*").eq("bip_id", bipId),
      supabase.from("bip_consequence_strategies").select("*").eq("bip_id", bipId),
      supabase.from("bip_replacement_behaviors").select("*").eq("bip_id", bipId),
      supabase.from("bip_treatment_fidelity").select("*").eq("bip_id", bipId),
      supabase.from("bip_caregiver_training").select("*").eq("bip_id", bipId),
      supabase.from("bip_reviews").select("*").eq("bip_id", bipId).order("review_date", { ascending: false }),
    ]);

    setBip(bipData);
    setBehaviors(behaviorData ?? []);
    setSkillPrograms(skillData ?? []);
    setAntecedentStrategies(antData ?? []);
    setConsequenceStrategies(conData ?? []);
    setReplacementBehaviors(repData ?? []);
    setFidelityChecks(fidData ?? []);
    setCaregiverTraining(careData ?? []);
    setReviews(reviewData ?? []);

    if (bipData?.client_id) {
      const { data: clientData } = await supabase.from("clients").select("*").eq("id", bipData.client_id).single();
      setClient(clientData);
    }

    setLoading(false);
  }

  async function updateBIPStatus(status: string) {
    await supabase.from("behavior_intervention_plans").update({ status }).eq("id", bipId);
    setBip((prev: any) => ({ ...prev, status }));
  }

  async function signAsBCBA() {
    setSaving(true);
    await supabase.from("behavior_intervention_plans").update({
      bcba_signed: true,
      bcba_signed_at: new Date().toISOString(),
      status: bip?.caregiver_signed ? "active" : bip?.status,
    }).eq("id", bipId);
    setBip((prev: any) => ({ ...prev, bcba_signed: true, bcba_signed_at: new Date().toISOString() }));
    setSaving(false);
  }

  async function signAsCaregiver() {
    setSaving(true);
    await supabase.from("behavior_intervention_plans").update({
      caregiver_signed: true,
      caregiver_signed_at: new Date().toISOString(),
      status: bip?.bcba_signed ? "active" : bip?.status,
    }).eq("id", bipId);
    setBip((prev: any) => ({ ...prev, caregiver_signed: true, caregiver_signed_at: new Date().toISOString() }));
    setSaving(false);
  }

  async function markReauthSubmitted() {
    await supabase.from("behavior_intervention_plans").update({
      reauth_submitted: true,
      reauth_submitted_date: new Date().toISOString().split("T")[0],
      status: "reauth_pending",
    }).eq("id", bipId);
    setBip((prev: any) => ({ ...prev, reauth_submitted: true, status: "reauth_pending" }));
  }

  async function markReauthApproved() {
    await supabase.from("behavior_intervention_plans").update({
      reauth_approved: true,
      status: "active",
    }).eq("id", bipId);
    setBip((prev: any) => ({ ...prev, reauth_approved: true, status: "active" }));
  }

  function exportPDF() {
    if (!bip || !client) return;
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("BEHAVIOR INTERVENTION PLAN", 105, y, { align: "center" });
    y += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Client: ${client.full_name} | Version: ${bip.version} | Date: ${bip.plan_start_date}`, 105, y, { align: "center" });
    y += 6;
    doc.line(20, y, 190, y); y += 8;

    const section = (title: string) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(title, 20, y); y += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
    };

    const field = (label: string, value: string) => {
      if (!value) return;
      if (y > 265) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, 20, y);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(value, 150);
      doc.text(lines, 55, y);
      y += Math.max(7, lines.length * 5 + 2);
    };

    section("CLIENT INFORMATION");
    field("Name", client.full_name);
    field("Diagnosis", bip.diagnosis_code);
    field("Plan Period", `${bip.plan_start_date} to ${bip.plan_end_date}`);
    field("Hours/Week", `${bip.recommended_hours_per_week} hours per week`);
    field("Setting", bip.recommended_setting);
    y += 4;

    section("MEDICAL NECESSITY");
    field("Statement", bip.medical_necessity_statement);
    field("LMN", bip.lmn_obtained ? `Obtained — Dr. ${bip.lmn_physician} (${bip.lmn_date})` : "Not obtained");
    y += 4;

    if (bip.client_strengths) {
      section("CLIENT BACKGROUND");
      field("Strengths", bip.client_strengths);
      field("Preferences", bip.client_preferences);
      y += 4;
    }

    if (behaviors.length > 0) {
      section("TARGET BEHAVIORS");
      behaviors.forEach((b, idx) => {
        field(`${idx + 1}. ${b.behavior_name}`, "");
        field("  Definition", b.operational_definition);
        field("  Function", b.function_of_behavior);
        field("  Baseline", b.baseline_rate);
        field("  Goal", b.goal_target);
        y += 2;
      });
    }

    if (antecedentStrategies.length > 0) {
      section("ANTECEDENT STRATEGIES");
      antecedentStrategies.forEach((s: any) => {
        field(`• ${s.strategy_name}`, s.description);
      });
      y += 4;
    }

    if (consequenceStrategies.length > 0) {
      section("CONSEQUENCE STRATEGIES");
      consequenceStrategies.forEach((s: any) => {
        field(`• ${s.strategy_name}`, s.description);
      });
      y += 4;
    }

    if (replacementBehaviors.length > 0) {
      section("REPLACEMENT BEHAVIORS");
      replacementBehaviors.forEach((r: any) => {
        field(`• ${r.behavior_name}`, r.rationale);
      });
      y += 4;
    }

    if (skillPrograms.length > 0) {
      section("SKILL ACQUISITION PROGRAMS");
      skillPrograms.forEach((p: any) => {
        field(`• ${p.program_name}`, `Domain: ${p.domain} | Criteria: ${p.mastery_criteria}`);
        field("  Objective", p.objective);
        y += 2;
      });
    }

    if (caregiverTraining.length > 0) {
      section("CAREGIVER TRAINING");
      caregiverTraining.forEach((t: any) => {
        field(`• ${t.training_topic}`, `${t.training_method} | ${t.caregiver_name} | ${t.completed ? "Completed" : "Pending"}`);
      });
      y += 4;
    }

    section("SIGNATURES");
    field("BCBA", bip.bcba_signed ? `Signed ${new Date(bip.bcba_signed_at).toLocaleDateString()}` : "Not signed");
    field("Caregiver", bip.caregiver_signed ? `Signed ${new Date(bip.caregiver_signed_at).toLocaleDateString()}` : "Not signed");

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("CONFIDENTIAL — For clinical use only. This document contains Protected Health Information (PHI).", 105, 290, { align: "center" });

    doc.save(`BIP-${client.full_name.replace(/\s/g, "-")}-v${bip.version}.pdf`);
  }

  function daysUntil(date: string | null) {
    if (!date) return null;
    return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  const STATUS_COLORS: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600",
    active: "bg-green-100 text-green-700",
    under_review: "bg-yellow-100 text-yellow-700",
    reauth_pending: "bg-orange-100 text-orange-700",
    expired: "bg-red-100 text-red-700",
  };

  const BIP_SECTIONS = ["Plan Details", "Background", "Functional Behavioral Assessment", "Target Behavior", "Hypothesis", "Crisis", "Curricular Assessments", "Instructional Goals", "Monitoring Outcomes and Action Plans", "Service Recommendations", "Overall Comments"];
  const [showSections, setShowSections] = useState(false);
  const TABS = ["overview", "behaviors", "plan", "training", "reauth", "reviews", "graphs"];

  if (loading) return <div className="p-8 text-gray-400">Loading BIP...</div>;
  if (!bip) return <div className="p-8 text-red-500">BIP not found.</div>;

  const reauthDays = daysUntil(bip.reauth_due_date);
  const planDays = daysUntil(bip.plan_end_date);

  return (
    <div className="space-y-6">
      <PageHeader title={`BIP — ${client?.full_name ?? "Unknown"}`}>
        <div className="flex gap-2 flex-wrap">
          <span className={`text-xs px-3 py-1.5 rounded-full font-medium capitalize ${STATUS_COLORS[bip.status] ?? "bg-gray-100 text-gray-600"}`}>
            {bip.status.replace("_", " ")}
          </span>
          <Button variant="outline" onClick={exportPDF}>📄 Export PDF</Button>
          <Link href={`/dashboard/bip/${bipId}/review`}>
            <Button variant="outline">📋 Quarterly Review</Button>
          </Link>
          <Link href="/dashboard/bip">
            <Button variant="outline">← All BIPs</Button>
          </Link>
        </div>
      </PageHeader>

      {/* ALERTS */}
      {reauthDays !== null && reauthDays <= 30 && reauthDays > 0 && !bip.reauth_submitted && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-sm font-bold text-orange-700">⚠️ Reauthorization due in {reauthDays} days</p>
          <p className="text-xs text-orange-600 mt-1">Submit reauth packet to insurance 2–4 weeks before expiration to prevent service gaps.</p>
          <Button className="mt-3" onClick={markReauthSubmitted}>Mark Reauth Submitted</Button>
        </div>
      )}

      {bip.reauth_submitted && !bip.reauth_approved && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex justify-between items-center">
          <div>
            <p className="text-sm font-bold text-blue-700">🔄 Reauth submitted — awaiting insurance approval</p>
            <p className="text-xs text-blue-600 mt-0.5">Submitted: {bip.reauth_submitted_date}</p>
          </div>
          <Button variant="outline" onClick={markReauthApproved}>Mark Approved</Button>
        </div>
      )}

      {planDays !== null && planDays <= 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-bold text-red-700">🚨 This BIP expired {Math.abs(planDays)} days ago</p>
        </div>
      )}

      {/* STATUS + SIGNATURES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="BIP Status">
          <div className="flex flex-wrap gap-2 mb-3">
            {["draft", "active", "under_review", "reauth_pending", "expired", "discontinued"].map((s) => (
              <button key={s} onClick={() => updateBIPStatus(s)}
                className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${bip.status === s ? `${STATUS_COLORS[s]} border-current` : "border-gray-200 text-gray-600 hover:border-blue-300"}`}>
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <p>Version: {bip.version} | Start: {bip.plan_start_date} | End: {bip.plan_end_date}</p>
            <p>Review: {bip.review_date} | Reauth Due: {bip.reauth_due_date}</p>
            <p>{bip.recommended_hours_per_week}h/week | {bip.recommended_setting}</p>
          </div>
        </Section>

        <Section title="Signatures Required">
          <div className="space-y-3">
            <div className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
              <div>
                <p className="text-sm font-medium text-gray-800">BCBA Signature</p>
                {bip.bcba_signed && <p className="text-xs text-green-600">Signed {new Date(bip.bcba_signed_at).toLocaleDateString()}</p>}
              </div>
              {bip.bcba_signed ? (
                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">✓ Signed</span>
              ) : (
                <Button onClick={signAsBCBA} loading={saving}>Sign as BCBA</Button>
              )}
            </div>
            <div className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
              <div>
                <p className="text-sm font-medium text-gray-800">Caregiver Signature</p>
                {bip.caregiver_signed && <p className="text-xs text-green-600">Signed {new Date(bip.caregiver_signed_at).toLocaleDateString()}</p>}
              </div>
              {bip.caregiver_signed ? (
                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">✓ Signed</span>
              ) : (
                <Button variant="outline" onClick={signAsCaregiver} loading={saving}>Sign as Caregiver</Button>
              )}
            </div>
            {bip.lmn_obtained && (
              <div className="flex items-center justify-between border border-green-100 rounded-lg p-3 bg-green-50">
                <div>
                  <p className="text-sm font-medium text-gray-800">Letter of Medical Necessity</p>
                  <p className="text-xs text-green-600">Dr. {bip.lmn_physician} — {bip.lmn_date}</p>
                </div>
                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">✓ Obtained</span>
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* TABS */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap capitalize transition-colors ${activeTab === tab ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {tab === "behaviors" ? `Behaviors (${behaviors.length})` :
             tab === "plan" ? `Plan (${Math.max(antecedentStrategies.length, consequenceStrategies.length, replacementBehaviors.length, skillPrograms.length, fidelityChecks.length)})` :
             tab === "training" ? `Training (${caregiverTraining.length})` :
             tab === "reviews" ? `Reviews (${reviews.length})` :
             tab.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {bip.medical_necessity_statement && (
            <Section title="Medical Necessity Statement">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{bip.medical_necessity_statement}</p>
            </Section>
          )}
          {bip.client_strengths && (
            <Section title="Client Background">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {bip.client_strengths && <div><p className="font-medium text-gray-700 mb-1">Strengths</p><p className="text-gray-600">{bip.client_strengths}</p></div>}
                {bip.client_preferences && <div><p className="font-medium text-gray-700 mb-1">Preferences & Reinforcers</p><p className="text-gray-600">{bip.client_preferences}</p></div>}
                {bip.learning_history && <div><p className="font-medium text-gray-700 mb-1">Learning History</p><p className="text-gray-600">{bip.learning_history}</p></div>}
                {bip.previous_interventions && <div><p className="font-medium text-gray-700 mb-1">Previous Interventions</p><p className="text-gray-600">{bip.previous_interventions}</p></div>}
              </div>
            </Section>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Target Behaviors", value: behaviors.length, color: "text-red-500" },
              { label: "Skill Programs", value: skillPrograms.length, color: "text-green-600" },
              { label: "Strategies", value: antecedentStrategies.length + consequenceStrategies.length, color: "text-blue-600" },
              { label: "Training Sessions", value: caregiverTraining.filter((t: any) => t.completed).length + "/" + caregiverTraining.length, color: "text-teal-600" },
            ].map((item) => (
              <div key={item.label} className="border rounded-xl p-4 text-center bg-white">
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs text-gray-500 mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BEHAVIORS TAB */}
      {activeTab === "behaviors" && (
        <div className="space-y-3">
          {behaviors.length === 0 && <p className="text-gray-400 text-sm">No target behaviors added.</p>}
          {behaviors.map((b: any) => (
            <div key={b.id} className="border border-gray-100 rounded-xl p-4 bg-white">
              <div className="flex items-center gap-2 mb-3">
                <p className="font-bold text-gray-800">{b.behavior_name}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${b.behavior_type === "reduction" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                  {b.behavior_type}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {b.operational_definition && <div><p className="font-medium text-gray-600 text-xs uppercase tracking-wide mb-1">Operational Definition</p><p className="text-gray-700">{b.operational_definition}</p></div>}
                {b.function_of_behavior && <div><p className="font-medium text-gray-600 text-xs uppercase tracking-wide mb-1">Function</p><p className="text-gray-700">{b.function_of_behavior}</p></div>}
                {b.baseline_rate && <div><p className="font-medium text-gray-600 text-xs uppercase tracking-wide mb-1">Baseline</p><p className="text-gray-700">{b.baseline_rate}</p></div>}
                {b.goal_target && <div><p className="font-medium text-gray-600 text-xs uppercase tracking-wide mb-1">Goal Target</p><p className="text-gray-700">{b.goal_target}</p></div>}
                {b.measurement_method && <div><p className="font-medium text-gray-600 text-xs uppercase tracking-wide mb-1">Measurement</p><p className="text-gray-700">{b.measurement_method}</p></div>}
                {b.topography && <div><p className="font-medium text-gray-600 text-xs uppercase tracking-wide mb-1">Topography</p><p className="text-gray-700">{b.topography}</p></div>}
              </div>
            </div>
          ))}

          {/* REPLACEMENT BEHAVIORS */}
          {replacementBehaviors.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Replacement Behaviors</p>
              {replacementBehaviors.map((r: any) => (
                <div key={r.id} className="border border-green-100 rounded-xl p-4 bg-green-50 mb-2">
                  <p className="font-semibold text-green-800">{r.behavior_name}</p>
                  {r.rationale && <p className="text-xs text-green-700 mt-1"><span className="font-medium">Rationale:</span> {r.rationale}</p>}
                  {r.teaching_strategy && <p className="text-xs text-green-700 mt-0.5"><span className="font-medium">Teaching:</span> {r.teaching_strategy}</p>}
                  {r.reinforcement_schedule && <p className="text-xs text-green-700 mt-0.5"><span className="font-medium">Reinforcement:</span> {r.reinforcement_schedule}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STRATEGIES TAB */}
      {/* PLAN TAB - Antecedent, Consequence, Replacement, Program, Fidelity grouped by item number */}
      {activeTab === "plan" && (
        <div className="space-y-6">
          {Array.from({ length: Math.max(antecedentStrategies.length, consequenceStrategies.length, replacementBehaviors.length, skillPrograms.length, fidelityChecks.length) }).map((_, i) => {
            const a: any = antecedentStrategies[i];
            const c: any = consequenceStrategies[i];
            const r: any = replacementBehaviors[i];
            const p: any = skillPrograms[i];
            const f: any = fidelityChecks[i];
            if (!a && !c && !r && !p && !f) return null;
            return (
              <div key={i} className="border border-gray-200 rounded-2xl p-4 bg-gray-50">
                <p className="text-sm font-bold text-gray-800 mb-3">Item {i + 1}</p>
                <div className="space-y-3">
                  {a && (
                    <div className="border border-blue-100 rounded-xl p-4 bg-blue-50">
                      <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1">Antecedent Strategy</p>
                      <p className="font-semibold text-blue-800">{a.strategy_name}</p>
                      {a.strategy_type && <span className="text-xs px-2 py-0.5 bg-blue-200 text-blue-700 rounded-full">{a.strategy_type}</span>}
                      {a.description && <p className="text-sm text-blue-700 mt-2">{a.description}</p>}
                      {a.implementation_steps && <p className="text-xs text-blue-600 mt-1"><span className="font-medium">Steps:</span> {a.implementation_steps}</p>}
                    </div>
                  )}
                  {c && (
                    <div className="border border-purple-100 rounded-xl p-4 bg-purple-50">
                      <p className="text-xs font-semibold text-purple-800 uppercase tracking-wide mb-1">Consequence Strategy</p>
                      <p className="font-semibold text-purple-800">{c.strategy_name}</p>
                      {c.strategy_type && <span className="text-xs px-2 py-0.5 bg-purple-200 text-purple-700 rounded-full">{c.strategy_type}</span>}
                      {c.description && <p className="text-sm text-purple-700 mt-2">{c.description}</p>}
                      {c.reinforcers_used && <p className="text-xs text-purple-600 mt-1"><span className="font-medium">Reinforcers:</span> {c.reinforcers_used}</p>}
                      {c.implementation_steps && <p className="text-xs text-purple-600 mt-1"><span className="font-medium">Steps:</span> {c.implementation_steps}</p>}
                    </div>
                  )}
                  {r && (
                    <div className="border border-teal-100 rounded-xl p-4 bg-teal-50">
                      <p className="text-xs font-semibold text-teal-800 uppercase tracking-wide mb-1">Replacement Behavior</p>
                      <p className="font-semibold text-teal-800">{r.behavior_name}</p>
                      {r.reinforcement_schedule && <p className="text-xs text-teal-600 mt-1"><span className="font-medium">Reinforcement Schedule:</span> {r.reinforcement_schedule}</p>}
                      {r.rationale && <p className="text-sm text-teal-700 mt-2"><span className="font-medium">Rationale:</span> {r.rationale}</p>}
                      {r.teaching_strategy && <p className="text-xs text-teal-600 mt-1"><span className="font-medium">Teaching Strategy:</span> {r.teaching_strategy}</p>}
                    </div>
                  )}
                  {p && (
                    <div className="border border-green-100 rounded-xl p-4 bg-white">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-xs font-semibold text-green-800 uppercase tracking-wide">Skill Program</p>
                        {p.domain && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">{p.domain}</span>}
                        {p.prompt_level && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{p.prompt_level}</span>}
                      </div>
                      <p className="font-bold text-gray-800">{p.program_name}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mt-2">
                        {p.objective && <div className="md:col-span-2"><p className="font-medium text-gray-600 text-xs uppercase tracking-wide mb-1">Objective</p><p className="text-gray-700">{p.objective}</p></div>}
                        {p.teaching_procedure && <div><p className="font-medium text-gray-600 text-xs uppercase tracking-wide mb-1">Teaching Procedure</p><p className="text-gray-700">{p.teaching_procedure}</p></div>}
                        {p.mastery_criteria && <div><p className="font-medium text-gray-600 text-xs uppercase tracking-wide mb-1">Mastery Criteria</p><p className="text-gray-700">{p.mastery_criteria}</p></div>}
                        {p.baseline_performance && <div><p className="font-medium text-gray-600 text-xs uppercase tracking-wide mb-1">Baseline</p><p className="text-gray-700">{p.baseline_performance}</p></div>}
                        {p.materials && <div><p className="font-medium text-gray-600 text-xs uppercase tracking-wide mb-1">Materials</p><p className="text-gray-700">{p.materials}</p></div>}
                        {p.generalization_plan && <div><p className="font-medium text-gray-600 text-xs uppercase tracking-wide mb-1">Generalization Plan</p><p className="text-gray-700">{p.generalization_plan}</p></div>}
                      </div>
                    </div>
                  )}
                  {f && (
                    <div className="border border-yellow-100 rounded-xl p-4 bg-yellow-50">
                      <p className="text-xs font-semibold text-yellow-800 uppercase tracking-wide mb-1">Treatment Fidelity Check</p>
                      <div className="flex items-center gap-2 mb-1">
                        {f.check_date && <span className="text-xs text-yellow-700">{f.check_date}</span>}
                        {f.fidelity_percentage && <span className="text-xs px-2 py-0.5 bg-yellow-200 text-yellow-800 rounded-full">{f.fidelity_percentage}%</span>}
                      </div>
                      {f.conducted_by && <p className="text-xs text-yellow-700"><span className="font-medium">Conducted By:</span> {f.conducted_by} {f.role ? `(${f.role})` : ""}</p>}
                      {f.components_observed && <p className="text-sm text-yellow-700 mt-2"><span className="font-medium">Components Observed:</span> {f.components_observed}</p>}
                      {f.areas_of_concern && <p className="text-xs text-yellow-700 mt-1"><span className="font-medium">Areas of Concern:</span> {f.areas_of_concern}</p>}
                      {f.follow_up_plan && <p className="text-xs text-yellow-700 mt-1"><span className="font-medium">Follow-up Plan:</span> {f.follow_up_plan}</p>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {antecedentStrategies.length === 0 && consequenceStrategies.length === 0 && replacementBehaviors.length === 0 && skillPrograms.length === 0 && fidelityChecks.length === 0 && (
            <p className="text-gray-400 text-sm">No plan items added yet.</p>
          )}
        </div>
      )}

      {/* TRAINING TAB */}
      {activeTab === "training" && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
            {caregiverTraining.filter((t: any) => t.completed).length}/{caregiverTraining.length} training sessions completed
          </div>
          {caregiverTraining.length === 0 && <p className="text-gray-400 text-sm">No caregiver training added.</p>}
          {caregiverTraining.map((t: any) => (
            <div key={t.id} className={`border rounded-xl p-4 bg-white ${t.completed ? "border-green-200" : "border-gray-100"}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-gray-800">{t.training_topic}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t.training_method} · {t.caregiver_name && `Caregiver: ${t.caregiver_name}`}
                    {t.trainer_name && ` · Trainer: ${t.trainer_name}`}
                    {t.completion_date && ` · ${t.completion_date}`}
                  </p>
                  {t.notes && <p className="text-xs text-gray-500 mt-1">{t.notes}</p>}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${t.completed ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                  {t.completed ? "✓ Done" : "Pending"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* REAUTH TAB */}
      {activeTab === "reauth" && (
        <div className="space-y-4">
          <Section title="Reauthorization Status">
            <div className="space-y-3">
              {[
                { label: "Reauth Due Date", value: bip.reauth_due_date ?? "Not set", urgent: reauthDays !== null && reauthDays <= 30 },
                { label: "Submitted to Insurance", value: bip.reauth_submitted ? `Yes — ${bip.reauth_submitted_date}` : "Not yet submitted", urgent: !bip.reauth_submitted },
                { label: "Insurance Decision", value: bip.reauth_approved ? "✓ Approved" : bip.reauth_submitted ? "Pending" : "Not submitted", urgent: false },
              ].map((item) => (
                <div key={item.label} className={`flex justify-between border rounded-lg p-3 text-sm ${item.urgent ? "border-orange-200 bg-orange-50" : "border-gray-100 bg-white"}`}>
                  <span className={`font-medium ${item.urgent ? "text-orange-700" : "text-gray-700"}`}>{item.label}</span>
                  <span className={item.urgent ? "text-orange-600" : "text-gray-600"}>{item.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              {!bip.reauth_submitted && <Button onClick={markReauthSubmitted}>Mark Reauth Submitted</Button>}
              {bip.reauth_submitted && !bip.reauth_approved && <Button onClick={markReauthApproved} variant="outline">Mark Reauth Approved</Button>}
            </div>
          </Section>

          <Section title="📋 Reauth Packet Checklist">
            <p className="text-xs text-gray-500 mb-3">Submit to insurance 2–4 weeks before authorization expiration per BACB and payer requirements</p>
            <div className="space-y-2">
              {[
                { item: "Updated progress data with graphs", done: behaviors.length > 0 },
                { item: "BIP modifications documented (this BIP)", done: bip.status !== "draft" },
                { item: "Medical necessity statement", done: !!bip.medical_necessity_statement },
                { item: "Letter of Medical Necessity (physician-signed)", done: bip.lmn_obtained },
                { item: "Current ICD-10 diagnosis code", done: !!bip.diagnosis_code },
                { item: "Caregiver training documentation", done: caregiverTraining.some((t: any) => t.completed) },
                { item: "BCBA signature on BIP", done: bip.bcba_signed },
                { item: "Caregiver signature on BIP", done: bip.caregiver_signed },
                { item: "Updated assessment results", done: !!bip.assessment_date },
                { item: "Submitted to insurance portal or clearinghouse", done: bip.reauth_submitted },
              ].map((item, i) => (
                <div key={i} className={`flex items-center gap-3 border rounded-lg p-3 text-sm ${item.done ? "border-green-200 bg-green-50" : "border-gray-100 bg-white"}`}>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${item.done ? "bg-green-500 border-green-500 text-white" : "border-gray-300"}`}>
                    {item.done && "✓"}
                  </div>
                  <span className={item.done ? "text-green-700 line-through" : "text-gray-700"}>{item.item}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-gray-400">
              {[
                { item: "Updated progress data with graphs", done: behaviors.length > 0 },
                { item: "BIP modifications documented (this BIP)", done: bip.status !== "draft" },
                { item: "Medical necessity statement", done: !!bip.medical_necessity_statement },
                { item: "Letter of Medical Necessity (physician-signed)", done: bip.lmn_obtained },
                { item: "Current ICD-10 diagnosis code", done: !!bip.diagnosis_code },
                { item: "Caregiver training documentation", done: caregiverTraining.some((t: any) => t.completed) },
                { item: "BCBA signature on BIP", done: bip.bcba_signed },
                { item: "Caregiver signature on BIP", done: bip.caregiver_signed },
                { item: "Updated assessment results", done: !!bip.assessment_date },
                { item: "Submitted to insurance portal or clearinghouse", done: bip.reauth_submitted },
              ].filter((i) => i.done).length} / 10 items complete
            </div>
          </Section>

          {bip.reauth_notes && (
            <Section title="Reauth Notes">
              <p className="text-sm text-gray-700">{bip.reauth_notes}</p>
            </Section>
          )}
        </div>
      )}

      {/* REVIEWS TAB */}
      {/* GRAPHS TAB */}
{activeTab === "graphs" && (
  <GraphsTab bipId={bipId} clientId={bip?.client_id} />
)}
      {activeTab === "reviews" && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{reviews.length} review{reviews.length !== 1 ? "s" : ""} on record</p>
            <Link href={`/dashboard/bip/${bipId}/review`}>
              <Button>+ New Review</Button>
            </Link>
          </div>
          {reviews.length === 0 && <p className="text-gray-400 text-sm">No quarterly reviews yet. Reviews are required for insurance reauthorization.</p>}
          {reviews.map((r: any) => (
            <div key={r.id} className="border border-gray-100 rounded-xl p-4 bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-gray-800">{r.review_date} — {r.review_type} Review</p>
                  <p className="text-xs text-gray-400 mt-0.5">{r.hours_recommended}h/week recommended</p>
                  {r.summary && <p className="text-sm text-gray-600 mt-2">{r.summary}</p>}
                  {r.modifications_made && <p className="text-xs text-blue-600 mt-1">Modifications: {r.modifications_made}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === "final" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                  {r.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}