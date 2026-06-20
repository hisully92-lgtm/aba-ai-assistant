/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Link from "next/link";

type Client = {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  diagnosis: string | null;
  caregiver_name: string | null;
  caregiver_phone: string | null;
  caregiver_email: string | null;
  school_name: string | null;
  created_at: string;
};

type Session = {
  id: string;
  date: string;
  status: string;
  behaviors_observed: string;
  programs_targeted: string;
  staff_member: string;
  created_at: string;
};

type Goal = {
  id: string;
  goal_name: string;
  domain: string;
  current_performance: number;
  target: number;
  status: string;
};

type Behavior = {
  id: string;
  behavior_name: string;
  frequency: number;
  recording_method: string;
  created_at: string;
};

type Intake = {
  id: string;
  primary_diagnosis: string;
  icd10_code: string;
  insurance_provider: string;
  authorization_number: string;
  authorized_hours: number;
  authorization_end: string;
  emergency_contact: string;
  emergency_phone: string;
  medications: string;
};

export default function ClientDetailPage({ params }: { params: { id: string } }) {
  const clientId = params.id;

  const [client, setClient] = useState<Client | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [intake, setIntake] = useState<Intake | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "sessions" | "goals" | "behaviors" | "intake">("overview");
  const [generating, setGenerating] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => { void init(); }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [
      { data: clientData },
      { data: sessionData },
      { data: goalData },
      { data: behaviorData },
      { data: intakeData },
    ] = await Promise.all([
      supabase.from("clients").select("*").eq("id", clientId).limit(1).maybeSingle(),
      supabase.from("sessions")
        .select("id, date, status, behaviors_observed, programs_targeted, staff_member, created_at")
        .eq("client_id", clientId).order("created_at", { ascending: false }).limit(20),
      supabase.from("client_goals")
        .select("id, goal_name, domain, current_performance, target, status")
        .eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("behaviors")
        .select("id, behavior_name, frequency, recording_method, created_at")
        .eq("client_id", clientId).order("created_at", { ascending: false }).limit(20),
      supabase.from("client_intake")
        .select("*").eq("client_id", clientId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    setClient(clientData ?? null);
    setSessions(sessionData ?? []);
    setGoals(goalData ?? []);
    setBehaviors(behaviorData ?? []);
    setIntake(intakeData ?? null);
    setLoading(false);
  }

  async function handleGenerateSummary() {
    setGenerating(true);
    setError(null);
    setSummary(null);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "summary",
          client_id: clientId,
          context: {
            name: client?.full_name,
            diagnosis: client?.diagnosis ?? "Not specified",
            active_goals: goals.filter(g => g.status === "active").map(g => g.goal_name),
            recent_behaviors: behaviors.slice(0, 5).map(b => b.behavior_name),
            session_count: sessions.length,
          },
        }),
      });

      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      const text = data.content?.[0]?.text ?? data.result ?? data.text ?? "";
      setSummary(text);
    } catch {
      setError("AI generation failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSendParentInvite() {
    if (!client?.caregiver_email) return;
    setInviteError(null);

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: client.caregiver_email,
      options: {
        emailRedirectTo: `${window.location.origin}/parent/auth/confirm`,
        shouldCreateUser: true,
        data: { role: "parent", linked_client_id: client.id },
      },
    });

    if (otpError) {
      setInviteError(otpError.message);
    } else {
      setInviteSent(true);
      setTimeout(() => setInviteSent(false), 5000);
    }
  }

  function age(dob: string | null) {
    if (!dob) return null;
    return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  }

  function daysUntil(dateStr: string) {
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  function progressPct(goal: Goal) {
    if (goal.target === 0) return 0;
    return Math.min(100, Math.round((goal.current_performance / goal.target) * 100));
  }

  if (loading) return <div className="p-6 text-gray-400">Loading client...</div>;
  if (!client) return <div className="p-6 text-red-500">Client not found.</div>;

  const activeGoals = goals.filter(g => g.status === "active");
  const masteredGoals = goals.filter(g => g.status === "mastered");
  const pendingSessions = sessions.filter(s => s.status === "pending");
  const authExpiring = intake?.authorization_end ? daysUntil(intake.authorization_end) <= 30 : false;

  return (
    <div className="space-y-6">
      <PageHeader title={client.full_name}>
        <div className="flex gap-2">
          <Link href={`/dashboard/analytics/graphs?client=${clientId}`}>
            <Button variant="outline">View Graphs</Button>
          </Link>
          <Link href={`/dashboard/clients/${clientId}/report`}>
            <Button variant="outline">Export Report</Button>
          </Link>
        </div>
      </PageHeader>

      {(pendingSessions.length > 0 || authExpiring) && (
        <div className="space-y-2">
          {pendingSessions.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
              {pendingSessions.length} pending session note{pendingSessions.length > 1 ? "s" : ""} need completion
            </div>
          )}
          {authExpiring && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">
              Authorization expires in {daysUntil(intake!.authorization_end)} days — {intake?.insurance_provider}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Active Goals", value: activeGoals.length, color: "text-blue-600" },
          { label: "Mastered Goals", value: masteredGoals.length, color: "text-green-600" },
          { label: "Total Sessions", value: sessions.length, color: "text-purple-600" },
          { label: "Behaviors Logged", value: behaviors.length, color: "text-red-500" },
        ].map(stat => (
          <div key={stat.label} className="border rounded-xl p-4 text-center bg-white">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {[
          { key: "overview", label: "Overview" },
          { key: "sessions", label: `Sessions (${sessions.length})` },
          { key: "goals", label: `Goals (${goals.length})` },
          { key: "behaviors", label: `Behaviors (${behaviors.length})` },
          { key: "intake", label: "Intake" },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-4">
          <Section title="Client Information">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {client.date_of_birth && (
                <div>
                  <p className="text-xs text-gray-500">Date of Birth</p>
                  <p className="font-medium text-gray-800">{client.date_of_birth} (Age {age(client.date_of_birth)})</p>
                </div>
              )}
              {client.diagnosis && (
                <div>
                  <p className="text-xs text-gray-500">Diagnosis</p>
                  <p className="font-medium text-gray-800">{client.diagnosis}</p>
                </div>
              )}
              {client.caregiver_name && (
                <div>
                  <p className="text-xs text-gray-500">Caregiver</p>
                  <p className="font-medium text-gray-800">{client.caregiver_name}</p>
                </div>
              )}
              {client.caregiver_phone && (
                <div>
                  <p className="text-xs text-gray-500">Caregiver Phone</p>
                  <p className="font-medium text-gray-800">{client.caregiver_phone}</p>
                </div>
              )}
              {client.school_name && (
                <div>
                  <p className="text-xs text-gray-500">School</p>
                  <p className="font-medium text-gray-800">{client.school_name}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500">Client Since</p>
                <p className="font-medium text-gray-800">{new Date(client.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </Section>

          <Section title="AI Clinical Summary">
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            {summary && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 mb-3">
                {summary}
              </div>
            )}
            <Button onClick={handleGenerateSummary} loading={generating} variant="outline">
              Generate AI Summary
            </Button>
          </Section>

          {activeGoals.length > 0 && (
            <Section title="Active Goals">
              <div className="space-y-3">
                {activeGoals.slice(0, 3).map(goal => (
                  <div key={goal.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{goal.goal_name}</span>
                      <span className="text-gray-400">{goal.current_performance}% / {goal.target}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`h-2 rounded-full ${progressPct(goal) >= 100 ? "bg-green-500" : "bg-blue-500"}`}
                        style={{ width: `${progressPct(goal)}%` }} />
                    </div>
                  </div>
                ))}
                {activeGoals.length > 3 && (
                  <button onClick={() => setActiveTab("goals")} className="text-xs text-blue-500 hover:underline">
                    View all {activeGoals.length} goals
                  </button>
                )}
              </div>
            </Section>
          )}

          <div className="flex gap-2 flex-wrap">
            <Link href={`/dashboard/clients/${clientId}/timeline`}>
              <Button variant="outline">Timeline</Button>
            </Link>
            <Link href={`/dashboard/clients/${clientId}/case`}>
              <Button variant="outline">Case Notes</Button>
            </Link>
            <Link href={`/dashboard/clients/${clientId}/exports`}>
              <Button variant="outline">Exports</Button>
            </Link>
            <Link href="/dashboard/analytics/graphs">
              <Button variant="outline">Graphs</Button>
            </Link>
          </div>
        </div>
      )}

      {activeTab === "sessions" && (
        <Section title="Session History">
          {sessions.length === 0 ? (
            <p className="text-gray-400 text-sm">No sessions yet.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map(session => (
                <div key={session.id} className="border border-gray-100 rounded-xl p-4 bg-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-800">{session.date ?? new Date(session.created_at).toLocaleDateString()}</p>
                      {session.staff_member && <p className="text-xs text-gray-400 mt-0.5">Staff: {session.staff_member}</p>}
                      {session.behaviors_observed && <p className="text-xs text-gray-500 mt-1">Behaviors: {session.behaviors_observed}</p>}
                      {session.programs_targeted && <p className="text-xs text-gray-500">Programs: {session.programs_targeted}</p>}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ml-3 ${
                      session.status === "completed" ? "bg-green-100 text-green-700"
                      : session.status === "pending" ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-600"
                    }`}>{session.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {activeTab === "goals" && (
        <Section title="Goals">
          {goals.length === 0 ? (
            <p className="text-gray-400 text-sm">No goals yet.</p>
          ) : (
            <div className="space-y-3">
              {goals.map(goal => (
                <div key={goal.id} className={`border rounded-xl p-4 bg-white ${goal.status === "mastered" ? "border-green-200" : "border-gray-100"}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-gray-800">{goal.goal_name}</p>
                      {goal.domain && <p className="text-xs text-gray-400">{goal.domain}</p>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      goal.status === "mastered" ? "bg-green-100 text-green-700"
                      : goal.status === "active" ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                    }`}>{goal.status}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Current: {goal.current_performance}%</span>
                    <span>Target: {goal.target}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${progressPct(goal) >= 100 ? "bg-green-500" : "bg-blue-500"}`}
                      style={{ width: `${progressPct(goal)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {activeTab === "behaviors" && (
        <Section title="Behavior Log">
          {behaviors.length === 0 ? (
            <p className="text-gray-400 text-sm">No behaviors logged yet.</p>
          ) : (
            <div className="space-y-2">
              {behaviors.map(behavior => (
                <div key={behavior.id} className="border border-gray-100 rounded-xl p-3 bg-white flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{behavior.behavior_name}</p>
                    <p className="text-xs text-gray-400">{new Date(behavior.created_at).toLocaleDateString()} · {behavior.recording_method}</p>
                  </div>
                  <span className="text-lg font-bold text-red-500">{behavior.frequency}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {activeTab === "intake" && (
        <div className="space-y-4">
          <Section title="Intake Information">
            {!intake ? (
              <div className="text-center py-6">
                <p className="text-gray-400 text-sm mb-3">No intake form on file.</p>
                <Link href="/dashboard/client-intake">
                  <Button>Complete Intake Form</Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {intake.primary_diagnosis && (
                  <div>
                    <p className="text-xs text-gray-500">Primary Diagnosis</p>
                    <p className="font-medium text-gray-800">{intake.primary_diagnosis}</p>
                  </div>
                )}
                {intake.icd10_code && (
                  <div>
                    <p className="text-xs text-gray-500">ICD-10 Code</p>
                    <p className="font-medium text-gray-800">{intake.icd10_code}</p>
                  </div>
                )}
                {intake.insurance_provider && (
                  <div>
                    <p className="text-xs text-gray-500">Insurance Provider</p>
                    <p className="font-medium text-gray-800">{intake.insurance_provider}</p>
                  </div>
                )}
                {intake.authorization_number && (
                  <div>
                    <p className="text-xs text-gray-500">Authorization Number</p>
                    <p className="font-medium text-gray-800">{intake.authorization_number}</p>
                  </div>
                )}
                {intake.authorized_hours > 0 && (
                  <div>
                    <p className="text-xs text-gray-500">Authorized Hours</p>
                    <p className="font-medium text-gray-800">{intake.authorized_hours}h</p>
                  </div>
                )}
                {intake.authorization_end && (
                  <div>
                    <p className="text-xs text-gray-500">Authorization Expires</p>
                    <p className={`font-medium ${authExpiring ? "text-red-600" : "text-gray-800"}`}>
                      {intake.authorization_end}{authExpiring ? ` (${daysUntil(intake.authorization_end)} days)` : ""}
                    </p>
                  </div>
                )}
                {intake.emergency_contact && (
                  <div>
                    <p className="text-xs text-gray-500">Emergency Contact</p>
                    <p className="font-medium text-gray-800">{intake.emergency_contact} — {intake.emergency_phone}</p>
                  </div>
                )}
                {intake.medications && (
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500">Medications</p>
                    <p className="font-medium text-gray-800">{intake.medications}</p>
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section title="Parent Portal Access">
            <p className="text-sm text-gray-500 mb-3">
              Send a portal invite to the caregiver so they can log in at{" "}
              <strong>aba-ai-assistant.com/parent</strong> to view their child&apos;s progress.
            </p>

            {inviteSent && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 mb-3">
                Portal invite sent to {client.caregiver_email}!
              </div>
            )}
            {inviteError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-3">
                {inviteError}
              </div>
            )}

            {client.caregiver_email ? (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Caregiver email</p>
                  <p className="text-sm font-medium text-gray-800">{client.caregiver_email}</p>
                </div>
                <Button onClick={handleSendParentInvite}>
                  Send Portal Invite
                </Button>
              </div>
            ) : (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-700">
                No caregiver email on file. Add one in the client profile to enable parent portal access.
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
