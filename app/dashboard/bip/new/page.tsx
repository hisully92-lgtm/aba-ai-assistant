"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { useRouter } from "next/navigation";

type Client = { id: string; full_name: string; diagnosis: string | null };
type Profile = { id: string; full_name: string | null; role: string | null };
type TargetBehavior = {
  behavior_name: string;
  behavior_type: "reduction" | "acquisition";
  operational_definition: string;
  topography: string;
  function_of_behavior: string;
  baseline_rate: string;
  measurement_method: string;
  goal_target: string;
  antecedents: string[];
  consequences: string[];
  priority: number;
};
type AntecedentStrategy = {
  strategy_name: string;
  strategy_type: string;
  description: string;
  implementation_steps: string;
};
type ConsequenceStrategy = {
  strategy_name: string;
  strategy_type: string;
  description: string;
  implementation_steps: string;
  reinforcers_used: string;
};
type ReplacementBehavior = {
  behavior_name: string;
  rationale: string;
  teaching_strategy: string;
  reinforcement_schedule: string;
};
type SkillProgram = {
  program_name: string;
  domain: string;
  objective: string;
  teaching_procedure: string;
  prompt_level: string;
  mastery_criteria: string;
  materials: string;
  generalization_plan: string;
  maintenance_plan: string;
  baseline_performance: string;
};
type CaregiverTraining = {
  training_topic: string;
  training_method: string;
  caregiver_name: string;
  trainer_name: string;
  completion_date: string;
  completed: boolean;
  notes: string;
};

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
const CPT_CODES = [
  "97151 — Behavior Identification Assessment",
  "97152 — Behavior Identification Supporting Assessment",
  "97153 — Adaptive Behavior Treatment by Protocol",
  "97154 — Group ABA Treatment",
  "97155 — Protocol Modification by BCBA",
  "97156 — Family Guidance by BCBA",
  "97157 — Multiple Family Group",
  "97158 — Group Protocol Modification",
  "H0031 — Mental Health Assessment",
  "H0032 — Mental Health Service Plan",
  "91751 — ABA Treatment Plan / BIP",
];
const SETTINGS = ["Home", "Clinic", "School", "Community", "Telehealth", "Multiple Settings"];
const FUNCTIONS = ["Access to tangibles", "Escape/Avoidance", "Attention", "Sensory/Automatic", "Unknown — FBA needed"];
const MEASUREMENT_METHODS = ["Frequency", "Rate", "Duration", "Latency", "Interval Recording", "Permanent Product", "ABC Data"];
const PROMPT_LEVELS = ["Full Physical", "Partial Physical", "Model", "Gesture", "Positional", "Vocal", "Independent"];
const DOMAINS = ["Communication", "Social Skills", "Daily Living", "Academic", "Motor", "Behavior Reduction", "Vocational", "Play"];
const STRATEGY_TYPES_ANTECEDENT = ["Environmental modification", "Predictability/Schedule", "Demand modification", "Pre-teaching", "Priming", "Choice provision", "Sensory accommodation", "Escape extinction"];
const STRATEGY_TYPES_CONSEQUENCE = ["Differential reinforcement (DRA)", "Differential reinforcement (DRI)", "Extinction", "Planned ignoring", "Redirection", "Token economy", "Response cost", "Time-out from reinforcement", "Noncontingent reinforcement (NCR)"];
const TRAINING_TOPICS = ["BST — Reinforcement strategies", "BST — Data collection", "BST — BIP implementation", "BST — Crisis procedures", "Home program implementation", "Caregiver feedback session", "Video review", "Role play practice", "Written instructions review"];
const TEACHING_PROCEDURES = ["DTT — Discrete Trial Teaching", "NET — Natural Environment Teaching", "Task Analysis", "PECS", "FCT — Functional Communication Training", "PRT — Pivotal Response Training", "Video Modeling", "Social Stories", "Chaining (forward)", "Chaining (backward)"];
const TRAINING_METHODS = ["BST", "Video modeling", "Written instructions", "Live demonstration", "Role play", "Group training"];
const FBA_METHODS = ["Descriptive — ABC Data Collection", "Indirect — Caregiver/Teacher Interview", "Indirect — Rating Scales", "Functional Analysis (FA) — Experimental", "Structured Descriptive Assessment (SDA)"];
const FIDELITY_ROLES = ["BCBA", "BCaBA", "RBT", "Supervisor", "Caregiver"];

const getFutureDate = (months: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
};

