"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string; diagnosis: string | null };
type Program = {
  id: string;
  program_name: string;
  goal: string;
  targets: string;
  prompt_level: string;
  mastery_criteria: string;
  trial_data: string;
  notes: string;
  created_at: string;
};
type Behavior = {
  id: string;
  behavior_name: string;
  function_hypothesis: string;
  intervention_used: string;
  replacement_behavior: string;
  created_at: string;
};
type Session = {
  id: string;
  date: string;
  status: string;
  behaviors_observed: string;
  programs_targeted: string;
  notes: string;
  soap_plan: string;
  created_at: string;
};

export default function ProgramBooksPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"programs" | "behaviors" | "sessions" | "summary">("summary");
  const [loadingClients, setLoadingClients] = useState(true);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("clients").select("id, full_name, diagnosis").eq("created_by", user.id);
    setClients(data ?? []);
    setLoadingClients(false);
  }

  async function loadClientBook(clientId: string) {
    setSelectedClientId(clientId);
    setLoading(true);

    const [{ data: programData }, { data: behaviorData }, { data: sessionData }] = await Promise.all([
      supabase.from("programs").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("behaviors").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("sessions").select("id, date, status, behaviors_observed, programs_targeted, notes, soap_plan, created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(20),
    ]);

    setPrograms(programData ?? []);
    setBehaviors(behaviorData ?? []);
    setSessions(sessionData ?? []);
    setLoading(false);
  }

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  function parseTrialData(raw: string): number | null {
    if (!raw) return null;
    const fracMatch = raw.match(/(\d+)\s*\/\s*(\d+)/);
    if (fracMatch) return Math.round((parseInt(fracMatch[1]) / parseInt(fracMatch[2])) * 100);
    const pctMatch = raw.match(/(\d+\.?\d*)\s*%/);
    if (pctMatch) return parseFloat(pctMatch[1]);
    return null;
  }

  const masteredPrograms = programs.filter((p) => {
    const pct = parseTrialData(p.trial_data);
    const masteryMatch = p.mastery_criteria?.match(/(\d+)%/);
    const mastery = masteryMatch ? parseInt(masteryMatch[1]) : 80;
    return pct !== null && pct >= mastery;
  });

  const activePrograms = programs.filter((p) => {
    const pct = parseTrialData(p.trial_data);
    const masteryMatch = p.mastery_criteria?.match(/(\d+)%/);
    const mastery = masteryMatch ? parseInt(masteryMatch[1]) : 80;
    return pct === null || pct < mastery;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Program Books">
        <p className="text-gray-500 text-sm">Complete clinical record per client — programs, behaviors, and sessions synced.</p>
      </PageHeader>

      {/* CLIENT SELECT */}
      <Section title="Select Client">
        {loadingClients ? (
          <p className="text-gray-400 text-sm">Loading clients...</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {clients.map((c) => (
              <button key={c.id} onClick={() => loadClientBook(c.id)}
                className={`text-left border rounded-xl p-3 transition-all ${selectedClientId === c.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300 bg-white"}`}>
                <p className="text-sm font-semibold text-gray-800">{c.full_name}</p>
                {c.diagnosis && <p className="text-xs text-gray-400 mt-0.5 truncate">{c.diagnosis}</p>}
              </button>
            ))}
          </div>
        )}
      </Section>

      {selectedClientId && (
        <>
          {/* CLIENT HEADER */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <p className="font-bold text-blue-800 text-lg">{selectedClient?.full_name}</p>
                {selectedClient?.diagnosis && <p className="text-sm text-blue-600">{selectedClient.diagnosis}</p>}
              </div>
              <div className="flex gap-4 text-center">
                <div>
                  <p className="text-xl font-bold text-blue-600">{programs.length}</p>
                  <p className="text-xs text-blue-400">Programs</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-green-600">{masteredPrograms.length}</p>
                  <p className="text-xs text-green-400">Mastered</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-red-500">{behaviors.length}</p>
                  <p className="text-xs text-red-400">Behaviors</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-purple-600">{sessions.length}</p>
                  <p className="text-xs text-purple-400">Sessions</p>
                </div>
              </div>
            </div>
          </div>

          {/* TABS */}
          <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
            {[
              { key: "summary", label: "Summary" },
              { key: "programs", label: `Programs (${programs.length})` },
              { key: "behaviors", label: `Behaviors (${behaviors.length})` },
              { key: "sessions", label: `Sessions (${sessions.length})` },
            ].map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {loading && <p className="text-gray-400 text-sm">Loading program book...</p>}

          {/* SUMMARY TAB */}
          {!loading && activeTab === "summary" && (
            <div className="space-y-4">
              <Section title={`Active Programs (${activePrograms.length})`}>
                {activePrograms.length === 0 ? <p className="text-gray-400 text-sm">No active programs.</p> : (
                  <div className="space-y-2">
                    {activePrograms.map((p) => {
                      const pct = parseTrialData(p.trial_data);
                      return (
                        <div key={p.id} className="flex justify-between items-center border border-gray-100 rounded-lg p-3 bg-white">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{p.program_name}</p>
                            <p className="text-xs text-gray-400">{p.prompt_level} · Mastery: {p.mastery_criteria}</p>
                          </div>
                          {pct !== null && (
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${pct >= 70 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                              {pct}%
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>
              <Section title={`Mastered Programs (${masteredPrograms.length})`}>
                {masteredPrograms.length === 0 ? <p className="text-gray-400 text-sm">No mastered programs yet.</p> : (
                  <div className="flex flex-wrap gap-2">
                    {masteredPrograms.map((p) => (
                      <span key={p.id} className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-full border border-green-200">
                        ✓ {p.program_name}
                      </span>
                    ))}
                  </div>
                )}
              </Section>
              <Section title={`Behaviors of Concern (${behaviors.length})`}>
                {behaviors.length === 0 ? <p className="text-gray-400 text-sm">No behaviors logged.</p> : (
                  <div className="space-y-2">
                    {behaviors.slice(0, 5).map((b) => (
                      <div key={b.id} className="flex justify-between items-center border border-gray-100 rounded-lg p-3 bg-white">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{b.behavior_name}</p>
                          <p className="text-xs text-gray-400">Function: {b.function_hypothesis} · Replacement: {b.replacement_behavior}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
              {sessions[0] && (
                <Section title="Most Recent Session">
                  <div className="border border-gray-100 rounded-lg p-4 bg-white">
                    <p className="text-sm font-medium text-gray-800">{sessions[0].date ?? new Date(sessions[0].created_at).toLocaleDateString()}</p>
                    {sessions[0].behaviors_observed && <p className="text-xs text-gray-500 mt-1">Behaviors: {sessions[0].behaviors_observed}</p>}
                    {sessions[0].programs_targeted && <p className="text-xs text-gray-500">Programs: {sessions[0].programs_targeted}</p>}
                    {sessions[0].soap_plan && <p className="text-xs text-blue-500 mt-1">Plan: {sessions[0].soap_plan}</p>}
                  </div>
                </Section>
              )}
            </div>
          )}

          {/* PROGRAMS TAB */}
          {!loading && activeTab === "programs" && (
            <Section title="All Programs">
              {programs.length === 0 ? <p className="text-gray-400 text-sm">No programs yet.</p> : (
                <div className="space-y-3">
                  {programs.map((p) => {
                    const pct = parseTrialData(p.trial_data);
                    const masteryMatch = p.mastery_criteria?.match(/(\d+)%/);
                    const mastery = masteryMatch ? parseInt(masteryMatch[1]) : 80;
                    const isMastered = pct !== null && pct >= mastery;
                    return (
                      <div key={p.id} className={`border rounded-xl p-4 bg-white ${isMastered ? "border-green-200" : "border-gray-100"}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-800">{p.program_name}</p>
                              {isMastered && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">✓ Mastered</span>}
                            </div>
                            {p.goal && <p className="text-xs text-gray-500 mt-1">Goal: {p.goal}</p>}
                            {p.prompt_level && <p className="text-xs text-gray-400">Prompt: {p.prompt_level}</p>}
                            {p.mastery_criteria && <p className="text-xs text-gray-400">Mastery: {p.mastery_criteria}</p>}
                          </div>
                          {pct !== null && (
                            <span className={`text-sm font-bold px-3 py-1 rounded-full ${isMastered ? "bg-green-100 text-green-700" : pct >= 70 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                              {pct}%
                            </span>
                          )}
                        </div>
                        {pct !== null && (
                          <div className="mt-3 w-full bg-gray-100 rounded-full h-2">
                            <div className={`h-2 rounded-full ${isMastered ? "bg-green-500" : pct >= 70 ? "bg-yellow-500" : "bg-blue-500"}`}
                              style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                        )}
                        {p.targets && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {p.targets.split(", ").map((t) => (
                              <span key={t} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          )}

          {/* BEHAVIORS TAB */}
          {!loading && activeTab === "behaviors" && (
            <Section title="Behaviors of Concern">
              {behaviors.length === 0 ? <p className="text-gray-400 text-sm">No behaviors logged.</p> : (
                <div className="space-y-3">
                  {behaviors.map((b) => (
                    <div key={b.id} className="border border-gray-100 rounded-xl p-4 bg-white">
                      <p className="font-semibold text-gray-800">{b.behavior_name}</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2 text-sm text-gray-600">
                        {b.function_hypothesis && <p><span className="font-medium">Function:</span> {b.function_hypothesis}</p>}
                        {b.intervention_used && <p><span className="font-medium">Intervention:</span> {b.intervention_used}</p>}
                        {b.replacement_behavior && <p><span className="font-medium">Replacement:</span> {b.replacement_behavior}</p>}
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
              {sessions.length === 0 ? <p className="text-gray-400 text-sm">No sessions yet.</p> : (
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <div key={s.id} className="border border-gray-100 rounded-lg p-4 bg-white">
                      <div className="flex justify-between items-start">
                        <p className="text-sm font-medium text-gray-800">{s.date ?? new Date(s.created_at).toLocaleDateString()}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                          {s.status}
                        </span>
                      </div>
                      {s.behaviors_observed && <p className="text-xs text-gray-500 mt-1">Behaviors: {s.behaviors_observed}</p>}
                      {s.programs_targeted && <p className="text-xs text-gray-500">Programs: {s.programs_targeted}</p>}
                      {s.notes && <p className="text-xs text-gray-400 mt-1 italic">{s.notes}</p>}
                      {s.soap_plan && <p className="text-xs text-blue-500 mt-1">Plan: {s.soap_plan}</p>}
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}
        </>
      )}
    </div>
  );
}