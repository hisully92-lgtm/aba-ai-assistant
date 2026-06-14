"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import { usePlanGate } from "@/lib/hooks/usePlanGate";
import UpgradePrompt from "@/components/ui/UpgradePrompt";

export default function ClientReportPage({ params }: { params: { id: string } }) {
  const clientId = params.id;
  const [client, setClient] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { hasFeature, planName } = usePlanGate();
  const aiGate = hasFeature("ai");

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const [{ data: clientData }, { data: sessionData }, { data: goalData }] = await Promise.all([
      supabase.from("clients").select("*").eq("id", clientId).single(),
      supabase.from("sessions").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(20),
      supabase.from("client_goals").select("*").eq("client_id", clientId),
    ]);
    setClient(clientData);
    setSessions(sessionData ?? []);
    setGoals(goalData ?? []);
    setLoading(false);
  }

  async function handleGenerateReport() {
    if (!aiGate.allowed) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "report",
          client_id: clientId,
          client_name: client?.full_name,
          session_count: sessions.length,
          goal_count: goals.length,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error ?? "Report generation failed."); return; }
      setResult(data.result ?? "Report queued. Check back shortly.");
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading client data...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title={`${client?.full_name ?? "Client"} — Report`} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Sessions", value: sessions.length, color: "text-blue-600" },
          { label: "Completed", value: sessions.filter(s => s.status === "completed").length, color: "text-green-600" },
          { label: "Pending Notes", value: sessions.filter(s => s.status === "pending").length, color: "text-yellow-600" },
          { label: "Active Goals", value: goals.filter(g => g.status === "active").length, color: "text-purple-600" },
        ].map(stat => (
          <div key={stat.label} className="border rounded-xl p-4 text-center bg-white">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <Section title="AI Progress Report">
        {!aiGate.allowed ? (
          <UpgradePrompt
            reason={`AI-generated progress reports require the Professional plan or higher. You are on the ${planName} plan.`}
            upgradeTo={aiGate.upgradeTo}
            feature="AI Progress Reports"
          />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Generate a clinical progress report for <strong>{client?.full_name}</strong> based on their session history, behaviors, and goals.
            </p>
            {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
            {result && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 whitespace-pre-wrap">{result}</div>
            )}
            <Button onClick={handleGenerateReport} loading={generating}>
              🤖 Generate AI Progress Report
            </Button>
          </div>
        )}
      </Section>

      <Section title={`Recent Sessions (${sessions.length})`}>
        {sessions.length === 0 ? (
          <p className="text-gray-400 text-sm">No sessions recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {sessions.slice(0, 10).map(session => (
              <div key={session.id} className="border border-gray-100 rounded-lg p-3 bg-white flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {session.date ?? new Date(session.created_at).toLocaleDateString()}
                  </p>
                  {session.staff_member && <p className="text-xs text-gray-400">Staff: {session.staff_member}</p>}
                  {session.behaviors_observed && <p className="text-xs text-gray-500 mt-0.5">Behaviors: {session.behaviors_observed}</p>}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  session.status === "completed" ? "bg-green-100 text-green-700"
                  : session.status === "pending" ? "bg-yellow-100 text-yellow-700"
                  : "bg-gray-100 text-gray-600"
                }`}>
                  {session.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {goals.length > 0 && (
        <Section title={`Goals (${goals.length})`}>
          <div className="space-y-2">
            {goals.map(goal => (
              <div key={goal.id} className="border border-gray-100 rounded-lg p-3 bg-white">
                <p className="text-sm font-medium text-gray-800">{goal.goal_name ?? goal.target_name ?? "Goal"}</p>
                {goal.status && (
                  <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${
                    goal.status === "mastered" ? "bg-green-100 text-green-700"
                    : goal.status === "active" ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-600"
                  }`}>
                    {goal.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}