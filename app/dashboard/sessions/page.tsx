"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useFeatureAccess } from "@/lib/hooks/useFeatureAccess";
import Button from "@/components/ui/Button";

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
  const clientId = params?.id;

  // 🔒 FEATURE GATING (Step 5 system)
  const { hasAccess } = useFeatureAccess("sessions");

  const [sessions, setSessions] = useState<Session[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hasAccess) fetchSessions();
  }, [hasAccess]);

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
    setLoading(true);

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
      setLoading(false);
      return;
    }

    if (data) setSessions((prev) => [data, ...prev]);

    setForm(emptyForm);
    setLoading(false);
  }

  // 🔒 ACCESS BLOCK
  if (!hasAccess) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Sessions Locked</h2>
        <p>Upgrade to Pro to access session notes.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      <h2 className="text-2xl font-bold mb-4">
        Session Notes
      </h2>

      {/* FORM */}
      <div className="flex flex-col gap-4">
        {(Object.keys(form) as (keyof typeof form)[]).map(
          (key) => (
            <input
              key={key}
              value={form[key]}
              onChange={(e) =>
                setForm({
                  ...form,
                  [key]: e.target.value,
                })
              }
              placeholder={key.replaceAll("_", " ")}
              className="border rounded-lg p-3"
            />
          )
        )}

        <Button
          onClick={handleSave}
          loading={loading}
          fullWidth
        >
          Save Session
        </Button>
      </div>

      {/* SESSION LIST (READY FOR NEXT STEP) */}
      <div className="mt-6 space-y-3">
        {sessions.map((s) => (
          <div
            key={s.id}
            className="border rounded-lg p-3"
          >
            <p className="font-semibold">
              {s.client_name}
            </p>
            <p className="text-sm text-gray-500">
              {s.date} • {s.location}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}