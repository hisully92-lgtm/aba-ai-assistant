"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Behavior = {
  id: string;
  staff_member: string;
  behavior_name: string;
  antecedent: string;
  behavior: string;
  consequence: string;
  frequency: string;
  duration: string;
  intensity: string;
  function_hypothesis: string;
  intervention_used: string;
  replacement_behavior: string;
};

export default function BehaviorsPage() {
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);

  // FORM STATE
  const [staffMember, setStaffMember] = useState("");
  const [behaviorName, setBehaviorName] = useState("");
  const [antecedent, setAntecedent] = useState("");
  const [behavior, setBehavior] = useState("");
  const [consequence, setConsequence] = useState("");
  const [frequency, setFrequency] = useState("");
  const [duration, setDuration] = useState("");
  const [intensity, setIntensity] = useState("");
  const [functionHypothesis, setFunctionHypothesis] = useState("");
  const [interventionUsed, setInterventionUsed] = useState("");
  const [replacementBehavior, setReplacementBehavior] = useState("");

  // -------------------------
  // LOAD BEHAVIORS
  // -------------------------
  useEffect(() => {
    fetchBehaviors();
  }, []);

  async function fetchBehaviors() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;

    if (!user) return;

    const { data, error } = await supabase
      .from("behaviors")
      .select("*")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch behaviors error:", error.message);
      return;
    }

    setBehaviors(data ?? []);
  }

  // -------------------------
  // SAVE BEHAVIOR
  // -------------------------
  async function handleSaveBehavior() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;

    if (!user) return;

    const { data, error } = await supabase
      .from("behaviors")
      .insert([
        {
          staff_member: staffMember,
          behavior_name: behaviorName,
          antecedent,
          behavior,
          consequence,
          frequency,
          duration,
          intensity,
          function_hypothesis: functionHypothesis,
          intervention_used: interventionUsed,
          replacement_behavior: replacementBehavior,
          created_by: user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Save behavior error:", error.message);
      return;
    }

    if (data) {
      setBehaviors((prev) => [data, ...prev]);
    }

    // reset form
    setStaffMember("");
    setBehaviorName("");
    setAntecedent("");
    setBehavior("");
    setConsequence("");
    setFrequency("");
    setDuration("");
    setIntensity("");
    setFunctionHypothesis("");
    setInterventionUsed("");
    setReplacementBehavior("");
  }

  // -------------------------
  // UI (UNCHANGED DESIGN)
  // -------------------------
  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      <h2 className="text-2xl font-bold mb-2">
        Behavior Interventions
      </h2>

      <p className="text-gray-600 mb-6">
        Collect behavior data and generate intervention recommendations from ABC details.
      </p>

      <div className="flex flex-col gap-4">

        <input value={staffMember} onChange={(e) => setStaffMember(e.target.value)} placeholder="Staff Member" className="border rounded-lg p-3" />

        <input value={behaviorName} onChange={(e) => setBehaviorName(e.target.value)} placeholder="Behavior Name" className="border rounded-lg p-3" />

        <textarea value={antecedent} onChange={(e) => setAntecedent(e.target.value)} placeholder="Antecedent" className="border rounded-lg p-3 min-h-[100px]" />

        <textarea value={behavior} onChange={(e) => setBehavior(e.target.value)} placeholder="Behavior" className="border rounded-lg p-3 min-h-[100px]" />

        <textarea value={consequence} onChange={(e) => setConsequence(e.target.value)} placeholder="Consequence" className="border rounded-lg p-3 min-h-[100px]" />

        <input value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="Frequency" className="border rounded-lg p-3" />

        <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Duration" className="border rounded-lg p-3" />

        <input value={intensity} onChange={(e) => setIntensity(e.target.value)} placeholder="Intensity" className="border rounded-lg p-3" />

        <textarea value={functionHypothesis} onChange={(e) => setFunctionHypothesis(e.target.value)} placeholder="Function Hypothesis" className="border rounded-lg p-3 min-h-[100px]" />

        <textarea value={interventionUsed} onChange={(e) => setInterventionUsed(e.target.value)} placeholder="Intervention Used" className="border rounded-lg p-3 min-h-[100px]" />

        <textarea value={replacementBehavior} onChange={(e) => setReplacementBehavior(e.target.value)} placeholder="Replacement Behavior" className="border rounded-lg p-3 min-h-[100px]" />

        <button
          onClick={handleSaveBehavior}
          className="bg-black text-white rounded-lg p-3 font-medium"
        >
          Generate Intervention Plan
        </button>

      </div>
    </div>
  );
}