"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type HistoryItem = {
  id: string;
  type: "client" | "session" | "behavior" | "program";
  title: string;
  created_at: string;
};

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [filters, setFilters] = useState({
    client: "",
    date: "",
    type: "",
    staff: "",
  });

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [sessions, behaviors, programs] = await Promise.all([
      supabase.from("sessions").select("id, client_name, created_at").eq("created_by", user.id),
      supabase.from("behaviors").select("id, behavior_name, created_at").eq("created_by", user.id),
      supabase.from("programs").select("id, program_name, created_at").eq("created_by", user.id),
    ]);

    const combined: HistoryItem[] = [
      ...(sessions.data ?? []).map((s) => ({
        id: s.id,
        type: "session" as const,
        title: s.client_name || "Session",
        created_at: s.created_at,
      })),
      ...(behaviors.data ?? []).map((b) => ({
        id: b.id,
        type: "behavior" as const,
        title: b.behavior_name || "Behavior",
        created_at: b.created_at,
      })),
      ...(programs.data ?? []).map((p) => ({
        id: p.id,
        type: "program" as const,
        title: p.program_name || "Program",
        created_at: p.created_at,
      })),
    ];

    setHistory(combined);
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      <h2 className="text-2xl font-bold mb-2">History</h2>
      <p className="text-gray-600 mb-6">Review all records.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input className="border p-3 rounded-lg" placeholder="Client" />
        <input type="date" className="border p-3 rounded-lg" />
      </div>

      <div className="mt-6 space-y-2">
        {history.map((item) => (
          <div key={item.id} className="p-3 border rounded-lg">
            <p className="font-medium">{item.title}</p>
            <p className="text-sm text-gray-500">
              {item.type} • {new Date(item.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}