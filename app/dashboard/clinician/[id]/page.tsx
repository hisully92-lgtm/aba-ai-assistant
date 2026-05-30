"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/layout/PageHeader";

type Client = {
  id: string;
  full_name: string;
  diagnosis: string;
  created_at: string;
};

type Session = {
  id: string;
  client_id: string;
  session_date: string;
  behaviors_observed: string;
  interventions_used: string;
  client_response: string;
  status: string;
};

export default function ClinicianDetailPage({ params }: { params: { id: string } }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"clients" | "sessions">("clients");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: profile }, { data: clientData }, { data: sessionData }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
      supabase.from("clients").select("id, full_name, diagnosis, created_at").eq("created_by", user.id).order("created_at", { ascending: false }),
      supabase.from("sessions").select("id, client_id, session_date, behaviors_observed, interventions_used, client_response, status").eq("created_by", user.id).order("session_date", { ascending: false }).limit(20),
    ]);

    setUserName(profile?.full_name ?? "Clinician");
    setClients(clientData ?? []);
    setSessions(sessionData ?? []);
    setLoading(false);
  }

  const clientMap = new Map(clients.map(c => [c.id, c.full_name]));

  return (
    <div className="space-y-6 p-6">
      <PageHeader title={`${userName}'s Dashboard`} />

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-xl p-4 text-center bg-white">
          <p className="text-2xl font-bold text-blue-600">{clients.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total Clients</p>
        </div>
        <div className="border rounded-xl p-4 text-center bg-white">
          <p className="text-2xl font-bold text-green-600">{sessions.length}</p>
          <p className="text-xs text-gray-500 mt-1">Recent Sessions</p>
        </div>
        <div className="border rounded-xl p-4 text-center bg-white">
          <p className="text-2xl font-bold text-orange-500">
            {sessions.filter(s => s.status === "pending").length}
          </p>
          <p className="text-xs text-gray-500 mt-1">Pending Notes</p>
        </div>
        <div className="border rounded-xl p-4 text-center bg-white">
          <p className="text-2xl font-bold text-purple-600">
            {sessions.filter(s => s.status === "complete").length}
          </p>
          <p className="text-xs text-gray-500 mt-1">Completed</p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { key: "clients", label: "My Clients" },
          { key: "sessions", label: "Recent Sessions" },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}

      {/* CLIENTS TAB */}
      {!loading && activeTab === "clients" && (
        <Section title="My Clients">
          {clients.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm mb-3">No clients yet.</p>
              <Button onClick={() => window.location.href = "/dashboard/clients/new"}>
                Add First Client
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {clients.map(client => (
                <div key={client.id}
                  onClick={() => window.location.href = `/dashboard/clients/${client.id}`}
                  className="border border-gray-100 rounded-xl p-4 bg-white hover:border-blue-300 cursor-pointer transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-800">{client.full_name}</p>
                      {client.diagnosis && (
                        <p className="text-xs text-gray-500 mt-0.5">{client.diagnosis}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Added {new Date(client.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs text-blue-500">View →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* SESSIONS TAB */}
      {!loading && activeTab === "sessions" && (
        <Section title="Recent Sessions">
          {sessions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm mb-3">No sessions yet.</p>
              <Button onClick={() => window.location.href = "/dashboard/sessions"}>
                Go to Sessions
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map(session => (
                <div key={session.id} className="border border-gray-100 rounded-xl p-4 bg-white">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-gray-800">
                        {clientMap.get(session.client_id) ?? "Unknown Client"}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{session.session_date}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      session.status === "complete"
                        ? "bg-green-100 text-green-700"
                        : session.status === "pending"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {session.status ?? "draft"}
                    </span>
                  </div>
                  {session.behaviors_observed && (
                    <p className="text-xs text-gray-600 mt-1">
                      <span className="font-medium">Behaviors:</span> {session.behaviors_observed.slice(0, 100)}
                      {session.behaviors_observed.length > 100 ? "..." : ""}
                    </p>
                  )}
                  {session.client_response && (
                    <p className="text-xs text-gray-600 mt-1">
                      <span className="font-medium">Response:</span> {session.client_response.slice(0, 100)}
                      {session.client_response.length > 100 ? "..." : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}