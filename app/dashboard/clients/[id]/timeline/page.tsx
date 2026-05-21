"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type TimelineItem = {
  id: string;
  type: "session" | "behavior" | "program";
  title: string;
  created_at: string;
};

export default function ClientTimelinePage({
  params,
}: {
  params: { id: string };
}) {
  const clientId = params.id;

  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTimeline();
  }, []);

  async function fetchTimeline() {
    setLoading(true);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;

      if (!user) {
        setTimeline([]);
        return;
      }

      const [sessionsRes, behaviorsRes, programsRes] = await Promise.all([
        supabase
          .from("sessions")
          .select("id, client_name, created_at, client_id")
          .eq("created_by", user.id)
          .eq("client_id", clientId),

        supabase
          .from("behaviors")
          .select("id, behavior_name, created_at, client_id")
          .eq("created_by", user.id)
          .eq("client_id", clientId),

        supabase
          .from("programs")
          .select("id, program_name, created_at, client_id")
          .eq("created_by", user.id)
          .eq("client_id", clientId),
      ]);

      const sessions = sessionsRes.data ?? [];
      const behaviors = behaviorsRes.data ?? [];
      const programs = programsRes.data ?? [];

      const merged: TimelineItem[] = [
        ...sessions.map((s) => ({
          id: s.id,
          type: "session" as const,
          title: s.client_name || "Session",
          created_at: s.created_at,
        })),

        ...behaviors.map((b) => ({
          id: b.id,
          type: "behavior" as const,
          title: b.behavior_name || "Behavior",
          created_at: b.created_at,
        })),

        ...programs.map((p) => ({
          id: p.id,
          type: "program" as const,
          title: p.program_name || "Program",
          created_at: p.created_at,
        })),
      ];

      merged.sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );

      setTimeline(merged);
    } catch (err) {
      console.error("Timeline fetch error:", err);
      setTimeline([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      <h2 className="text-2xl font-bold mb-2">Client Timeline</h2>
      <p className="text-gray-600 mb-6">
        Full chronological history of sessions, behaviors, and programs.
      </p>

      {loading ? (
        <p className="text-gray-500">Loading timeline...</p>
      ) : timeline.length === 0 ? (
        <p className="text-gray-500">No timeline data yet.</p>
      ) : (
        <div className="space-y-3">
          {timeline.map((item) => (
            <div key={`${item.type}-${item.id}`} className="p-3 border rounded-lg bg-gray-50">
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-gray-500">
                {item.type} •{" "}
                {new Date(item.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}