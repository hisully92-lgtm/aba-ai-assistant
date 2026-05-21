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

const emptyForm = {
  staff_member: "",
  behavior_name: "",
  antecedent: "",
  behavior: "",
  consequence: "",
  frequency: "",
  duration: "",
  intensity: "",
  function_hypothesis: "",
  intervention_used: "",
  replacement_behavior: "",
};

export default function BehaviorsPage({
  params,
}: {
  params: { id: string };
}) {
  const clientId = params.id;

  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetchBehaviors();
  }, []);

  async function fetchBehaviors() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase
      .from("behaviors")
      .select("*")
      .eq("created_by", user.id)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    setBehaviors(data ?? []);
  }

  async function handleSave() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error } = await supabase
      .from("behaviors")
      .insert([
        {
          ...form,
          client_id: clientId,
          created_by: user.id,
        },
      ])
      .select()
      .single();

    if (error) return console.error(error.message);

    if (data) setBehaviors((prev) => [data, ...prev]);

    setForm(emptyForm);
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      <h2 className="text-2xl font-bold mb-2">Behavior Interventions</h2>

      <p className="text-gray-600 mb-6">
        Collect ABC data and intervention tracking.
      </p>

      <div className="flex flex-col gap-4">
        {(Object.entries(form) as [keyof typeof form, string][]).map(
          ([key, value]) => (
            <textarea
              key={key}
              value={value}
              onChange={(e) =>
                setForm({ ...form, [key]: e.target.value })
              }
              placeholder={key.replaceAll("_", " ")}
              className="border rounded-lg p-3"
            />
          )
        )}

        <button
          onClick={handleSave}
          className="bg-black text-white rounded-lg p-3 font-medium"
        >
          Generate Intervention Plan
        </button>
      </div>
    </div>
  );
}