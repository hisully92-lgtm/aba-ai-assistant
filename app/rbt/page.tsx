"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { requireRole } from "@/lib/requireRole";

type Client = {
  id: string;
  full_name: string;
};

type SessionNote = {
  id: string;
  note: string;
  session_date: string;
};

type BehaviorLog = {
  id: string;
  behavior_type: string;
  frequency: number;
  duration_minutes: number;
};

export default function RbtPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState("");

  const [note, setNote] = useState("");
  const [behaviorType, setBehaviorType] = useState("");
  const [frequency, setFrequency] = useState(0);
  const [duration, setDuration] = useState(0);

  const [sessionNotes, setSessionNotes] = useState<SessionNote[]>([]);
  const [behaviorLogs, setBehaviorLogs] = useState<BehaviorLog[]>([]);

  // 🔐 ROLE PROTECTION
  useEffect(() => {
    requireRole(["admin", "supervisor", "student_analyst", "rbt"]);
  }, []);

  // 📦 LOAD ASSIGNED CLIENTS
  async function loadClients() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: assignments } = await supabase
      .from("assignments")
      .select("client_id")
      .eq("rbt_id", user?.id);

    if (!assignments) return;

    const clientIds = assignments.map((a) => a.client_id);

    const { data: clientsData } = await supabase
      .from("clients")
      .select("*")
      .in("id", clientIds);

    setClients(clientsData || []);
  }

  useEffect(() => {
    loadClients();
  }, []);

  // 📦 LOAD CLIENT DATA
  async function loadClientData(clientId: string) {
    setSelectedClient(clientId);

    const [{ data: notes }, { data: behaviors }] = await Promise.all([
      supabase
        .from("session_notes")
        .select("*")
        .eq("client_id", clientId),

      supabase
        .from("behavior_logs")
        .select("*")
        .eq("client_id", clientId),
    ]);

    setSessionNotes(notes || []);
    setBehaviorLogs(behaviors || []);
  }

  // 💾 SAVE SESSION NOTE
  async function saveNote() {
    if (!selectedClient || !note) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("session_notes").insert({
      client_id: selectedClient,
      rbt_id: user?.id,
      note,
    });

    setNote("");
    loadClientData(selectedClient);
  }

  // 💾 SAVE BEHAVIOR LOG
  async function saveBehavior() {
    if (!selectedClient || !behaviorType) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("behavior_logs").insert({
      client_id: selectedClient,
      rbt_id: user?.id,
      behavior_type: behaviorType,
      frequency,
      duration_minutes: duration,
    });

    setBehaviorType("");
    setFrequency(0);
    setDuration(0);
    loadClientData(selectedClient);
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>RBT Dashboard</h1>

      {/* CLIENT LIST */}
      <div style={{ marginBottom: 20 }}>
        <h2>My Clients</h2>

        {clients.map((c) => (
          <button
            key={c.id}
            onClick={() => loadClientData(c.id)}
            style={{
              marginRight: 10,
              padding: 8,
              border: "1px solid #ccc",
            }}
          >
            {c.full_name}
          </button>
        ))}
      </div>

      {/* SESSION NOTES */}
      <div style={{ marginBottom: 20 }}>
        <h2>Session Notes</h2>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Write session note..."
          style={{ width: "100%", height: 80 }}
        />

        <button onClick={saveNote}>Save Note</button>

        <ul>
          {sessionNotes.map((n) => (
            <li key={n.id}>{n.note}</li>
          ))}
        </ul>
      </div>

      {/* BEHAVIOR TRACKING */}
      <div style={{ marginBottom: 20 }}>
        <h2>Behavior Tracking</h2>

        <input
          placeholder="Behavior Type"
          value={behaviorType}
          onChange={(e) => setBehaviorType(e.target.value)}
        />

        <input
          type="number"
          placeholder="Frequency"
          value={frequency}
          onChange={(e) => setFrequency(Number(e.target.value))}
        />

        <input
          type="number"
          placeholder="Duration (min)"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
        />

        <button onClick={saveBehavior}>Save Behavior</button>

        <ul>
          {behaviorLogs.map((b) => (
            <li key={b.id}>
              {b.behavior_type} — {b.frequency} times — {b.duration_minutes} min
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}