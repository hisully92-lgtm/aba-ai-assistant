"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type ProgressReport = {
  id: string;
  client_id: string;
  report_period: string;
  goals_addressed: string;
  progress_summary: string;
  recommendations: string;
  generated_by_ai: boolean;
  created_by: string;
  created_at: string;
};

export default function ProgressReportsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [reports, setReports] = useState<ProgressReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterClient, setFilterClient] = useState("");

  const [clientId, setClientId] = useState("");
  const [reportPeriod, setReportPeriod] = useState("");
  const [goalsAddressed, setGoalsAddressed] = useState("");
  const [progressSummary, setProgressSummary] = useState("");
  const [recommendations, setRecommendations] = useState("");

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: reportData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
      supabase.from("progress_reports").select("*").eq("created_by", user.id).order("created_at", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setReports(reportData ?? []);
    setLoading(false);
  }

  async function handleGenerateAI() {
    if (!clientId) { setError("Please select a client."); return; }
    setGenerating(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    try {
      const { data: sessions } = await supabase
        .from("sessions")
        .select("session_date, behaviors_observed, interventions_used, client_response, programs_targeted")
        .eq("client_id", clientId)
        .order("session_date", { ascending: false })
        .limit(20);

      const { data: goals } = await supabase
        .from("goals")
        .select("goal_name, target_behavior, current_level, mastery_criteria")
        .eq("client_id", clientId);

      const sessionText = (sessions ?? []).map((s: any) =>
        `Date: ${s.session_date}, Behaviors: ${s.behaviors_observed}, Interventions: ${s.interventions_used}, Response: ${s.client_response}`
      ).join("\n");

      const goalText = (goals ?? []).map((g: any) =>
        `Goal: ${g.goal_name}, Target: ${g.target_behavior}, Current Level: ${g.current_level}`
      ).join("\n");

      const prompt = `You are a BCBA writing a clinical progress report. Based on the following session data and goals, write a professional progress report with three sections: Goals Addressed, Progress Summary, and Recommendations.\n\nGoals:\n${goalText || "No goals on file"}\n\nRecent Sessions:\n${sessionText || "No session data available"}\n\nWrite in clinical language suitable for insurance and supervisory review.`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await response.json();
      const text = data.content?.[0]?.text ?? "";

      const goalsMatch = text.match(/Goals Addressed[:\s]+([\s\S]*?)(?=Progress Summary|$)/i);
      const progressMatch = text.match(/Progress Summary[:\s]+([\s\S]*?)(?=Recommendations|$)/i);
      const recsMatch = text.match(/Recommendations[:\s]+([\s\S]*?)$/i);

      setGoalsAddressed(goalsMatch?.[1]?.trim() ?? text.slice(0, 300));
      setProgressSummary(progressMatch?.[1]?.trim() ?? "");
      setRecommendations(recsMatch?.[1]?.trim() ?? "");
      setReportPeriod(new Date().toISOString().split("T")[0]);

    } catch (err: any) {
      setError("AI generation failed. You can still write the report manually.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!clientId || !progressSummary) { setError("Please select a client and add a progress summary."); return; }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error: saveError } = await supabase
      .from("progress_reports")
      .insert([{
        client_id: clientId,
        report_period: reportPeriod,
        goals_addressed: goalsAddressed,
        progress_summary: progressSummary,
        recommendations,
        generated_by_ai: !!goalsAddressed,
        created_by: user.id,
      }])
      .select()
      .single();

    if (saveError) { setError(saveError.message); setSaving(false); return; }

    setReports(prev => [data, ...prev]);
    setShowForm(false);
    setClientId(""); setReportPeriod(""); setGoalsAddressed("");
    setProgressSummary(""); setRecommendations("");
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
    setSaving(false);
  }

  function handlePrint(report: ProgressReport) {
    const client = clients.find(c => c.id === report.client_id);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Progress Report</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;max-width:800px;margin:0 auto;}
      h1{color:#1e40af;}h2{color:#374151;border-bottom:1px solid #e5e7eb;padding-bottom:8px;}
      p{line-height:1.6;color:#374151;}.meta{color:#6b7280;font-size:14px;margin-bottom:24px;}</style>
      </head><body>
      <h1>Progress Report</h1>
      <div class="meta">
        <p><strong>Client:</strong> ${client?.full_name ?? "Unknown"}</p>
        <p><strong>Report Period:</strong> ${report.report_period}</p>
        <p><strong>Date Generated:</strong> ${new Date(report.created_at).toLocaleDateString()}</p>
        ${report.generated_by_ai ? "<p><em>AI-Assisted Report</em></p>" : ""}
      </div>
      <h2>Goals Addressed</h2><p>${report.goals_addressed}</p>
      <h2>Progress Summary</h2><p>${report.progress_summary}</p>
      <h2>Recommendations</h2><p>${report.recommendations}</p>
      </body></html>
    `);
    win.document.close();
    win.print();
  }

  const filtered = filterClient ? reports.filter(r => r.client_id === filterClient) : reports;
  const clientMap = new Map(clients.map(c => [c.id, c.full_name]));

  return (
    <div className="space-y-6">
      <PageHeader title="Progress Reports">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Report"}
        </Button>
      </PageHeader>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          Progress report saved successfully.
        </div>
      )}

      {showForm && (
        <Section title="New Progress Report">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Report Period</label>
              <input type="date" value={reportPeriod} onChange={e => setReportPeriod(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <Button variant="outline" onClick={handleGenerateAI} loading={generating} disabled={!clientId}>
            {generating ? "Generating..." : "Generate with AI"}
          </Button>

          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Goals Addressed</label>
              <textarea value={goalsAddressed} onChange={e => setGoalsAddressed(e.target.value)}
                rows={4} placeholder="Describe the goals addressed during this period..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Progress Summary *</label>
              <textarea value={progressSummary} onChange={e => setProgressSummary(e.target.value)}
                rows={5} placeholder="Summarize client progress, data trends, and clinical observations..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Recommendations</label>
              <textarea value={recommendations} onChange={e => setRecommendations(e.target.value)}
                rows={3} placeholder="Clinical recommendations for next period..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={handleSave} loading={saving}>Save Report</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {!loading && reports.length > 0 && (
        <div className="flex gap-3 items-center">
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <p className="text-sm text-gray-400">{filtered.length} reports</p>
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <Section title="Progress Reports">
          <p className="text-gray-400 text-sm">No progress reports yet.</p>
        </Section>
      )}

      <div className="space-y-3">
        {filtered.map(report => {
          const isExpanded = expandedId === report.id;
          return (
            <div key={report.id} className="border border-gray-100 rounded-xl bg-white">
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800">{clientMap.get(report.client_id) ?? "Unknown"}</p>
                      {report.generated_by_ai && (
                        <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">AI Generated</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Period: {report.report_period} · Created: {new Date(report.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handlePrint(report)}
                      className="text-xs text-blue-500 hover:text-blue-700">Print</button>
                    <button onClick={() => setExpandedId(isExpanded ? null : report.id)}
                      className="text-xs text-gray-400 hover:text-gray-600">{isExpanded ? "▲" : "▼"}</button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 border-t border-gray-100 pt-4 space-y-4">
                    {report.goals_addressed && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Goals Addressed</p>
                        <p className="text-sm text-gray-700 whitespace-pre-line">{report.goals_addressed}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Progress Summary</p>
                      <p className="text-sm text-gray-700 whitespace-pre-line">{report.progress_summary}</p>
                    </div>
                    {report.recommendations && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Recommendations</p>
                        <p className="text-sm text-gray-700 whitespace-pre-line">{report.recommendations}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}