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

  // filters (UI only for now)
  const [filterClient, setFilterClient] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStaff, setFilterStaff] = useState("");

  // -------------------------
  // LOAD HISTORY
  // -------------------------
  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;

    if (!user) return;

    // sessions
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, client_name, created_at")
      .eq("created_by", user.id);

    // behaviors
    const { data: behaviors } = await supabase
      .from("behaviors")
      .select("id, behavior_name, created_at")
      .eq("created_by", user.id);

    // programs
    const { data: programs } = await supabase
      .from("programs")
      .select("id, program_name, created_at")
      .eq("created_by", user.id);

    const combined: HistoryItem[] = [
      ...(sessions || []).map((s) => ({
        id: s.id,
        type: "session" as const,
        title: s.client_name || "Session",
        created_at: s.created_at,
      })),
      ...(behaviors || []).map((b) => ({
        id: b.id,
        type: "behavior" as const,
        title: b.behavior_name || "Behavior",
        created_at: b.created_at,
      })),
      ...(programs || []).map((p) => ({
        id: p.id,
        type: "program" as const,
        title: p.program_name || "Program",
        created_at: p.created_at,
      })),
    ];

    setHistory(combined);
  }

  // -------------------------
  // UI
  // -------------------------
  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      <h2 className="text-2xl font-bold mb-2">
        History
      </h2>

      <p className="text-gray-600 mb-6">
        Filter and review previous notes, behavior data, and skill programs.
      </p>

      {/* FILTERS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <input
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          placeholder="Filter by Client"
          className="border rounded-lg p-3"
        />

        <input
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          type="date"
          className="border rounded-lg p-3"
        />

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border rounded-lg p-3 bg-white"
        >
          <option value="">All Types</option>
          <option value="session">Session Notes</option>
          <option value="behavior">Behavior Interventions</option>
          <option value="program">Skill Programs</option>
        </select>

        <input
          value={filterStaff}
          onChange={(e) => setFilterStaff(e.target.value)}
          placeholder="Filter by Staff"
          className="border rounded-lg p-3"
        />
      </div>

      {/* HISTORY LIST */}
      <div className="mt-6 border rounded-xl p-4 bg-gray-50 space-y-2">
        {history.length === 0 ? (
          <p className="text-gray-500">
            No history yet.
          </p>
        ) : (
          history.map((item) => (
            <div key={item.id} className="p-3 bg-white rounded-lg border">
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-gray-500">
                {item.type} • {new Date(item.created_at).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}