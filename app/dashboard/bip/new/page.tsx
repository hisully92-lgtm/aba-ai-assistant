"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { useRouter } from "next/navigation";

type Client = { id: string; full_name: string; diagnosis: string | null };
type Profile = { id: string; full_name: string | null; role: string | null };

const ICD10_OPTIONS = [
  "F84.0 — Autistic Disorder",
  "F84.5 — Asperger Syndrome",
  "F84.9 — PDD, Unspecified",
  "F70 — Mild Intellectual Disability",
  "F71 — Moderate Intellectual Disability",
  "F90.2 — ADHD Combined Presentation",
  "F91.3 — Oppositional Defiant Disorder",
  "F94.0 — Selective Mutism",
];

const SETTINGS = ["Home", "Clinic", "School", "Community", "Telehealth", "Multiple Settings"];
const FUNCTIONS = ["Access to tangibles", "Escape/Avoidance", "Attention", "Sensory/Automatic", "Unknown — FBA needed"];
const MEASUREMENT_METHODS = ["Frequency", "Rate", "Duration", "Latency", "Interval Recording", "Permanent Product", "ABC Data"];
const PROMPT_LEVELS = ["Full Physical", "Partial Physical", "Model", "Gesture", "Positional", "Vocal", "Independent"];
const DOMAINS = ["Communication", "Social Skills", "Daily Living", "Academic", "Motor", "Behavior Reduction", "Vocational", "Play"];
const STRATEGY_TYPES_ANTECEDENT = ["Environmental modification", "Predictability/Schedule", "Demand modification", "Pre-teaching", "Priming", "Choice provision", "Sensory accommodation", "Escape extinction"];
const STRATEGY_TYPES_CONSEQUENCE = ["Differential reinforcement (DRA)", "Differential reinforcement (DRI)", "Extinction", "Planned ignoring", "Redirection", "Token economy", "Response cost", "Time-out from reinforcement", "Noncontingent reinforcement (NCR)"];
const TRAINING_TOPICS = ["BST — Reinforcement strategies", "BST — Data collection", "BST — BIP implementation", "BST — Crisis procedures", "Home program implementation", "Caregiver feedback session", "Video review", "Role play practice", "Written instructions review"];

