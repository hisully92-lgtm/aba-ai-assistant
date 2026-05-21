"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Client = {
  id: string;
  full_name: string;
};

type TreatmentPlan = {
  id: string;
  goal: string;
  current_progress: number;
  mastery_criteria: number;
  status: string;
};

export default function TreatmentPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState("");

  const [goal, setGoal] = useState("");
  const [baseline, setBaseline] = useState(0);
  const [criteria, setCriteria] = useState(80);

  const [plans, setPlans] = useState<TreatmentPlan[]>([]);

  // LOAD CLIENTS
  async function loadClients() {
    const { data } = await supabase.from("clients").select("*");
    setClients(data || []);
  }

  // LOAD TREATMENT PLANS
  async function loadPlans(clientId: string) {
    setSelectedClient(clientId);

    const { data } = await supabase
      .from("treatment_plans")
      .select("*")
      .eq("client_id", clientId);

    setPlans(data || []);
  }

  useEffect(() => {
    loadClients();
  }, []);

  // CREATE GOAL
  async function createPlan() {
    if (!selectedClient || !goal) return;

    const user = await supabase.auth.getUser();

    const { error } = await supabase.from("treatment_plans").insert({
      client_id: selectedClient,
      created_by: user.data.user?.id,
      goal,
      baseline,
      mastery_criteria: criteria,
      current_progress: baseline,
      status: "in_progress",
    });

    if (error) {
      alert(error.message);
      return;
    }

    setGoal("");
    setBaseline(0);
    setCriteria(80);

    loadPlans(selectedClient);
  }

  // UPDATE PROGRESS
  async function updateProgress(planId: string, value: number) {
    const { error } = await supabase
      .from("treatment_plans")
      .update({
        current_progress: value,
        status: value >= criteria ? "mastered" : "in_progress",
      })
      .eq("id", planId);

    if (error) {
      alert(error.message);
      return;
    }

    loadPlans(selectedClient);
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Treatment Plan System</h1>

      {/* CLIENT SELECT */}
      <div style={{ marginBottom: 20 }}>
        <h2>Select Client</h2>

        {clients.map((c) => (
          <button
            key={c.id}
            onClick={() => loadPlans(c.id)}
            style={{
              marginRight: 10,
              padding: 8,
              border: "1px solid #ccc",
            }}
          >
            {c.full_name}
          </button>
        ))}
      </div>

      {/* CREATE GOAL */}
      {selectedClient && (
        <div style={{ marginBottom: 20 }}>
          <h2>Create Treatment Goal</h2>

          <input
            placeholder="Goal description"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            style={{ marginRight: 10 }}
          />

          <input
            type="number"
            placeholder="Baseline"
            value={baseline}
            onChange={(e) => setBaseline(Number(e.target.value))}
            style={{ marginRight: 10 }}
          />

          <input
            type="number"
            placeholder="Mastery Criteria (%)"
            value={criteria}
            onChange={(e) => setCriteria(Number(e.target.value))}
          />

          <button onClick={createPlan}>Add Goal</button>
        </div>
      )}

      {/* LIST PLANS */}
      <div>
        <h2>Treatment Goals</h2>

        {plans.map((p) => (
          <div
            key={p.id}
            style={{
              padding: 10,
              border: "1px solid #ddd",
              marginBottom: 10,
            }}
          >
            <h3>{p.goal}</h3>

            <p>Status: {p.status}</p>

            <p>
              Progress: {p.current_progress} / {p.mastery_criteria}
            </p>

            <input
              type="number"
              placeholder="Update progress"
              onChange={(e) =>
                updateProgress(p.id, Number(e.target.value))
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}