"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CalendarClient({ sessions: initialSessions }: any) {
  const [sessions, setSessions] = useState(initialSessions);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);

  // =========================================================
  // DROPDOWN DATA (clients / locations / staff)
  // =========================================================
  const [clients, setClients] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);

  // =========================================================
  // CREATE SESSION STATE (REAL ABA STRUCTURE)
  // =========================================================
  const [newSession, setNewSession] = useState({
    client_id: "",
    location_id: "",
    staff_id: "",
    start_time: "",
    end_time: "",
  });

  // =========================================================
  // 1. REALTIME SYNC
  // =========================================================
  useEffect(() => {
    const channel = supabase
      .channel("sessions")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sessions",
        },
        (payload) => {
          const newRow = payload.new as any;
          const oldRow = payload.old as any;

          setSessions((prev: any[]) => {
            switch (payload.eventType) {
              case "INSERT":
                return [...prev, newRow];

              case "UPDATE":
                return prev.map((s) =>
                  s.id === newRow.id ? newRow : s
                );

              case "DELETE":
                return prev.filter((s) => s.id !== oldRow.id);

              default:
                return prev;
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // =========================================================
  // 2. LOAD DROPDOWNS
  // =========================================================
  useEffect(() => {
    const loadData = async () => {
      const { data: clientsData } = await supabase.from("clients").select("*");
      const { data: locationsData } = await supabase.from("locations").select("*");

      const { data: staffData } = await supabase
        .from("company_users")
        .select(`
          user_id,
          profiles(full_name)
        `);

      setClients(clientsData || []);
      setLocations(locationsData || []);
      setStaff(staffData || []);
    };

    loadData();
  }, []);

  // =========================================================
  // 3. CREATE SESSION (REAL SUPABASE INSERT)
  // =========================================================
  const handleCreateSession = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("sessions").insert({
      company_id: "fcb8cbb2-4136-4d02-ba09-5355cc888189",
      client_id: newSession.client_id,
      location_id: newSession.location_id,
      staff_id: newSession.staff_id,
      start_time: newSession.start_time,
      end_time: newSession.end_time,
      status: "scheduled",
      created_by: user?.id,
      color: "#3b82f6",
    });

    if (error) {
      console.error(error);
      return;
    }

    setShowCreate(false);
    setNewSession({
      client_id: "",
      location_id: "",
      staff_id: "",
      start_time: "",
      end_time: "",
    });
  };

  // =========================================================
  // 4. UPDATE SESSION (EDIT SAVE)
  // =========================================================
  const handleUpdateSession = async (updated: any) => {
    const { error } = await supabase
      .from("sessions")
      .update({
        start_time: updated.start_time,
        end_time: updated.end_time,
        status: updated.status,
      })
      .eq("id", updated.id);

    if (error) console.error(error);
  };

  // =========================================================
  // 5. DRAG & DROP (READY HOOK)
  // =========================================================
  const handleDragEnd = async (
    sessionId: string,
    newStart: string,
    newEnd: string
  ) => {
    await supabase
      .from("sessions")
      .update({
        start_time: newStart,
        end_time: newEnd,
      })
      .eq("id", sessionId);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>ABA Calendar</h1>

      {/* CREATE BUTTON */}
      <button
        onClick={() => setShowCreate(true)}
        style={{ marginBottom: 15, padding: "8px 12px" }}
      >
        + Create Session
      </button>

      {/* SESSION LIST */}
      <div style={{ display: "grid", gap: 10 }}>
        {sessions.map((s: any) => (
          <div
            key={s.id}
            onClick={() => setSelectedSession(s)}
            style={{
              borderLeft: `4px solid ${s.color || "#999"}`,
              padding: 10,
              cursor: "pointer",
              background: "#f5f5f5",
            }}
          >
            <strong>{s.clients?.full_name}</strong>
            <div>{s.status}</div>
          </div>
        ))}
      </div>

      {/* EDIT PANEL */}
      {selectedSession && (
        <div
          style={{
            position: "fixed",
            right: 0,
            top: 0,
            width: 300,
            height: "100%",
            background: "white",
            borderLeft: "1px solid #ddd",
            padding: 20,
          }}
        >
          <h3>Edit Session</h3>

          <p>{selectedSession.clients?.full_name}</p>

          <input
            type="datetime-local"
            defaultValue={selectedSession.start_time?.slice(0, 16)}
            onChange={(e) =>
              setSelectedSession({
                ...selectedSession,
                start_time: e.target.value,
              })
            }
          />

          <input
            type="datetime-local"
            defaultValue={selectedSession.end_time?.slice(0, 16)}
            onChange={(e) =>
              setSelectedSession({
                ...selectedSession,
                end_time: e.target.value,
              })
            }
          />

          <button onClick={() => handleUpdateSession(selectedSession)}>
            Save Changes
          </button>

          <button onClick={() => setSelectedSession(null)}>
            Close
          </button>
        </div>
      )}

      {/* CREATE MODAL (UPGRADED DROPDOWNS) */}
      {showCreate && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ background: "white", padding: 20, width: 340 }}>
            <h3>Create Session</h3>

            {/* CLIENT */}
            <select
              value={newSession.client_id}
              onChange={(e) =>
                setNewSession({ ...newSession, client_id: e.target.value })
              }
              style={{ width: "100%", marginBottom: 10 }}
            >
              <option value="">Select Client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>

            {/* LOCATION */}
            <select
              value={newSession.location_id}
              onChange={(e) =>
                setNewSession({ ...newSession, location_id: e.target.value })
              }
              style={{ width: "100%", marginBottom: 10 }}
            >
              <option value="">Select Location</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>

            {/* STAFF */}
            <select
              value={newSession.staff_id}
              onChange={(e) =>
                setNewSession({ ...newSession, staff_id: e.target.value })
              }
              style={{ width: "100%", marginBottom: 10 }}
            >
              <option value="">Assign Staff</option>
              {staff.map((s: any) => (
                <option key={s.user_id} value={s.user_id}>
                  {s.profiles?.full_name}
                </option>
              ))}
            </select>

            {/* TIME */}
            <input
              type="datetime-local"
              value={newSession.start_time}
              onChange={(e) =>
                setNewSession({ ...newSession, start_time: e.target.value })
              }
              style={{ width: "100%", marginBottom: 10 }}
            />

            <input
              type="datetime-local"
              value={newSession.end_time}
              onChange={(e) =>
                setNewSession({ ...newSession, end_time: e.target.value })
              }
              style={{ width: "100%", marginBottom: 10 }}
            />

            <button onClick={handleCreateSession}>
              Create Session
            </button>

            <button onClick={() => setShowCreate(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}