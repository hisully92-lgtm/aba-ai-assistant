"use client";

import { useState, useEffect } from "react";

import Section from "../../components/ui/Section";
import Button from "../../components/ui/Button";
import PageHeader from "../../components/layout/PageHeader";
import { supabase } from "@/lib/supabase/client";

type Session = {
  id: string;
  client_name: string;
  notes: string;
  created_at: string;
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [clientName, setClientName] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    async function fetchSessions() {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      setSessions(data || []);
    }

    fetchSessions();
  }, []);

  async function handleAddSession() {
    if (!clientName || !notes) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error("No user logged in");
      return;
    }

    const { data, error } = await supabase
      .from("sessions")
      .insert([
        {
          client_name: clientName,
          notes,
          created_by: user.id,
        },
      ])
      .select();

    if (error) {
      console.error(error);
      return;
    }

    if (data) {
      setSessions((prev) => [...data, ...prev]);
    }

    setClientName("");
    setNotes("");
    setShowForm(false);
  }

  return (
    <div>
      <PageHeader title="Sessions" />

      <Section>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add Session"}
        </Button>

        {showForm && (
          <div className="mt-4 space-y-2">
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Client name"
            />

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes"
            />

            <Button onClick={handleAddSession}>Save</Button>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {sessions.map((session) => (
            <div key={session.id} className="border p-3 rounded">
              <h3 className="font-bold">{session.client_name}</h3>
              <p>{session.notes}</p>
              <small>{session.created_at}</small>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}