export default function NewBIPPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const TOTAL_STEPS = 10;

  // Step 1 — Basic Info
  const [clientId, setClientId] = useState("");
  const [bcbaId, setBcbaId] = useState("");
  const [diagnosisCode, setDiagnosisCode] = useState("");
  const [cptCode, setCptCode] = useState("");
  const [assessmentDate, setAssessmentDate] = useState("");
  const [planStartDate, setPlanStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [planEndDate, setPlanEndDate] = useState(getFutureDate(6));
  const [reviewDate, setReviewDate] = useState(getFutureDate(3));
  const [reauthDueDate, setReauthDueDate] = useState(getFutureDate(5));
  const [recommendedHours, setRecommendedHours] = useState(20);
  const [recommendedSetting, setRecommendedSetting] = useState("Home");

  // Step 2 — Biographical Data
  const [clientDob, setClientDob] = useState("");
  const [clientAge, setClientAge] = useState("");
  const [clientGender, setClientGender] = useState("");
  const [clientEthnicity, setClientEthnicity] = useState("");
  const [primaryLanguage, setPrimaryLanguage] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [caregiverName, setCaregiverName] = useState("");
  const [caregiverRelationship, setCaregiverRelationship] = useState("");
  const [caregiverPhone, setCaregiverPhone] = useState("");
  const [caregiverEmail, setCaregiverEmail] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [insuranceMemberId, setInsuranceMemberId] = useState("");
  const [referringPhysician, setReferringPhysician] = useState("");
  const [referringPhysicianPhone, setReferringPhysicianPhone] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [schoolContact, setSchoolContact] = useState("");

  // Step 3 — Medications
  const [medications, setMedications] = useState([{ name: "", dosage: "", frequency: "", prescriber: "", purpose: "", start_date: "", notes: "" }]);
  const [medicationAllergies, setMedicationAllergies] = useState("");
  const [medicalHistory, setMedicalHistory] = useState("");
  const [previousDiagnoses, setPreviousDiagnoses] = useState("");

  // Step 4 — Background
  const [clientStrengths, setClientStrengths] = useState("");
  const [clientPreferences, setClientPreferences] = useState("");
  const [learningHistory, setLearningHistory] = useState("");
  const [previousInterventions, setPreviousInterventions] = useState("");
  const [clientWeaknesses, setClientWeaknesses] = useState("");

  // Step 5 — FBA
  const [fbaCompleted, setFbaCompleted] = useState(false);
  const [fbaDate, setFbaDate] = useState("");
  const [fbaConductedBy, setFbaConductedBy] = useState("");
  const [fbaMethod, setFbaMethod] = useState("");
  const [fbaHypothesis, setFbaHypothesis] = useState("");
  const [fbaAntecedents, setFbaAntecedents] = useState("");
  const [fbaBehaviors, setFbaBehaviors] = useState("");
  const [fbaConsequences, setFbaConsequences] = useState("");
  const [fbaFunction, setFbaFunction] = useState("");
  const [fbaSummary, setFbaSummary] = useState("");

  // Step 6 — Medical Necessity
  const [medicalNecessity, setMedicalNecessity] = useState("");
  const [lmnObtained, setLmnObtained] = useState(false);
  const [lmnPhysician, setLmnPhysician] = useState("");
  const [lmnDate, setLmnDate] = useState("");

  // Step 7 — Target Behaviors
  const [targetBehaviors, setTargetBehaviors] = useState<TargetBehavior[]>([{
    behavior_name: "", behavior_type: "reduction", operational_definition: "",
    topography: "", function_of_behavior: "", baseline_rate: "",
    measurement_method: "Frequency", goal_target: "", antecedents: [], consequences: [], priority: 1,
  }]);

  // Step 8 — Plan (Antecedent + Consequence + Replacement Behavior + Skill Program + Fidelity, grouped by index)
  const [antecedentStrategies, setAntecedentStrategies] = useState<AntecedentStrategy[]>([{
    strategy_name: "", strategy_type: "", description: "", implementation_steps: "",
  }]);
  const [consequenceStrategies, setConsequenceStrategies] = useState<ConsequenceStrategy[]>([{
    strategy_name: "", strategy_type: "", description: "", implementation_steps: "", reinforcers_used: "",
  }]);
  const [replacementBehaviors, setReplacementBehaviors] = useState<ReplacementBehavior[]>([{
    behavior_name: "", rationale: "", teaching_strategy: "", reinforcement_schedule: "",
  }]);
  const [skillPrograms, setSkillPrograms] = useState<SkillProgram[]>([{
    program_name: "", domain: "", objective: "", teaching_procedure: "",
    prompt_level: "Gesture", mastery_criteria: "80% over 3 consecutive sessions",
    materials: "", generalization_plan: "", maintenance_plan: "", baseline_performance: "",
  }]);
  const [fidelityChecks, setFidelityChecks] = useState([{
    check_date: "", conducted_by: "", role: "", fidelity_percentage: "", components_observed: "", areas_of_concern: "", follow_up_plan: "",
  }]);

  // Step 9 — Caregiver Training (its own step)
  const [caregiverTraining, setCaregiverTraining] = useState<CaregiverTraining[]>([{
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
  function updateItem<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, index: number, field: keyof T, value: any) {
    setter((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }
  function updateMed(index: number, field: string, value: string) {
    setMedications((prev) => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  }
  function updateFidelity(index: number, field: string, value: string) {
    setFidelityChecks((prev) => prev.map((f, i) => i === index ? { ...f, [field]: value } : f));
  }

  // Plan tab: the five arrays are grouped and indexed together, so add/remove
  // operate on all five in lockstep to keep indices aligned across the group.
  function addPlanItem() {
    setAntecedentStrategies((prev) => [...prev, { strategy_name: "", strategy_type: "", description: "", implementation_steps: "" }]);
    setConsequenceStrategies((prev) => [...prev, { strategy_name: "", strategy_type: "", description: "", implementation_steps: "", reinforcers_used: "" }]);
    setReplacementBehaviors((prev) => [...prev, { behavior_name: "", rationale: "", teaching_strategy: "", reinforcement_schedule: "" }]);
    setSkillPrograms((prev) => [...prev, {
      program_name: "", domain: "", objective: "", teaching_procedure: "",
      prompt_level: "Gesture", mastery_criteria: "80% over 3 consecutive sessions",
      materials: "", generalization_plan: "", maintenance_plan: "", baseline_performance: "",
    }]);
    setFidelityChecks((prev) => [...prev, { check_date: "", conducted_by: "", role: "", fidelity_percentage: "", components_observed: "", areas_of_concern: "", follow_up_plan: "" }]);
  }
  function removePlanItem(index: number) {
    setAntecedentStrategies((prev) => prev.filter((_, i) => i !== index));
    setConsequenceStrategies((prev) => prev.filter((_, i) => i !== index));
    setReplacementBehaviors((prev) => prev.filter((_, i) => i !== index));
    setSkillPrograms((prev) => prev.filter((_, i) => i !== index));
    setFidelityChecks((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!clientId) { alert("Please select a client before saving."); return; }
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) { setSaving(false); return; }

    const { data: bip, error } = await supabase.from("behavior_intervention_plans").insert([{
      client_id: clientId,
      bcba_id: bcbaId || user.id,
      diagnosis_code: diagnosisCode ? diagnosisCode.split(" — ")[0] : null,
      diagnosis_description: diagnosisCode ? diagnosisCode.split(" — ")[1] : null,
      cpt_code: cptCode || null,
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
      client_weaknesses: clientWeaknesses || null,
      client_preferences: clientPreferences || null,
      learning_history: learningHistory || null,
      previous_interventions: previousInterventions || null,
      // Biographical
      client_dob: clientDob || null,
      client_age: clientAge || null,
      client_gender: clientGender || null,
      client_ethnicity: clientEthnicity || null,
      primary_language: primaryLanguage || null,
      client_address: clientAddress || null,
      caregiver_name: caregiverName || null,
      caregiver_relationship: caregiverRelationship || null,
      caregiver_phone: caregiverPhone || null,
      caregiver_email: caregiverEmail || null,
      emergency_contact: emergencyContact || null,
      emergency_phone: emergencyPhone || null,
      insurance_provider: insuranceProvider || null,
      insurance_member_id: insuranceMemberId || null,
      referring_physician: referringPhysician || null,
      referring_physician_phone: referringPhysicianPhone || null,
      school_name: schoolName || null,
      school_contact: schoolContact || null,
      // Medical
      medication_allergies: medicationAllergies || null,
      medical_history: medicalHistory || null,
      previous_diagnoses: previousDiagnoses || null,
      medications: medications.filter((m) => m.name).length > 0 ? JSON.stringify(medications.filter((m) => m.name)) : null,
      // FBA
      fba_completed: fbaCompleted,
      fba_date: fbaDate || null,
      fba_conducted_by: fbaConductedBy || null,
      fba_method: fbaMethod || null,
      fba_hypothesis: fbaHypothesis || null,
      fba_antecedents: fbaAntecedents || null,
      fba_behaviors: fbaBehaviors || null,
      fba_consequences: fbaConsequences || null,
      fba_function: fbaFunction || null,
      fba_summary: fbaSummary || null,
      status: "draft",
      version: 1,
      created_by: user.id,
    }]).select().single();

    if (error || !bip) { alert("Failed to save BIP."); setSaving(false); return; }

    const insertions: any[] = [];

    if (targetBehaviors.filter((b) => b.behavior_name).length > 0) {
      insertions.push(supabase.from("bip_target_behaviors").insert(
        targetBehaviors.filter((b) => b.behavior_name).map((b) => ({
          ...b, bip_id: bip.id, antecedents: JSON.stringify(b.antecedents), consequences: JSON.stringify(b.consequences), created_by: user.id,
        }))
      ));
    }
    if (antecedentStrategies.filter((s) => s.strategy_name).length > 0) {
      insertions.push(supabase.from("bip_antecedent_strategies").insert(
        antecedentStrategies.filter((s) => s.strategy_name).map((s) => ({ ...s, bip_id: bip.id, created_by: user.id }))
      ));
    }
    if (consequenceStrategies.filter((s) => s.strategy_name).length > 0) {
      insertions.push(supabase.from("bip_consequence_strategies").insert(
        consequenceStrategies.filter((s) => s.strategy_name).map((s) => ({ ...s, bip_id: bip.id, created_by: user.id }))
      ));
    }
    if (replacementBehaviors.filter((r) => r.behavior_name).length > 0) {
      insertions.push(supabase.from("bip_replacement_behaviors").insert(
        replacementBehaviors.filter((r) => r.behavior_name).map((r) => ({ ...r, bip_id: bip.id, created_by: user.id }))
      ));
    }
    if (skillPrograms.filter((p) => p.program_name).length > 0) {
      insertions.push(supabase.from("bip_skill_programs").insert(
        skillPrograms.filter((p) => p.program_name).map((p) => ({ ...p, bip_id: bip.id, created_by: user.id }))
      ));
    }
    if (caregiverTraining.filter((t) => t.training_topic).length > 0) {
      insertions.push(supabase.from("bip_caregiver_training").insert(
        caregiverTraining.filter((t) => t.training_topic).map((t) => ({ ...t, bip_id: bip.id, created_by: user.id }))
      ));
    }
    if (fidelityChecks.filter((f) => f.check_date).length > 0) {
      insertions.push(supabase.from("bip_treatment_fidelity").insert(
        fidelityChecks.filter((f) => f.check_date).map((f) => ({ ...f, bip_id: bip.id, created_by: user.id }))
      ));
    }

    await Promise.all(insertions);
    setSaving(false);
    router.push(`/dashboard/bip/${bip.id}`);
  }

  const STEPS = [
    "Basic Info", "Biographical Data", "Medications", "Background",
    "FBA", "Medical Necessity", "Target Behaviors",
    "Plan", "Caregiver Training", "Summary",
  ];

  const inputClass = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";

  // Number of grouped Plan items — the five arrays are kept in lockstep by addPlanItem/removePlanItem.
  const planItemCount = antecedentStrategies.length;

  return (
    <div className="space-y-6">
      <PageHeader title="New Behavior Intervention Plan">
        <p className="text-gray-500 text-sm">Step {currentStep} of {TOTAL_STEPS}</p>
      </PageHeader>

      {/* STEP INDICATOR */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {STEPS.map((step, i) => (
          <button key={i} onClick={() => setCurrentStep(i + 1)}
            className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors
              ${currentStep === i + 1 ? "bg-blue-600 text-white" : i + 1 < currentStep ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
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
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputClass}>
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Supervising BCBA</label>
              <select value={bcbaId} onChange={(e) => setBcbaId(e.target.value)} className={inputClass}>
                {profiles.filter((p) => ["supervisor", "admin", "clinician", "developer"].includes(p.role ?? "")).map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Diagnosis Code (ICD-10)</label>
              <select value={diagnosisCode} onChange={(e) => setDiagnosisCode(e.target.value)} className={inputClass}>
                <option value="">Select diagnosis...</option>
                {ICD10_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">CPT Code</label>
              <select value={cptCode} onChange={(e) => setCptCode(e.target.value)} className={inputClass}>
                <option value="">Select CPT code...</option>
                {CPT_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Assessment Date</label>
              <input type="date" value={assessmentDate} onChange={(e) => setAssessmentDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Plan Start Date</label>
              <input type="date" value={planStartDate} onChange={(e) => setPlanStartDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Plan End Date</label>
              <input type="date" value={planEndDate} onChange={(e) => setPlanEndDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Quarterly Review Date</label>
              <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Reauth Due Date</label>
              <input type="date" value={reauthDueDate} onChange={(e) => setReauthDueDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Recommended Hours/Week</label>
              <input type="number" min={1} max={40} value={recommendedHours} onChange={(e) => setRecommendedHours(parseInt(e.target.value) || 0)} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Recommended Setting</label>
              <select value={recommendedSetting} onChange={(e) => setRecommendedSetting(e.target.value)} className={inputClass}>
                {SETTINGS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </Section>
      )}

      {/* STEP 2 — BIOGRAPHICAL DATA */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <Section title="Client Information">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Date of Birth</label>
                <input type="date" value={clientDob} onChange={(e) => setClientDob(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Age</label>
                <input type="text" value={clientAge} onChange={(e) => setClientAge(e.target.value)} placeholder="e.g. 7 years, 4 months" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Gender</label>
                <select value={clientGender} onChange={(e) => setClientGender(e.target.value)} className={inputClass}>
                  <option value="">Select...</option>
                  <option>Male</option><option>Female</option><option>Non-binary</option><option>Other</option><option>Prefer not to say</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Ethnicity</label>
                <select value={clientEthnicity} onChange={(e) => setClientEthnicity(e.target.value)} className={inputClass}>
                  <option value="">Select...</option>
                  <option>Hispanic or Latino</option><option>White (Non-Hispanic)</option><option>Black or African American</option>
                  <option>Asian</option><option>Native American</option><option>Pacific Islander</option><option>Multiracial</option><option>Other</option><option>Prefer not to say</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Primary Language</label>
                <input type="text" value={primaryLanguage} onChange={(e) => setPrimaryLanguage(e.target.value)} placeholder="e.g. English, Spanish" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Home Address</label>
                <input type="text" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} placeholder="Street, City, State, ZIP" className={inputClass} />
              </div>
            </div>
          </Section>

          <Section title="Caregiver Information">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Primary Caregiver Name</label>
                <input type="text" value={caregiverName} onChange={(e) => setCaregiverName(e.target.value)} placeholder="Full name" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Relationship to Client</label>
                <select value={caregiverRelationship} onChange={(e) => setCaregiverRelationship(e.target.value)} className={inputClass}>
                  <option value="">Select...</option>
                  <option>Mother</option><option>Father</option><option>Guardian</option><option>Grandparent</option>
                  <option>Foster Parent</option><option>Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Caregiver Phone</label>
                <input type="tel" value={caregiverPhone} onChange={(e) => setCaregiverPhone(e.target.value)} placeholder="(555) 555-5555" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Caregiver Email</label>
                <input type="email" value={caregiverEmail} onChange={(e) => setCaregiverEmail(e.target.value)} placeholder="email@example.com" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Emergency Contact Name</label>
                <input type="text" value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} placeholder="Name and relationship" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Emergency Contact Phone</label>
                <input type="tel" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder="(555) 555-5555" className={inputClass} />
              </div>
            </div>
          </Section>

          <Section title="Insurance & Provider Information">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Insurance Provider</label>
                <input type="text" value={insuranceProvider} onChange={(e) => setInsuranceProvider(e.target.value)} placeholder="e.g. Medicaid, Aetna, BCBS" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Member ID</label>
                <input type="text" value={insuranceMemberId} onChange={(e) => setInsuranceMemberId(e.target.value)} placeholder="Insurance member ID" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Referring Physician</label>
                <input type="text" value={referringPhysician} onChange={(e) => setReferringPhysician(e.target.value)} placeholder="Dr. Name" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Physician Phone</label>
                <input type="tel" value={referringPhysicianPhone} onChange={(e) => setReferringPhysicianPhone(e.target.value)} placeholder="(555) 555-5555" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">School Name</label>
                <input type="text" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="School attending (if applicable)" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">School Contact</label>
                <input type="text" value={schoolContact} onChange={(e) => setSchoolContact(e.target.value)} placeholder="Teacher/counselor name and phone" className={inputClass} />
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* STEP 3 — MEDICATIONS */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <Section title="Medical History">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Known Medication Allergies</label>
                <textarea value={medicationAllergies} onChange={(e) => setMedicationAllergies(e.target.value)}
                  placeholder="List any known medication allergies or adverse reactions. Write 'NKDA' if none known." rows={2} className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Relevant Medical History</label>
                <textarea value={medicalHistory} onChange={(e) => setMedicalHistory(e.target.value)}
                  placeholder="Relevant medical conditions, hospitalizations, surgeries, or health concerns..." rows={3} className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Previous / Co-occurring Diagnoses</label>
                <textarea value={previousDiagnoses} onChange={(e) => setPreviousDiagnoses(e.target.value)}
                  placeholder="Any additional diagnoses (e.g. anxiety, ADHD, epilepsy, sensory processing disorder)..." rows={2} className={inputClass} />
              </div>
            </div>
          </Section>

          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Current Medications</h2>
              <p className="text-xs text-gray-500">Document all current medications including dosage and prescribing physician</p>
            </div>
            <Button variant="outline" onClick={() => setMedications((prev) => [...prev, { name: "", dosage: "", frequency: "", prescriber: "", purpose: "", start_date: "", notes: "" }])}>
              + Add Medication
            </Button>
          </div>

          {medications.length === 0 && (
            <div className="border rounded-xl p-4 text-center text-sm text-gray-400">No medications added. Click "+ Add Medication" or document NKDA above.</div>
          )}

          {medications.map((med, i) => (
            <Section key={i} title={`Medication ${i + 1}${med.name ? ` — ${med.name}` : ""}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Medication Name *</label>
                  <input type="text" value={med.name} onChange={(e) => updateMed(i, "name", e.target.value)} placeholder="Generic or brand name" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Dosage</label>
                  <input type="text" value={med.dosage} onChange={(e) => updateMed(i, "dosage", e.target.value)} placeholder="e.g. 10mg, 0.5ml" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Frequency</label>
                  <input type="text" value={med.frequency} onChange={(e) => updateMed(i, "frequency", e.target.value)} placeholder="e.g. Once daily, BID, PRN" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Prescribing Physician</label>
                  <input type="text" value={med.prescriber} onChange={(e) => updateMed(i, "prescriber", e.target.value)} placeholder="Dr. Name" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Purpose / Condition Treated</label>
                  <input type="text" value={med.purpose} onChange={(e) => updateMed(i, "purpose", e.target.value)} placeholder="e.g. ADHD, seizure management, anxiety" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Start Date</label>
                  <input type="date" value={med.start_date} onChange={(e) => updateMed(i, "start_date", e.target.value)} className={inputClass} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Notes / Side Effects to Monitor</label>
                  <textarea value={med.notes} onChange={(e) => updateMed(i, "notes", e.target.value)}
                    placeholder="Behavioral side effects, monitoring needs, relevant notes..." rows={2} className={inputClass} />
                </div>
              </div>
              {medications.length > 1 && (
                <button onClick={() => setMedications((prev) => prev.filter((_, idx) => idx !== i))}
                  className="mt-3 text-xs text-red-500 hover:text-red-700">Remove this medication</button>
              )}
            </Section>
          ))}
        </div>
      )}

      {/* STEP 4 — BACKGROUND */}
      {currentStep === 4 && (
        <Section title="Client Background">
          <div className="space-y-4">
            {[
              { label: "Client Strengths", value: clientStrengths, setter: setClientStrengths, placeholder: "Describe the client's strengths, motivators, and positive attributes..." },
              { label: "Client Weaknesses", value: clientWeaknesses, setter: setClientWeaknesses, placeholder: "Describe areas of difficulty, skill deficits, or challenges..." },
              { label: "Client Preferences & Reinforcers", value: clientPreferences, setter: setClientPreferences, placeholder: "Preferred items, activities, people, and reinforcers..." },
              { label: "Learning History", value: learningHistory, setter: setLearningHistory, placeholder: "Previous ABA services, response to interventions, progress made..." },
              { label: "Previous Interventions", value: previousInterventions, setter: setPreviousInterventions, placeholder: "Interventions previously tried, outcomes, what has/hasn't worked..." },
            ].map((field) => (
              <div key={field.label}>
                <label className="text-sm font-medium text-gray-700 mb-1 block">{field.label}</label>
                <textarea value={field.value} onChange={(e) => field.setter(e.target.value)} placeholder={field.placeholder} rows={4} className={inputClass} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* STEP 5 — FBA */}
      {currentStep === 5 && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
            <p className="font-bold mb-1">Functional Behavior Assessment (FBA)</p>
            <p>An FBA identifies the antecedents, behaviors, and consequences to determine the function driving a problem behavior. Required for insurance reauth and best practice for all behavior reduction plans. Document FBA findings here to support your BIP interventions.</p>
          </div>

          <Section title="FBA Summary">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setFbaCompleted(!fbaCompleted)}
                  className={`w-12 h-6 rounded-full transition-all relative ${fbaCompleted ? "bg-green-500" : "bg-gray-300"}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${fbaCompleted ? "left-7" : "left-1"}`} />
                </button>
                <span className="text-sm text-gray-700">{fbaCompleted ? "FBA completed" : "FBA not yet completed"}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">FBA Date</label>
                  <input type="date" value={fbaDate} onChange={(e) => setFbaDate(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Conducted By</label>
                  <input type="text" value={fbaConductedBy} onChange={(e) => setFbaConductedBy(e.target.value)} placeholder="BCBA name and credentials" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">FBA Method(s) Used</label>
                  <select value={fbaMethod} onChange={(e) => setFbaMethod(e.target.value)} className={inputClass}>
                    <option value="">Select method...</option>
                    {FBA_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Identified Function</label>
                  <select value={fbaFunction} onChange={(e) => setFbaFunction(e.target.value)} className={inputClass}>
                    <option value="">Select function...</option>
                    {FUNCTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Antecedents Identified</label>
                <textarea value={fbaAntecedents} onChange={(e) => setFbaAntecedents(e.target.value)}
                  placeholder="What settings, people, events, or demands consistently precede the behavior?" rows={3} className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Behaviors Observed</label>
                <textarea value={fbaBehaviors} onChange={(e) => setFbaBehaviors(e.target.value)}
                  placeholder="Operationally define the behaviors observed during the FBA process..." rows={3} className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Consequences Identified</label>
                <textarea value={fbaConsequences} onChange={(e) => setFbaConsequences(e.target.value)}
                  placeholder="What typically happens after the behavior occurs? What does the client gain or avoid?" rows={3} className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Hypothesis Statement</label>
                <textarea value={fbaHypothesis} onChange={(e) => setFbaHypothesis(e.target.value)}
                  placeholder="When [antecedent], [client] engages in [behavior] in order to [function/consequence]..." rows={3} className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">FBA Summary / Clinical Impressions</label>
                <textarea value={fbaSummary} onChange={(e) => setFbaSummary(e.target.value)}
                  placeholder="Overall summary of FBA findings and clinical impressions..." rows={4} className={inputClass} />
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* STEP 6 — MEDICAL NECESSITY */}
      {currentStep === 6 && (
        <Section title="Medical Necessity">
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
              <p className="font-bold">Insurance Requirement — Medical Necessity Statement</p>
              <p className="mt-1">Must justify why ABA therapy is medically necessary, including the client's diagnosis, functional impairments, and how ABA will address them.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Medical Necessity Statement *</label>
              <textarea value={medicalNecessity} onChange={(e) => setMedicalNecessity(e.target.value)}
                placeholder="[Client name] is a [age]-year-old individual diagnosed with [diagnosis] who presents with significant deficits in [areas]. ABA therapy is medically necessary to address [specific behaviors/deficits]..."
                rows={8} className={inputClass} />
            </div>
            <div className="border border-gray-100 rounded-xl p-4 space-y-4">
              <p className="text-sm font-semibold text-gray-700">Letter of Medical Necessity (LMN)</p>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setLmnObtained(!lmnObtained)}
                  className={`w-12 h-6 rounded-full transition-all relative ${lmnObtained ? "bg-green-500" : "bg-gray-300"}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${lmnObtained ? "left-7" : "left-1"}`} />
                </button>
                <span className="text-sm text-gray-700">{lmnObtained ? "LMN obtained" : "LMN not yet obtained"}</span>
              </div>
              {lmnObtained && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Physician Name</label>
                    <input type="text" value={lmnPhysician} onChange={(e) => setLmnPhysician(e.target.value)} placeholder="Signing physician name" className={inputClass} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">LMN Date</label>
                    <input type="date" value={lmnDate} onChange={(e) => setLmnDate(e.target.value)} className={inputClass} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* STEP 7 — TARGET BEHAVIORS */}
      {currentStep === 7 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800">Target Behaviors</h2>
            <Button variant="outline" onClick={() => addItem<TargetBehavior>(setTargetBehaviors, {
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
                  <input type="text" value={behavior.behavior_name} onChange={(e) => updateItem<TargetBehavior>(setTargetBehaviors, i, "behavior_name", e.target.value)} placeholder="e.g. Aggression, Elopement" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Behavior Type</label>
                  <select value={behavior.behavior_type} onChange={(e) => updateItem<TargetBehavior>(setTargetBehaviors, i, "behavior_type", e.target.value as "reduction" | "acquisition")} className={inputClass}>
                    <option value="reduction">Behavior Reduction</option>
                    <option value="acquisition">Skill Acquisition</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Operational Definition *</label>
                  <textarea value={behavior.operational_definition} onChange={(e) => updateItem<TargetBehavior>(setTargetBehaviors, i, "operational_definition", e.target.value)} rows={3} placeholder="Define the behavior in observable, measurable terms..." className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Topography</label>
                  <input type="text" value={behavior.topography} onChange={(e) => updateItem<TargetBehavior>(setTargetBehaviors, i, "topography", e.target.value)} placeholder="Physical form the behavior takes" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Function of Behavior</label>
                  <select value={behavior.function_of_behavior} onChange={(e) => updateItem<TargetBehavior>(setTargetBehaviors, i, "function_of_behavior", e.target.value)} className={inputClass}>
                    <option value="">Select function...</option>
                    {FUNCTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Baseline Rate</label>
                  <input type="text" value={behavior.baseline_rate} onChange={(e) => updateItem<TargetBehavior>(setTargetBehaviors, i, "baseline_rate", e.target.value)} placeholder="e.g. 4x/hour" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Measurement Method</label>
                  <select value={behavior.measurement_method} onChange={(e) => updateItem<TargetBehavior>(setTargetBehaviors, i, "measurement_method", e.target.value)} className={inputClass}>
                    {MEASUREMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Goal Target</label>
                  <input type="text" value={behavior.goal_target} onChange={(e) => updateItem<TargetBehavior>(setTargetBehaviors, i, "goal_target", e.target.value)} placeholder="e.g. 0x/week for 4 consecutive weeks" className={inputClass} />
                </div>
              </div>
              {targetBehaviors.length > 1 && (
                <button type="button" onClick={() => removeItem<TargetBehavior>(setTargetBehaviors, i)} className="mt-3 text-xs text-red-500 hover:text-red-700">Remove this behavior</button>
              )}
            </Section>
          ))}
        </div>
      )}

      {/* STEP 8 — PLAN (Antecedent + Consequence + Replacement Behavior + Skill Program + Fidelity, grouped by index) */}
      {currentStep === 8 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Plan</h2>
              <p className="text-xs text-gray-500 mt-0.5">Each numbered item groups the antecedent strategy, consequence strategy, replacement behavior, skill program, and fidelity check that belong together</p>
            </div>
            <Button variant="outline" onClick={addPlanItem}>+ Add Plan Item</Button>
          </div>

          {Array.from({ length: planItemCount }).map((_, i) => (
            <div key={i} className="border-2 border-blue-100 rounded-2xl p-4 space-y-4 bg-blue-50/30">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-gray-800">Plan Item {i + 1}</h3>
                {planItemCount > 1 && (
                  <button type="button" onClick={() => removePlanItem(i)} className="text-xs text-red-500 hover:text-red-700">
                    Remove this item
                  </button>
                )}
              </div>

              {/* Antecedent Strategy */}
              <Section title={`Antecedent Strategy ${i + 1}${antecedentStrategies[i]?.strategy_name ? ` — ${antecedentStrategies[i].strategy_name}` : ""}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Strategy Name *</label>
                    <input type="text" value={antecedentStrategies[i]?.strategy_name ?? ""} onChange={(e) => updateItem<AntecedentStrategy>(setAntecedentStrategies, i, "strategy_name", e.target.value)} placeholder="e.g. Visual schedule" className={inputClass} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Strategy Type</label>
                    <select value={antecedentStrategies[i]?.strategy_type ?? ""} onChange={(e) => updateItem<AntecedentStrategy>(setAntecedentStrategies, i, "strategy_type", e.target.value)} className={inputClass}>
                      <option value="">Select type...</option>
                      {STRATEGY_TYPES_ANTECEDENT.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                    <textarea value={antecedentStrategies[i]?.description ?? ""} onChange={(e) => updateItem<AntecedentStrategy>(setAntecedentStrategies, i, "description", e.target.value)} rows={3} placeholder="Describe the strategy and its rationale..." className={inputClass} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Implementation Steps</label>
                    <textarea value={antecedentStrategies[i]?.implementation_steps ?? ""} onChange={(e) => updateItem<AntecedentStrategy>(setAntecedentStrategies, i, "implementation_steps", e.target.value)} rows={3} placeholder="Step-by-step instructions..." className={inputClass} />
                  </div>
                </div>
              </Section>

              {/* Consequence Strategy */}
              <Section title={`Consequence Strategy ${i + 1}${consequenceStrategies[i]?.strategy_name ? ` — ${consequenceStrategies[i].strategy_name}` : ""}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Strategy Name *</label>
                    <input type="text" value={consequenceStrategies[i]?.strategy_name ?? ""} onChange={(e) => updateItem<ConsequenceStrategy>(setConsequenceStrategies, i, "strategy_name", e.target.value)} placeholder="e.g. DRA, Extinction" className={inputClass} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Strategy Type</label>
                    <select value={consequenceStrategies[i]?.strategy_type ?? ""} onChange={(e) => updateItem<ConsequenceStrategy>(setConsequenceStrategies, i, "strategy_type", e.target.value)} className={inputClass}>
                      <option value="">Select type...</option>
                      {STRATEGY_TYPES_CONSEQUENCE.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Reinforcers Used</label>
                    <input type="text" value={consequenceStrategies[i]?.reinforcers_used ?? ""} onChange={(e) => updateItem<ConsequenceStrategy>(setConsequenceStrategies, i, "reinforcers_used", e.target.value)} placeholder="e.g. iPad access, verbal praise" className={inputClass} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Implementation Steps</label>
                    <textarea value={consequenceStrategies[i]?.implementation_steps ?? ""} onChange={(e) => updateItem<ConsequenceStrategy>(setConsequenceStrategies, i, "implementation_steps", e.target.value)} rows={3} placeholder="Step-by-step instructions..." className={inputClass} />
                  </div>
                </div>
              </Section>

              {/* Replacement Behavior */}
              <Section title={`Replacement Behavior ${i + 1}${replacementBehaviors[i]?.behavior_name ? ` — ${replacementBehaviors[i].behavior_name}` : ""}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Replacement Behavior *</label>
                    <input type="text" value={replacementBehaviors[i]?.behavior_name ?? ""} onChange={(e) => updateItem<ReplacementBehavior>(setReplacementBehaviors, i, "behavior_name", e.target.value)} placeholder="e.g. Requesting a break using PECS" className={inputClass} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Reinforcement Schedule</label>
                    <input type="text" value={replacementBehaviors[i]?.reinforcement_schedule ?? ""} onChange={(e) => updateItem<ReplacementBehavior>(setReplacementBehaviors, i, "reinforcement_schedule", e.target.value)} placeholder="e.g. CRF initially, then VR-3" className={inputClass} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Rationale</label>
                    <textarea value={replacementBehaviors[i]?.rationale ?? ""} onChange={(e) => updateItem<ReplacementBehavior>(setReplacementBehaviors, i, "rationale", e.target.value)} rows={2} placeholder="Why this serves the same function..." className={inputClass} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Teaching Strategy</label>
                    <textarea value={replacementBehaviors[i]?.teaching_strategy ?? ""} onChange={(e) => updateItem<ReplacementBehavior>(setReplacementBehaviors, i, "teaching_strategy", e.target.value)} rows={2} placeholder="How this will be taught..." className={inputClass} />
                  </div>
                </div>
              </Section>

              {/* Skill Program */}
              <Section title={`Program ${i + 1}${skillPrograms[i]?.program_name ? ` — ${skillPrograms[i].program_name}` : ""}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Program Name *</label>
                    <input type="text" value={skillPrograms[i]?.program_name ?? ""} onChange={(e) => updateItem<SkillProgram>(setSkillPrograms, i, "program_name", e.target.value)} placeholder="e.g. Requesting preferred items" className={inputClass} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Domain</label>
                    <select value={skillPrograms[i]?.domain ?? ""} onChange={(e) => updateItem<SkillProgram>(setSkillPrograms, i, "domain", e.target.value)} className={inputClass}>
                      <option value="">Select domain...</option>
                      {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Objective</label>
                    <textarea value={skillPrograms[i]?.objective ?? ""} onChange={(e) => updateItem<SkillProgram>(setSkillPrograms, i, "objective", e.target.value)} rows={2} placeholder="Given [SD], client will [behavior] with [criteria]..." className={inputClass} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Teaching Procedure</label>
                    <select value={skillPrograms[i]?.teaching_procedure ?? ""} onChange={(e) => updateItem<SkillProgram>(setSkillPrograms, i, "teaching_procedure", e.target.value)} className={inputClass}>
                      <option value="">Select procedure...</option>
                      {TEACHING_PROCEDURES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Current Prompt Level</label>
                    <select value={skillPrograms[i]?.prompt_level ?? "Gesture"} onChange={(e) => updateItem<SkillProgram>(setSkillPrograms, i, "prompt_level", e.target.value)} className={inputClass}>
                      {PROMPT_LEVELS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Mastery Criteria</label>
                    <input type="text" value={skillPrograms[i]?.mastery_criteria ?? ""} onChange={(e) => updateItem<SkillProgram>(setSkillPrograms, i, "mastery_criteria", e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Baseline Performance</label>
                    <input type="text" value={skillPrograms[i]?.baseline_performance ?? ""} onChange={(e) => updateItem<SkillProgram>(setSkillPrograms, i, "baseline_performance", e.target.value)} placeholder="e.g. 0% independent" className={inputClass} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Materials</label>
                    <input type="text" value={skillPrograms[i]?.materials ?? ""} onChange={(e) => updateItem<SkillProgram>(setSkillPrograms, i, "materials", e.target.value)} placeholder="Flashcards, reinforcers, token board..." className={inputClass} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Generalization Plan</label>
                    <textarea value={skillPrograms[i]?.generalization_plan ?? ""} onChange={(e) => updateItem<SkillProgram>(setSkillPrograms, i, "generalization_plan", e.target.value)} rows={2} placeholder="How skill will generalize across settings and people..." className={inputClass} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Maintenance Plan</label>
                    <textarea value={skillPrograms[i]?.maintenance_plan ?? ""} onChange={(e) => updateItem<SkillProgram>(setSkillPrograms, i, "maintenance_plan", e.target.value)} rows={2} placeholder="How skill will be maintained after mastery..." className={inputClass} />
                  </div>
                </div>
              </Section>

              {/* Fidelity Check */}
              <Section title={`Fidelity Check ${i + 1}${fidelityChecks[i]?.check_date ? ` — ${fidelityChecks[i].check_date}` : ""}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Date of Observation</label>
                    <input type="date" value={fidelityChecks[i]?.check_date ?? ""} onChange={(e) => updateFidelity(i, "check_date", e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Conducted By</label>
                    <input type="text" value={fidelityChecks[i]?.conducted_by ?? ""} onChange={(e) => updateFidelity(i, "conducted_by", e.target.value)} placeholder="BCBA name" className={inputClass} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Role of Person Observed</label>
                    <select value={fidelityChecks[i]?.role ?? ""} onChange={(e) => updateFidelity(i, "role", e.target.value)} className={inputClass}>
                      <option value="">Select role...</option>
                      {FIDELITY_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Fidelity Score (%)</label>
                    <input type="text" value={fidelityChecks[i]?.fidelity_percentage ?? ""} onChange={(e) => updateFidelity(i, "fidelity_percentage", e.target.value)} placeholder="e.g. 92%" className={inputClass} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Components Observed</label>
                    <textarea value={fidelityChecks[i]?.components_observed ?? ""} onChange={(e) => updateFidelity(i, "components_observed", e.target.value)}
                      placeholder="Which BIP components were observed? (e.g. antecedent strategies, reinforcement delivery, data collection)" rows={2} className={inputClass} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Areas of Concern</label>
                    <textarea value={fidelityChecks[i]?.areas_of_concern ?? ""} onChange={(e) => updateFidelity(i, "areas_of_concern", e.target.value)}
                      placeholder="Any areas where implementation was incorrect or inconsistent..." rows={2} className={inputClass} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Follow-up Plan</label>
                    <textarea value={fidelityChecks[i]?.follow_up_plan ?? ""} onChange={(e) => updateFidelity(i, "follow_up_plan", e.target.value)}
                      placeholder="Action items, retraining needed, next check date..." rows={2} className={inputClass} />
                  </div>
                </div>
              </Section>
            </div>
          ))}
        </div>
      )}

      {/* STEP 9 — CAREGIVER TRAINING */}
      {currentStep === 9 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Caregiver Training Plan</h2>
              <p className="text-xs text-gray-500">Required for insurance reauthorization</p>
            </div>
            <Button variant="outline" onClick={() => addItem<CaregiverTraining>(setCaregiverTraining, { training_topic: "", training_method: "BST", caregiver_name: "", trainer_name: "", completion_date: "", completed: false, notes: "" })}>
              + Add Training
            </Button>
          </div>
          {caregiverTraining.map((training, i) => (
            <Section key={i} title={`Training ${i + 1}${training.training_topic ? ` — ${training.training_topic}` : ""}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Training Topic *</label>
                  <select value={training.training_topic} onChange={(e) => updateItem<CaregiverTraining>(setCaregiverTraining, i, "training_topic", e.target.value)} className={inputClass}>
                    <option value="">Select topic...</option>
                    {TRAINING_TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
                    <option value="Custom">Custom topic...</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Training Method</label>
                  <select value={training.training_method} onChange={(e) => updateItem<CaregiverTraining>(setCaregiverTraining, i, "training_method", e.target.value)} className={inputClass}>
                    {TRAINING_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Caregiver Name</label>
                  <input type="text" value={training.caregiver_name} onChange={(e) => updateItem<CaregiverTraining>(setCaregiverTraining, i, "caregiver_name", e.target.value)} placeholder="Name of caregiver trained" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Trainer Name</label>
                  <input type="text" value={training.trainer_name} onChange={(e) => updateItem<CaregiverTraining>(setCaregiverTraining, i, "trainer_name", e.target.value)} placeholder="BCBA or clinician" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Completion Date</label>
                  <input type="date" value={training.completion_date} onChange={(e) => updateItem<CaregiverTraining>(setCaregiverTraining, i, "completion_date", e.target.value)} className={inputClass} />
                </div>
                <div className="flex items-center gap-3 mt-4">
                  <button type="button" onClick={() => updateItem<CaregiverTraining>(setCaregiverTraining, i, "completed", !training.completed)}
                    className={`w-12 h-6 rounded-full transition-all relative ${training.completed ? "bg-green-500" : "bg-gray-300"}`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${training.completed ? "left-7" : "left-1"}`} />
                  </button>
                  <span className="text-sm text-gray-700">{training.completed ? "✓ Completed" : "Not yet completed"}</span>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
                  <textarea value={training.notes} onChange={(e) => updateItem<CaregiverTraining>(setCaregiverTraining, i, "notes", e.target.value)} rows={2} placeholder="Training notes, caregiver feedback..." className={inputClass} />
                </div>
              </div>
              {caregiverTraining.length > 1 && (
                <button type="button" onClick={() => removeItem<CaregiverTraining>(setCaregiverTraining, i)} className="mt-3 text-xs text-red-500 hover:text-red-700">Remove this training</button>
              )}
            </Section>
          ))}
        </div>
      )}

      {/* STEP 10 — FINAL SUMMARY */}
      {currentStep === 10 && (
        <Section title="📋 BIP Summary Before Saving">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            {[
              { label: "Target Behaviors", value: targetBehaviors.filter((b) => b.behavior_name).length, color: "text-red-500" },
              { label: "Antecedent Strategies", value: antecedentStrategies.filter((s) => s.strategy_name).length, color: "text-blue-600" },
              { label: "Consequence Strategies", value: consequenceStrategies.filter((s) => s.strategy_name).length, color: "text-purple-600" },
              { label: "Skill Programs", value: skillPrograms.filter((p) => p.program_name).length, color: "text-green-600" },
              { label: "Replacement Behaviors", value: replacementBehaviors.filter((r) => r.behavior_name).length, color: "text-orange-500" },
              { label: "Caregiver Trainings", value: caregiverTraining.filter((t) => t.training_topic).length, color: "text-teal-600" },
              { label: "Fidelity Checks", value: fidelityChecks.filter((f) => f.check_date).length, color: "text-yellow-600" },
              { label: "Medications", value: medications.filter((m) => m.name).length, color: "text-pink-600" },
              { label: "LMN Obtained", value: lmnObtained ? "Yes" : "No", color: lmnObtained ? "text-green-600" : "text-red-500" },
              { label: "FBA Completed", value: fbaCompleted ? "Yes" : "No", color: fbaCompleted ? "text-green-600" : "text-orange-500" },
              { label: "Hours/Week", value: recommendedHours, color: "text-blue-600" },
            ].map((item) => (
              <div key={item.label} className="border rounded-lg p-3 bg-white">
                <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* NAV BUTTONS */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-100">
        <Button variant="outline" onClick={() => setCurrentStep((s) => Math.max(1, s - 1))} disabled={currentStep === 1}>← Previous</Button>
        <span className="text-sm text-gray-400">{currentStep} / {TOTAL_STEPS}</span>
        {currentStep < TOTAL_STEPS ? (
          <Button onClick={() => setCurrentStep((s) => Math.min(TOTAL_STEPS, s + 1))} disabled={currentStep === 1 && !clientId}>Next →</Button>
        ) : (
          <Button onClick={handleSave} loading={saving} disabled={!clientId || saving}>💾 Save BIP</Button>
        )}
      </div>
    </div>
  );
}