export default function NewBIPPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const TOTAL_STEPS = 8;

  // Step 1 — Basic Info
  const [clientId, setClientId] = useState("");
  const [bcbaId, setBcbaId] = useState("");
  const [diagnosisCode, setDiagnosisCode] = useState("");
  const [assessmentDate, setAssessmentDate] = useState("");
  const [planStartDate, setPlanStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [planEndDate, setPlanEndDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 6); return d.toISOString().split("T")[0];
  });
  const [reviewDate, setReviewDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 3); return d.toISOString().split("T")[0];
  });
  const [reauthDueDate, setReauthDueDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 5); return d.toISOString().split("T")[0];
  });
  const [recommendedHours, setRecommendedHours] = useState(20);
  const [recommendedSetting, setRecommendedSetting] = useState("Home");

  // Step 2 — Background
  const [clientStrengths, setClientStrengths] = useState("");
  const [clientPreferences, setClientPreferences] = useState("");
  const [learningHistory, setLearningHistory] = useState("");
  const [previousInterventions, setPreviousInterventions] = useState("");

  // Step 3 — Medical Necessity
  const [medicalNecessity, setMedicalNecessity] = useState("");
  const [lmnObtained, setLmnObtained] = useState(false);
  const [lmnPhysician, setLmnPhysician] = useState("");
  const [lmnDate, setLmnDate] = useState("");

  // Step 4 — Target Behaviors
  const [targetBehaviors, setTargetBehaviors] = useState([{
    behavior_name: "", behavior_type: "reduction", operational_definition: "",
    topography: "", function_of_behavior: "", baseline_rate: "",
    measurement_method: "Frequency", goal_target: "",
    antecedents: [] as string[], consequences: [] as string[], priority: 1,
  }]);

  // Step 5 — Antecedent Strategies
  const [antecedentStrategies, setAntecedentStrategies] = useState([{
    strategy_name: "", strategy_type: "", description: "", implementation_steps: "",
  }]);

  // Step 6 — Consequence Strategies + Replacement Behaviors
  const [consequenceStrategies, setConsequenceStrategies] = useState([{
    strategy_name: "", strategy_type: "", description: "", implementation_steps: "", reinforcers_used: "",
  }]);
  const [replacementBehaviors, setReplacementBehaviors] = useState([{
    behavior_name: "", rationale: "", teaching_strategy: "", reinforcement_schedule: "",
  }]);

  // Step 7 — Skill Programs
  const [skillPrograms, setSkillPrograms] = useState([{
    program_name: "", domain: "", objective: "", teaching_procedure: "",
    prompt_level: "Gesture", mastery_criteria: "80% over 3 consecutive sessions",
    materials: "", generalization_plan: "", maintenance_plan: "", baseline_performance: "",
  }]);

  // Step 8 — Caregiver Training
  const [caregiverTraining, setCaregiverTraining] = useState([{
    training_topic: "", training_method: "BST", caregiver_name: "", trainer_name: "",
    completion_date: "", completed: false, notes: "",
  }]);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: profileData }] = await Promise.all([
      supabase.from("clients").select("id, full_name, diagnosis"),
      supabase.from("profiles").select("id, full_name, role"),
    ]);

    setClients(clientData ?? []);
    setProfiles(profileData ?? []);
    setBcbaId(user.id);
  }

  function addItem<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, template: T) {
    setter((prev) => [...prev, { ...template }]);
  }

  function removeItem<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, index: number) {
    setter((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, index: number, field: string, value: any) {
    setter((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  async function handleSave() {
    if (!clientId) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    // Create main BIP
    const { data: bip, error } = await supabase.from("behavior_intervention_plans").insert([{
      client_id: clientId,
      bcba_id: bcbaId || user.id,
      diagnosis_code: diagnosisCode.split(" — ")[0] || null,
      diagnosis_description: diagnosisCode.split(" — ")[1] || null,
      assessment_date: assessmentDate || null,
      plan_start_date: planStartDate || null,
      plan_end_date: planEndDate || null,
      review_date: reviewDate || null,
      reauth_due_date: reauthDueDate || null,
      recommended_hours_per_week: recommendedHours,
      recommended_setting: recommendedSetting,
      medical_necessity_statement: medicalNecessity || null,
      lmn_obtained: lmnObtained,
      lmn_physician: lmnPhysician || null,
      lmn_date: lmnDate || null,
      client_strengths: clientStrengths || null,
      client_preferences: clientPreferences || null,
      learning_history: learningHistory || null,
      previous_interventions: previousInterventions || null,
      status: "draft",
      version: 1,
      created_by: user.id,
    }]).select().single();

    if (error || !bip) { setSaving(false); return; }

    // Insert all related records in parallel
    await Promise.all([
      targetBehaviors.filter((b) => b.behavior_name).length > 0 &&
        supabase.from("bip_target_behaviors").insert(
          targetBehaviors.filter((b) => b.behavior_name).map((b) => ({
            ...b, bip_id: bip.id, antecedents: JSON.stringify(b.antecedents),
            consequences: JSON.stringify(b.consequences), created_by: user.id,
          }))
        ),
      antecedentStrategies.filter((s) => s.strategy_name).length > 0 &&
        supabase.from("bip_antecedent_strategies").insert(
          antecedentStrategies.filter((s) => s.strategy_name).map((s) => ({
            ...s, bip_id: bip.id, created_by: user.id,
          }))
        ),
      consequenceStrategies.filter((s) => s.strategy_name).length > 0 &&
        supabase.from("bip_consequence_strategies").insert(
          consequenceStrategies.filter((s) => s.strategy_name).map((s) => ({
            ...s, bip_id: bip.id, created_by: user.id,
          }))
        ),
      replacementBehaviors.filter((r) => r.behavior_name).length > 0 &&
        supabase.from("bip_replacement_behaviors").insert(
          replacementBehaviors.filter((r) => r.behavior_name).map((r) => ({
            ...r, bip_id: bip.id, created_by: user.id,
          }))
        ),
      skillPrograms.filter((p) => p.program_name).length > 0 &&
        supabase.from("bip_skill_programs").insert(
          skillPrograms.filter((p) => p.program_name).map((p) => ({
            ...p, bip_id: bip.id, created_by: user.id,
          }))
        ),
      caregiverTraining.filter((t) => t.training_topic).length > 0 &&
        supabase.from("bip_caregiver_training").insert(
          caregiverTraining.filter((t) => t.training_topic).map((t) => ({
            ...t, bip_id: bip.id, created_by: user.id,
          }))
        ),
    ]);

    setSaving(false);
    router.push(`/dashboard/bip/${bip.id}`);
  }

  const STEPS = [
    "Basic Info", "Background", "Medical Necessity",
    "Target Behaviors", "Antecedent Strategies",
    "Consequence Strategies", "Skill Programs", "Caregiver Training",
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="New Behavior Intervention Plan">
        <p className="text-gray-500 text-sm">Step {currentStep} of {TOTAL_STEPS}</p>
      </PageHeader>

      {/* STEP INDICATOR */}
      <div className="flex gap-1 overflow-x-auto">
        {STEPS.map((step, i) => (
          <button key={i} onClick={() => setCurrentStep(i + 1)}
            className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${currentStep === i + 1 ? "bg-blue-600 text-white" : i + 1 < currentStep ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {i + 1 < currentStep ? "✓ " : ""}{step}
          </button>
        ))}
      </div>

      {/* STEP 1 — BASIC INFO */}
      {currentStep === 1 && (
        <Section title="Basic Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Supervising BCBA</label>
              <select value={bcbaId} onChange={(e) => setBcbaId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                {profiles.filter((p) => ["supervisor", "admin", "clinician", "developer"].includes(p.role ?? "")).map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Diagnosis Code (ICD-10)</label>
              <select value={diagnosisCode} onChange={(e) => setDiagnosisCode(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select diagnosis...</option>
                {ICD10_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Assessment Date</label>
              <input type="date" value={assessmentDate} onChange={(e) => setAssessmentDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Plan Start Date</label>
              <input type="date" value={planStartDate} onChange={(e) => setPlanStartDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Plan End Date</label>
              <input type="date" value={planEndDate} onChange={(e) => setPlanEndDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Quarterly Review Date</label>
              <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Reauth Due Date</label>
              <input type="date" value={reauthDueDate} onChange={(e) => setReauthDueDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Recommended Hours/Week</label>
              <input type="number" min={1} max={40} value={recommendedHours} onChange={(e) => setRecommendedHours(parseInt(e.target.value) || 0)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Recommended Setting</label>
              <select value={recommendedSetting} onChange={(e) => setRecommendedSetting(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                {SETTINGS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </Section>
      )}

      {/* STEP 2 — BACKGROUND */}
      {currentStep === 2 && (
        <Section title="Client Background">
          <div className="space-y-4">
            {[
              { label: "Client Strengths", value: clientStrengths, setter: setClientStrengths, placeholder: "Describe the client's strengths, motivators, and positive attributes..." },
              { label: "Client Preferences & Reinforcers", value: clientPreferences, setter: setClientPreferences, placeholder: "Preferred items, activities, people, and reinforcers..." },
              { label: "Learning History", value: learningHistory, setter: setLearningHistory, placeholder: "Previous ABA services, response to interventions, progress made..." },
              { label: "Previous Interventions", value: previousInterventions, setter: setPreviousInterventions, placeholder: "Interventions previously tried, outcomes, what has/hasn't worked..." },
            ].map((field) => (
              <div key={field.label}>
                <label className="text-sm font-medium text-gray-700 mb-1 block">{field.label}</label>
                <textarea value={field.value} onChange={(e) => field.setter(e.target.value)}
                  placeholder={field.placeholder} rows={4}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* STEP 3 — MEDICAL NECESSITY */}
      {currentStep === 3 && (
        <Section title="Medical Necessity">
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700 space-y-1">
              <p className="font-bold">Insurance Requirement — Medical Necessity Statement</p>
              <p>Must justify why ABA therapy is medically necessary, including the client's diagnosis, functional impairments, and how ABA will address them. Required for initial authorization and every reauthorization.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Medical Necessity Statement *</label>
              <textarea value={medicalNecessity} onChange={(e) => setMedicalNecessity(e.target.value)}
                placeholder="[Client name] is a [age]-year-old individual diagnosed with [diagnosis] who presents with significant deficits in [areas]. ABA therapy is medically necessary to address [specific behaviors/deficits] that significantly impact [daily functioning, safety, communication, etc.]. Without intensive ABA intervention, [client] is at risk for [outcomes]. The recommended [X] hours per week of ABA therapy will target [specific goals] to improve [functional outcomes]..."
                rows={8} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="border border-gray-100 rounded-xl p-4 space-y-4">
              <p className="text-sm font-semibold text-gray-700">Letter of Medical Necessity (LMN)</p>
              <div className="flex items-center gap-3">
                <button onClick={() => setLmnObtained(!lmnObtained)}
                  className={`w-12 h-6 rounded-full transition-all relative ${lmnObtained ? "bg-green-500" : "bg-gray-300"}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${lmnObtained ? "left-7" : "left-1"}`} />
                </button>
                <span className="text-sm text-gray-700">{lmnObtained ? "LMN obtained" : "LMN not yet obtained"}</span>
              </div>
              {lmnObtained && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Physician Name</label>
                    <input type="text" value={lmnPhysician} onChange={(e) => setLmnPhysician(e.target.value)}
                      placeholder="Signing physician name"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">LMN Date</label>
                    <input type="date" value={lmnDate} onChange={(e) => setLmnDate(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* STEP 4 — TARGET BEHAVIORS */}
      {currentStep === 4 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800">Target Behaviors</h2>
            <Button variant="outline" onClick={() => addItem(setTargetBehaviors, {
              behavior_name: "", behavior_type: "reduction", operational_definition: "",
              topography: "", function_of_behavior: "", baseline_rate: "",
              measurement_method: "Frequency", goal_target: "", antecedents: [], consequences: [], priority: targetBehaviors.length + 1,
            })}>+ Add Behavior</Button>
          </div>
          {targetBehaviors.map((behavior, i) => (
            <Section key={i} title={`Behavior ${i + 1}${behavior.behavior_name ? ` — ${behavior.behavior_name}` : ""}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Behavior Name *</label>
                  <input type="text" value={behavior.behavior_name}
                    onChange={(e) => updateItem(setTargetBehaviors, i, "behavior_name", e.target.value)}
                    placeholder="e.g. Aggression, Elopement, Hand-flapping"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Behavior Type</label>
                  <select value={behavior.behavior_type}
                    onChange={(e) => updateItem(setTargetBehaviors, i, "behavior_type", e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="reduction">Behavior Reduction</option>
                    <option value="acquisition">Skill Acquisition</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Operational Definition *</label>
                  <textarea value={behavior.operational_definition}
                    onChange={(e) => updateItem(setTargetBehaviors, i, "operational_definition", e.target.value)}
                    placeholder="Define the behavior in observable, measurable terms. Include what it looks like (topography), what counts as an instance, and what does NOT count..."
                    rows={3} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Topography</label>
                  <input type="text" value={behavior.topography}
                    onChange={(e) => updateItem(setTargetBehaviors, i, "topography", e.target.value)}
                    placeholder="Physical form the behavior takes"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Function of Behavior</label>
                  <select value={behavior.function_of_behavior}
                    onChange={(e) => updateItem(setTargetBehaviors, i, "function_of_behavior", e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="">Select function...</option>
                    {FUNCTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Baseline Rate</label>
                  <input type="text" value={behavior.baseline_rate}
                    onChange={(e) => updateItem(setTargetBehaviors, i, "baseline_rate", e.target.value)}
                    placeholder="e.g. 4x/hour, 15 min/session"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Measurement Method</label>
                  <select value={behavior.measurement_method}
                    onChange={(e) => updateItem(setTargetBehaviors, i, "measurement_method", e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    {MEASUREMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Goal Target</label>
                  <input type="text" value={behavior.goal_target}
                    onChange={(e) => updateItem(setTargetBehaviors, i, "goal_target", e.target.value)}
                    placeholder="e.g. 0x/week for 4 consecutive weeks"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>
              {targetBehaviors.length > 1 && (
                <button onClick={() => removeItem(setTargetBehaviors, i)} className="mt-3 text-xs text-red-400 hover:text-red-600">
                  Remove this behavior
                </button>
              )}
            </Section>
          ))}
        </div>
      )}

      {/* STEP 5 — ANTECEDENT STRATEGIES */}
      {currentStep === 5 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Antecedent Strategies</h2>
              <p className="text-xs text-gray-500 mt-0.5">Proactive strategies to prevent or reduce problem behaviors before they occur</p>
            </div>
            <Button variant="outline" onClick={() => addItem(setAntecedentStrategies, {
              strategy_name: "", strategy_type: "", description: "", implementation_steps: "",
            })}>+ Add Strategy</Button>
          </div>
          {antecedentStrategies.map((strategy, i) => (
            <Section key={i} title={`Antecedent Strategy ${i + 1}${strategy.strategy_name ? ` — ${strategy.strategy_name}` : ""}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Strategy Name *</label>
                  <input type="text" value={strategy.strategy_name}
                    onChange={(e) => updateItem(setAntecedentStrategies, i, "strategy_name", e.target.value)}
                    placeholder="e.g. Visual schedule, Demand fading"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Strategy Type</label>
                  <select value={strategy.strategy_type}
                    onChange={(e) => updateItem(setAntecedentStrategies, i, "strategy_type", e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="">Select type...</option>
                    {STRATEGY_TYPES_ANTECEDENT.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                  <textarea value={strategy.description}
                    onChange={(e) => updateItem(setAntecedentStrategies, i, "description", e.target.value)}
                    placeholder="Describe the strategy and its rationale..." rows={3}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Implementation Steps</label>
                  <textarea value={strategy.implementation_steps}
                    onChange={(e) => updateItem(setAntecedentStrategies, i, "implementation_steps", e.target.value)}
                    placeholder="Step-by-step instructions for implementing this strategy..." rows={3}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>
              {antecedentStrategies.length > 1 && (
                <button onClick={() => removeItem(setAntecedentStrategies, i)} className="mt-3 text-xs text-red-400 hover:text-red-600">
                  Remove this strategy
                </button>
              )}
            </Section>
          ))}
        </div>
      )}

      {/* STEP 6 — CONSEQUENCE STRATEGIES + REPLACEMENT BEHAVIORS */}
      {currentStep === 6 && (
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Consequence Strategies</h2>
                <p className="text-xs text-gray-500 mt-0.5">Reactive strategies to respond to behaviors after they occur</p>
              </div>
              <Button variant="outline" onClick={() => addItem(setConsequenceStrategies, {
                strategy_name: "", strategy_type: "", description: "", implementation_steps: "", reinforcers_used: "",
              })}>+ Add Strategy</Button>
            </div>
            {consequenceStrategies.map((strategy, i) => (
              <Section key={i} title={`Consequence Strategy ${i + 1}${strategy.strategy_name ? ` — ${strategy.strategy_name}` : ""}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Strategy Name *</label>
                    <input type="text" value={strategy.strategy_name}
                      onChange={(e) => updateItem(setConsequenceStrategies, i, "strategy_name", e.target.value)}
                      placeholder="e.g. DRA, Extinction, NCR"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Strategy Type</label>
                    <select value={strategy.strategy_type}
                      onChange={(e) => updateItem(setConsequenceStrategies, i, "strategy_type", e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                      <option value="">Select type...</option>
                      {STRATEGY_TYPES_CONSEQUENCE.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Reinforcers Used</label>
                    <input type="text" value={strategy.reinforcers_used}
                      onChange={(e) => updateItem(setConsequenceStrategies, i, "reinforcers_used", e.target.value)}
                      placeholder="e.g. iPad access, verbal praise, tokens"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Implementation Steps</label>
                    <textarea value={strategy.implementation_steps}
                      onChange={(e) => updateItem(setConsequenceStrategies, i, "implementation_steps", e.target.value)}
                      placeholder="Step-by-step instructions..." rows={3}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                </div>
                {consequenceStrategies.length > 1 && (
                  <button onClick={() => removeItem(setConsequenceStrategies, i)} className="mt-3 text-xs text-red-400 hover:text-red-600">
                    Remove this strategy
                  </button>
                )}
              </Section>
            ))}
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Replacement Behaviors</h2>
                <p className="text-xs text-gray-500 mt-0.5">Functionally equivalent replacement behaviors to teach instead of problem behaviors</p>
              </div>
              <Button variant="outline" onClick={() => addItem(setReplacementBehaviors, {
                behavior_name: "", rationale: "", teaching_strategy: "", reinforcement_schedule: "",
              })}>+ Add Replacement</Button>
            </div>
            {replacementBehaviors.map((rb, i) => (
              <Section key={i} title={`Replacement Behavior ${i + 1}${rb.behavior_name ? ` — ${rb.behavior_name}` : ""}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Replacement Behavior *</label>
                    <input type="text" value={rb.behavior_name}
                      onChange={(e) => updateItem(setReplacementBehaviors, i, "behavior_name", e.target.value)}
                      placeholder="e.g. Requesting a break using PECS, Tapping shoulder instead of hitting"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Reinforcement Schedule</label>
                    <input type="text" value={rb.reinforcement_schedule}
                      onChange={(e) => updateItem(setReplacementBehaviors, i, "reinforcement_schedule", e.target.value)}
                      placeholder="e.g. CRF initially, then VR-3"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Rationale</label>
                    <textarea value={rb.rationale}
                      onChange={(e) => updateItem(setReplacementBehaviors, i, "rationale", e.target.value)}
                      placeholder="Why this replacement behavior serves the same function..." rows={2}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Teaching Strategy</label>
                    <textarea value={rb.teaching_strategy}
                      onChange={(e) => updateItem(setReplacementBehaviors, i, "teaching_strategy", e.target.value)}
                      placeholder="How this replacement behavior will be taught..." rows={2}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                </div>
                {replacementBehaviors.length > 1 && (
                  <button onClick={() => removeItem(setReplacementBehaviors, i)} className="mt-3 text-xs text-red-400 hover:text-red-600">
                    Remove this replacement behavior
                  </button>
                )}
              </Section>
            ))}
          </div>
        </div>
      )}

      {/* STEP 7 — SKILL PROGRAMS */}
      {currentStep === 7 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Skill Acquisition Programs</h2>
              <p className="text-xs text-gray-500 mt-0.5">Programs to teach new skills across developmental domains</p>
            </div>
            <Button variant="outline" onClick={() => addItem(setSkillPrograms, {
              program_name: "", domain: "", objective: "", teaching_procedure: "",
              prompt_level: "Gesture", mastery_criteria: "80% over 3 consecutive sessions",
              materials: "", generalization_plan: "", maintenance_plan: "", baseline_performance: "",
            })}>+ Add Program</Button>
          </div>
          {skillPrograms.map((program, i) => (
            <Section key={i} title={`Program ${i + 1}${program.program_name ? ` — ${program.program_name}` : ""}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Program Name *</label>
                  <input type="text" value={program.program_name}
                    onChange={(e) => updateItem(setSkillPrograms, i, "program_name", e.target.value)}
                    placeholder="e.g. Requesting preferred items, Matching colors"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Domain</label>
                  <select value={program.domain}
                    onChange={(e) => updateItem(setSkillPrograms, i, "domain", e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="">Select domain...</option>
                    {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Objective</label>
                  <textarea value={program.objective}
                    onChange={(e) => updateItem(setSkillPrograms, i, "objective", e.target.value)}
                    placeholder="Given [SD], client will [behavior] with [criteria] across [settings/people]..."
                    rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Teaching Procedure</label>
                  <select value={program.teaching_procedure}
                    onChange={(e) => updateItem(setSkillPrograms, i, "teaching_procedure", e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="">Select procedure...</option>
                    {["DTT — Discrete Trial Teaching", "NET — Natural Environment Teaching", "Task Analysis", "PECS", "FCT — Functional Communication Training", "PRT — Pivotal Response Training", "Video Modeling", "Social Stories", "Chaining (forward)", "Chaining (backward)"].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Current Prompt Level</label>
                  <select value={program.prompt_level}
                    onChange={(e) => updateItem(setSkillPrograms, i, "prompt_level", e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    {PROMPT_LEVELS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Mastery Criteria</label>
                  <input type="text" value={program.mastery_criteria}
                    onChange={(e) => updateItem(setSkillPrograms, i, "mastery_criteria", e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Baseline Performance</label>
                  <input type="text" value={program.baseline_performance}
                    onChange={(e) => updateItem(setSkillPrograms, i, "baseline_performance", e.target.value)}
                    placeholder="e.g. 0% independent, requires FP"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Materials Needed</label>
                  <input type="text" value={program.materials}
                    onChange={(e) => updateItem(setSkillPrograms, i, "materials", e.target.value)}
                    placeholder="Flashcards, reinforcers, token board..."
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Generalization Plan</label>
                  <textarea value={program.generalization_plan}
                    onChange={(e) => updateItem(setSkillPrograms, i, "generalization_plan", e.target.value)}
                    placeholder="How skill will be generalized across settings, people, and materials..."
                    rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Maintenance Plan</label>
                  <textarea value={program.maintenance_plan}
                    onChange={(e) => updateItem(setSkillPrograms, i, "maintenance_plan", e.target.value)}
                    placeholder="How skill will be maintained after mastery..."
                    rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>
              {skillPrograms.length > 1 && (
                <button onClick={() => removeItem(setSkillPrograms, i)} className="mt-3 text-xs text-red-400 hover:text-red-600">
                  Remove this program
                </button>
              )}
            </Section>
          ))}
        </div>
      )}

      {/* STEP 8 — CAREGIVER TRAINING */}
      {currentStep === 8 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Caregiver Training Plan</h2>
              <p className="text-xs text-gray-500 mt-0.5">Required for insurance reauthorization — document all caregiver training activities</p>
            </div>
            <Button variant="outline" onClick={() => addItem(setCaregiverTraining, {
              training_topic: "", training_method: "BST", caregiver_name: "", trainer_name: "",
              completion_date: "", completed: false, notes: "",
            })}>+ Add Training</Button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
            <p className="font-bold mb-1">Insurance Requirement</p>
            <p>Caregiver training must be documented to demonstrate family involvement and collaboration. Insurance companies require proof of caregiver training as part of reauthorization packets. All training should use Behavioral Skills Training (BST): Instruction → Modeling → Rehearsal → Feedback.</p>
          </div>

          {caregiverTraining.map((training, i) => (
            <Section key={i} title={`Training ${i + 1}${training.training_topic ? ` — ${training.training_topic}` : ""}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Training Topic *</label>
                  <select value={training.training_topic}
                    onChange={(e) => updateItem(setCaregiverTraining, i, "training_topic", e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="">Select topic...</option>
                    {TRAINING_TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
                    <option value="Custom">Custom topic...</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Training Method</label>
                  <select value={training.training_method}
                    onChange={(e) => updateItem(setCaregiverTraining, i, "training_method", e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    {["BST", "Video modeling", "Written instructions", "Live demonstration", "Role play", "Group training"].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Caregiver Name</label>
                  <input type="text" value={training.caregiver_name}
                    onChange={(e) => updateItem(setCaregiverTraining, i, "caregiver_name", e.target.value)}
                    placeholder="Name of caregiver trained"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Trainer Name</label>
                  <input type="text" value={training.trainer_name}
                    onChange={(e) => updateItem(setCaregiverTraining, i, "trainer_name", e.target.value)}
                    placeholder="BCBA or clinician conducting training"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Completion Date</label>
                  <input type="date" value={training.completion_date}
                    onChange={(e) => updateItem(setCaregiverTraining, i, "completion_date", e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div className="flex items-center gap-3 mt-4">
                  <button onClick={() => updateItem(setCaregiverTraining, i, "completed", !training.completed)}
                    className={`w-12 h-6 rounded-full transition-all relative ${training.completed ? "bg-green-500" : "bg-gray-300"}`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${training.completed ? "left-7" : "left-1"}`} />
                  </button>
                  <span className="text-sm text-gray-700">{training.completed ? "✓ Completed" : "Not yet completed"}</span>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
                  <textarea value={training.notes}
                    onChange={(e) => updateItem(setCaregiverTraining, i, "notes", e.target.value)}
                    placeholder="Training notes, caregiver feedback, follow-up needed..." rows={2}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>
              {caregiverTraining.length > 1 && (
                <button onClick={() => removeItem(setCaregiverTraining, i)} className="mt-3 text-xs text-red-400 hover:text-red-600">
                  Remove this training
                </button>
              )}
            </Section>
          ))}

          {/* FINAL REVIEW SUMMARY */}
          <Section title="📋 BIP Summary Before Saving">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              {[
                { label: "Target Behaviors", value: targetBehaviors.filter((b) => b.behavior_name).length, color: "text-red-500" },
                { label: "Antecedent Strategies", value: antecedentStrategies.filter((s) => s.strategy_name).length, color: "text-blue-600" },
                { label: "Consequence Strategies", value: consequenceStrategies.filter((s) => s.strategy_name).length, color: "text-purple-600" },
                { label: "Skill Programs", value: skillPrograms.filter((p) => p.program_name).length, color: "text-green-600" },
                { label: "Replacement Behaviors", value: replacementBehaviors.filter((r) => r.behavior_name).length, color: "text-orange-500" },
                { label: "Caregiver Trainings", value: caregiverTraining.filter((t) => t.training_topic).length, color: "text-teal-600" },
                { label: "LMN Obtained", value: lmnObtained ? "Yes" : "No", color: lmnObtained ? "text-green-600" : "text-red-500" },
                { label: "Hours/Week", value: recommendedHours, color: "text-blue-600" },
              ].map((item) => (
                <div key={item.label} className="border rounded-lg p-3 bg-white">
                  <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* NAV BUTTONS */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-100">
        <Button variant="outline" onClick={() => setCurrentStep((s) => Math.max(1, s - 1))} disabled={currentStep === 1}>
          ← Previous
        </Button>
        <span className="text-sm text-gray-400">{currentStep} / {TOTAL_STEPS}</span>
        {currentStep < TOTAL_STEPS ? (
          <Button onClick={() => setCurrentStep((s) => Math.min(TOTAL_STEPS, s + 1))} disabled={currentStep === 1 && !clientId}>
            Next →
          </Button>
        ) : (
          <Button onClick={handleSave} loading={saving} disabled={!clientId}>
            💾 Save BIP
          </Button>
        )}
      </div>
    </div>
  );
}