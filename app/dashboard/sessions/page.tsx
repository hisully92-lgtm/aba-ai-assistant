"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Session = {
  id: string;
  staff_member: string;
  client_name: string;
  date: string;
  location: string;
  duration: string;
  people_present: string;
  programs_targeted: string;
  behaviors_observed: string;
  interventions_used: string;
  client_response: string;
  next_session_plan: string;
};

const emptyForm: Omit<Session, "id"> = {
  staff_member: "",
  client_name: "",
  date: "",
  location: "",
  duration: "",
  people_present: "",
  programs_targeted: "",
  behaviors_observed: "",
  interventions_used: "",
  client_response: "",
  next_session_plan: "",
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    setLoading(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

    if (error) console.error(error.message);

    setSessions(data ?? []);
    setLoading(false);
  }

  async function handleSave() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error } = await supabase
      .from("sessions")
      .insert([
        {
          ...form,
          created_by: user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error(error.message);
      return;
    }

    if (data) setSessions((prev) => [data, ...prev]);
    setForm(emptyForm);
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      <h2 className="text-2xl font-bold mb-2">Session Notes</h2>

      <p className="text-gray-600 mb-6">
        Create structured ABA session documentation.
      </p>

      <div className="flex flex-col gap-4">
        {(Object.keys(form) as (keyof typeof form)[]).map((key) => (
          <input
            key={key}
            value={form[key]}
            onChange={(e) =>
              setForm({ ...form, [key]: e.target.value })
            }
            placeholder={key.replaceAll("_", " ")}
            className="border rounded-lg p-3"
          />
        ))}

        <button
          onClick={handleSave}
          className="bg-black text-white rounded-lg p-3 font-medium"
        >
          Save Session
        </button>
      </div>
    </div>
  );
}