"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Program = {
  id: string;
  staff_member: string;
  program_name: string;
  goal: string;
  targets: string;
  prompt_level: string;
  mastery_criteria: string;
  trial_data: string;
  notes: string;
};

const emptyForm = {
  staff_member: "",
  program_name: "",
  goal: "",
  targets: "",
  prompt_level: "",
  mastery_criteria: "",
  trial_data: "",
  notes: "",
};

export default function ProgramsPage({
  params,
}: {
  params: { id: string };
}) {
  const clientId = params.id;

  const [programs, setPrograms] = useState<Program[]>([]);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetchPrograms();
  }, []);

  async function fetchPrograms() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase
      .from("programs")
      .select("*")
      .eq("created_by", user.id)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    setPrograms(data ?? []);
  }

  async function handleSave() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error } = await supabase
      .from("programs")
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

    if (data) setPrograms((prev) => [data, ...prev]);

    setForm(emptyForm);
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      <h2 className="text-2xl font-bold mb-2">Skill Programs</h2>

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
          Save Skill Program
        </button>
      </div>
    </div>
  );
}