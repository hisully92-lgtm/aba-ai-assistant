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
  client_id?: string;
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

export default function SessionsPage({
  params,
}: {
  params?: { id: string };
}) {
  const clientId = params?.id; // safe optional
  const [sessions, setSessions] = useState<Session[]>([]);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    let query = supabase
      .from("sessions")
      .select("*")
      .eq("created_by", user.id);

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) console.error(error.message);

    setSessions(data ?? []);
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
          client_id: clientId ?? null,
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
          className="bg-black text-white rounded-lg p-3"
        >
          Save Session
        </button>
      </div>
    </div>
  );
}