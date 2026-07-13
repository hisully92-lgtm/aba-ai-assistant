"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import AppShell from "@/components/app/AppShell";

type Client = { id: string; full_name: string };
type ActiveSession = { id: string; room_name: string; status: string };

export default function TelehealthAppPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordSession, setRecordSession] = useState(false);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [checkingActive, setCheckingActive] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (!clientId) {
      setActiveSession(null);
      return;
    }
    checkActiveSession(clientId);
  }, [clientId]);

  async function loadClients() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!companyUser) {
      setLoading(false);
      return;
    }

    const isPrivileged = companyUser.role === "admin" || companyUser.role === "bcba";

    if (isPrivileged) {
      const { data } = await supabase
        .from("clients")
        .select("id, full_name")
        .eq("company_id", companyUser.company_id)
        .order("full_name");
      setClients(data ?? []);
    } else {
      const { data } = await supabase
        .from("client_assignments")
        .select("client_id, clients(id, full_name)")
        .eq("user_id", user.id);
      const assigned = (data ?? [])
        .map((row: any) => row.clients)
        .filter(Boolean)
        .sort((a: Client, b: Client) => a.full_name.localeCompare(b.full_name));
      setClients(assigned);
    }

    setLoading(false);
  }

  async function checkActiveSession(selectedClientId: string) {
    setCheckingActive(true);
    setActiveSession(null);
    const { data } = await supabase
      .from("telehealth_video_sessions")
      .select("id, room_name, status")
      .eq("client_id", selectedClientId)
      .in("status", ["scheduled", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveSession(data ?? null);
    setCheckingActive(false);
  }

  const joinExisting = () => {
    if (!activeSession) return;
    router.push(`/app/telehealth/room/${activeSession.room_name}?sessionId=${activeSession.id}`);
  };

  const startSession = async () => {
    if (!clientId) {
      setError("Select a client to start a session");
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Not authenticated");
        setStarting(false);
        return;
      }

      const res = await fetch("/api/video/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ clientId, recordSession }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to start session");
      }

      const { roomName, session: createdSession } = await res.json();
      router.push(`/app/telehealth/room/${roomName}?sessionId=${createdSession.id}`);
    } catch (err: any) {
      console.error("Failed to start session:", err);
      setError(err.message || "Failed to start session");
      setStarting(false);
    }
  };

  return (
    <AppShell title="Telehealth">
      <div className="px-5 py-6 space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm" style={{ color: "#94a3b8" }}>Start a video session with a client.</p>
          <a href="/app/telehealth/history" className="text-xs font-medium" style={{ color: "#60a5fa" }}>
            History →
          </a>
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1.5" style={{ color: "#94a3b8" }}>Client</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={loading}
            className="w-full rounded-xl px-3 py-3 text-sm"
            style={{ backgroundColor: "#1a2234", color: "#e2e8f0", border: "1px solid #2a3a54" }}
          >
            <option value="">
              {loading ? "Loading clients..." : clients.length === 0 ? "No assigned clients" : "Select client..."}
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.full_name}</option>
            ))}
          </select>
        </div>

        {checkingActive && <p className="text-xs" style={{ color: "#64748b" }}>Checking for an active session...</p>}

        {activeSession && !checkingActive && (
          <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "#1e3a5f" }}>
            <p className="text-sm font-medium" style={{ color: "#93c5fd" }}>
              A telehealth session for this client is already {activeSession.status === "in_progress" ? "in progress" : "scheduled"}.
            </p>
            <button
              onClick={joinExisting}
              className="w-full py-3 rounded-xl text-white font-bold text-sm"
              style={{ backgroundColor: "#2563eb" }}
            >
              Join Existing Session
            </button>
          </div>
        )}

        {!activeSession && !checkingActive && (
          <>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={recordSession}
                onChange={(e) => setRecordSession(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm" style={{ color: "#cbd5e1" }}>Record this session</span>
            </label>

            {error && <p className="text-sm" style={{ color: "#fca5a5" }}>{error}</p>}

            <button
              onClick={startSession}
              disabled={starting || loading || !clientId}
              className="w-full py-3.5 rounded-xl text-white font-bold text-sm disabled:opacity-50"
              style={{ backgroundColor: "#2563eb" }}
            >
              {starting ? "Starting..." : "Start Video Session"}
            </button>
          </>
        )}
      </div>
    </AppShell>
  );
}
