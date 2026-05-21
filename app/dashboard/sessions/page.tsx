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

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
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
  });

  // -------------------------
  // LOAD
  // -------------------------
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

    if (error) {
      console.error(error.message);
    }

    setSessions(data ?? []);
    setLoading(false);
  }

  // -------------------------
  // SAVE
  // -------------------------
  async function handleSave() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error } = await supabase
      .from("sessions")
      .insert([{ ...form, created_by: user.id }])
      .select()
      .single();

    if (error) {
      console.error(error.message);
      return;
    }

    if (data) {
      setSessions((prev) => [data, ...prev]);
    }

    // reset
    setForm({
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
    });
  }

  // -------------------------
  // UI
  // -------------------------
  return (
    <div className="bg-white rounded-2xl shadow p-6 border">

      <h2 className="text-2xl font-bold mb-2">
        Session Notes
      </h2>

      <p className="text-gray-600 mb-6">
        Create clear ABA session notes from structured session details.
      </p>

      <div className="flex flex-col gap-4">

        {Object.entries(form).map(([key, value]) => (
          <input
            key={key}
            value={value}
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
          Generate Session Note
        </button>

      </div>

    </div>
  );
}