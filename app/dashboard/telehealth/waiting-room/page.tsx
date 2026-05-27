"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type WaitingRoomEntry = {
  id: string;
  client_name: string;
  session_type: string;
  wait_start: string;
  status: string;
  room_url: string | null;
  notes: string | null;
};

const SESSION_TYPES = ["Individual ABA", "Parent Training", "Supervision", "Team Meeting", "Assessment", "Consultation"];

export default function TelehealthWaitingRoomPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [waitingRoom, setWaitingRoom] = useState<WaitingRoomEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [clientId, setClientId] = useState("");
  const [sessionType, setSessionType] = useState("Individual ABA");
  const [notes, setNotes] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    init();
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const { data } = await supabase.from("clients").select("id, full_name");
    setClients(data ?? []);
    setLoading(false);
  }

  async function createRoom() {
    if (!clientId) return;
    setCreating(true);

    const client = clients.find((c) => c.id === clientId);

    // Call video room creation API
    const res = await fetch("/api/video/create-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: `${clientId}-${Date.now()}`,
        clientName: client?.full_name,
        duration: 120,
      }),
    });

    const data = await res.json();

    const newEntry: WaitingRoomEntry = {
      id: Date.now().toString(),
      client_name: client?.full_name ?? "Unknown",
      session_type: sessionType,
      wait_start: new Date().toISOString(),
      status: "waiting",
      room_url: data.room_url ?? null,
      notes: notes || null,
    };

    setWaitingRoom((prev) => [...prev, newEntry]);
    setClientId("");
    setNotes("");
    setShowForm(false);
    setCreating(false);
  }

  function admitClient(id: string) {
    setWaitingRoom((prev) => prev.map((e) => e.id === id ? { ...e, status: "in_session" } : e));
  }

  function removeFromRoom(id: string) {
    setWaitingRoom((prev) => prev.filter((e) => e.id !== id));
  }

  function waitTime(startTime: string): string {
    const mins = Math.floor((currentTime.getTime() - new Date(startTime).getTime()) / (1000 * 60));
    if (mins < 1) return "Just joined";
    if (mins === 1) return "1 min";
    return `${mins} mins`;
  }

  const waiting = waitingRoom.filter((e) => e.status === "waiting");
  const inSession = waitingRoom.filter((e) => e.status === "in_session");

  return (
    <div className="space-y-6">
      <PageHeader title="Telehealth Waiting Room">
        <div className="flex gap-2 items-center">
          <div className={`w-3 h-3 rounded-full ${waiting.length > 0 ? "bg-orange-500 animate-pulse" : "bg-green-500"}`} />
          <span className="text-sm text-gray-600">{waiting.length} waiting · {inSession.length} in session</span>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Add Client"}
          </Button>
        </div>
      </PageHeader>

      {/* TELEHEALTH STATUS */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm font-bold text-blue-800">Telehealth Session Manager</p>
            <p className="text-xs text-blue-600 mt-0.5">
              {waiting.length === 0 && inSession.length === 0
                ? "No active sessions — waiting room is empty"
                : `${waiting.length} client${waiting.length !== 1 ? "s" : ""} waiting · ${inSession.length} in session`}
            </p>
          </div>
          <p className="text-sm text-blue-600 font-medium">
            {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>

      {/* ADD CLIENT FORM */}
      {showForm && (
        <Section title="Add Client to Waiting Room">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Session Type</label>
              <select value={sessionType} onChange={(e) => setSessionType(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                {SESSION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Session notes or instructions..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={createRoom} loading={creating} disabled={!clientId}>
              🎥 Create Room & Add to Queue
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* WAITING */}
      {waiting.length > 0 && (
        <Section title={`⏳ Waiting (${waiting.length})`}>
          <div className="space-y-3">
            {waiting.map((entry) => (
              <div key={entry.id} className="border border-orange-200 rounded-xl p-4 bg-orange-50">
                <div className="flex justify-between items-start flex-wrap gap-3">
                  <div>
                    <p className="font-semibold text-gray-800">{entry.client_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {entry.session_type} · Waiting {waitTime(entry.wait_start)}
                    </p>
                    {entry.notes && <p className="text-xs text-gray-500 mt-0.5">{entry.notes}</p>}
                  </div>
                  <div className="flex gap-2">
                    {entry.room_url && (
                      <a href={entry.room_url} target="_blank" rel="noopener noreferrer">
                        <Button>🎥 Join Room</Button>
                      </a>
                    )}
                    <Button variant="outline" onClick={() => admitClient(entry.id)}>Admit</Button>
                    <button onClick={() => removeFromRoom(entry.id)}
                      className="text-gray-400 hover:text-red-400 text-xs">✕</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* IN SESSION */}
      {inSession.length > 0 && (
        <Section title={`🟢 In Session (${inSession.length})`}>
          <div className="space-y-3">
            {inSession.map((entry) => (
              <div key={entry.id} className="border border-green-200 rounded-xl p-4 bg-green-50">
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <div>
                    <p className="font-semibold text-gray-800">{entry.client_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {entry.session_type} · Started {waitTime(entry.wait_start)} ago
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {entry.room_url && (
                      <a href={entry.room_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline">🎥 Rejoin</Button>
                      </a>
                    )}
                    <Button variant="danger" onClick={() => removeFromRoom(entry.id)}>End Session</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {!loading && waiting.length === 0 && inSession.length === 0 && (
        <Section title="Waiting Room Empty">
          <div className="text-center py-8">
            <p className="text-4xl mb-3">🎥</p>
            <p className="text-gray-500 text-sm">No clients in the waiting room.</p>
            <p className="text-gray-400 text-xs mt-1">Click "+ Add Client" to create a telehealth session and add them to the queue.</p>
          </div>
        </Section>
      )}

      {/* SETUP NOTE */}
      {!process.env.NEXT_PUBLIC_DAILY_CONFIGURED && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-xs text-yellow-700">
          <p className="font-bold mb-1">⚙️ Daily.co Not Configured</p>
          <p>Video rooms will use placeholder URLs until Daily.co is configured. Add DAILY_API_KEY to your environment variables to activate live video rooms.</p>
          <a href="/dashboard/admin/integrations" className="text-blue-500 underline mt-1 inline-block">Configure integrations →</a>
        </div>
      )}
    </div>
  );
}