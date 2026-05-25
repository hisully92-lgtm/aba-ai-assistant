"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useFeatureAccess } from "@/lib/hooks/useFeatureAccess";
import SessionNoteForm from "./components/SessionNoteForm";

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

export default function SessionsPage({
  params,
}: {
  params?: { id: string };
}) {
  const clientId = params?.id;
  const { hasAccess } = useFeatureAccess("sessions");

  const [sessions, setSessions] = useState<Session[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return;
      setUserId(user.id);
      if (hasAccess) fetchSessions(user.id);
    }
    init();
  }, [hasAccess]);

  async function fetchSessions(uid: string) {
    const res = await fetch(
      `/api/sessions${clientId ? `?client_id=${clientId}` : ""}`,
      { method: "GET" }
    );

    const data = await res.json();
    if (res.ok) setSessions(data.data ?? []);
  }

  // ACCESS BLOCK
  if (!hasAccess) {
    return (
      <div className="bg-white rounded-2xl shadow p-6 border">
        <h2 className="text-2xl font-bold mb-2">Sessions Locked</h2>
        <p className="text-gray-500">Upgrade to Pro to access session notes.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      <h2 className="text-2xl font-bold mb-6">Session Notes</h2>

      {/* SESSION NOTE FORM */}
      {userId && (
        <SessionNoteForm
          clientId={clientId}
          userId={userId}
          onSaved={() => fetchSessions(userId)}
        />
      )}

      {/* SESSION LIST */}
      <div className="mt-8 space-y-3">
        {sessions.length === 0 && (
          <p className="text-gray-400 text-sm">No sessions yet.</p>
        )}
        {sessions.map((s) => (
          <div key={s.id} className="border rounded-lg p-4">
            <p className="font-semibold">{s.client_name}</p>
            <p className="text-sm text-gray-500">
              {s.date} • {s.location}
            </p>
            {s.behaviors_observed && (
              <p className="text-sm text-gray-600 mt-1">
                Behaviors: {s.behaviors_observed}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}