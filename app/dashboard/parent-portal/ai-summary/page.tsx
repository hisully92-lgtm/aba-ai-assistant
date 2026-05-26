"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string; guardian_name: string | null };

export default function AIParentSummaryPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tone, setTone] = useState("friendly");
  const [period, setPeriod] = useState("week");
  const [copied, setCopied] = useState(false);

  const TONES = [
    { value: "friendly", label: "Friendly & Warm" },
    { value: "professional", label: "Professional" },
    { value: "simple", label: "Simple & Clear" },
  ];

  const PERIODS = [
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "quarter", label: "Last 3 Months" },
  ];

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("clients").select("id, full_name, guardian_name").eq("created_by", user.id);
    setClients(data ?? []);
    setLoading(false);
  }

  async function generateSummary() {
    if (!selectedClientId) return;
    setGenerating(true);
    setSummary(null);

    const client = clients.find((c) => c.id === selectedClientId);

    const daysBack = period === "week" ? 7 : period === "month" ? 30 : 90;
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const [{ data: sessions }, { data: behaviors }, { data: programs }] = await Promise.all([
      supabase.from("sessions").select("date, behaviors_observed, programs_targeted, client_response, notes, soap_plan").eq("client_id", selectedClientId).gte("created_at", startDate).order("date", { ascending: false }),
      supabase.from("behaviors").select("behavior_name, intensity, frequency, intervention_used").eq("client_id", selectedClientId).gte("created_at", startDate),
      supabase.from("programs").select("program_name, trial_data, mastery_criteria, prompt_level").eq("client_id", selectedClientId).gte("created_at", startDate),
    ]);

    const masteredPrograms = (programs ?? []).filter((p) => {
      const pctMatch = p.trial_data?.match(/(\d+)/);
      const pct = pctMatch ? parseInt(pctMatch[1]) : 0;
      const masteryMatch = p.mastery_criteria?.match(/(\d+)%/);
      const mastery = masteryMatch ? parseInt(masteryMatch[1]) : 80;
      return pct >= mastery && pct > 0;
    }).map((p) => p.program_name);

    const toneInstructions = {
      friendly: "Write in a warm, encouraging, parent-friendly tone. Celebrate wins and be positive. Avoid clinical jargon.",
      professional: "Write in a professional but accessible tone. Include some clinical terminology with brief explanations.",
      simple: "Write in very simple, clear language. Short sentences. No jargon. Easy for any caregiver to understand.",
    }[tone];

    const periodLabel = period === "week" ? "this week" : period === "month" ? "this month" : "over the last 3 months";

    const prompt = `You are a BCBA writing a parent/caregiver progress summary for a child in ABA therapy.

${toneInstructions}

Client: ${client?.full_name}
Guardian: ${client?.guardian_name ?? "Caregiver"}
Reporting Period: ${periodLabel}

Session Data (${sessions?.length ?? 0} sessions):
${sessions?.slice(0, 10).map((s) => `- ${s.date ?? "Recent"}: ${s.client_response ?? ""} | Programs: ${s.programs_targeted ?? "None"} | ${s.behaviors_observed ? `Behaviors: ${s.behaviors_observed}` : "No behaviors noted"}`).join("\n") ?? "No sessions this period"}

Skills Being Worked On:
${programs?.map((p) => `- ${p.program_name}: ${p.trial_data ?? "In progress"} (Prompt: ${p.prompt_level ?? "Unknown"})`).join("\n") ?? "No programs"}

${masteredPrograms.length > 0 ? `🎉 Skills Mastered This Period: ${masteredPrograms.join(", ")}` : ""}

Behaviors Noted:
${behaviors?.map((b) => `- ${b.behavior_name}: ${b.frequency ?? ""} ${b.intensity ? `(${b.intensity} intensity)` : ""}, Intervention: ${b.intervention_used ?? "Unknown"}`).join("\n") ?? "No behaviors noted this period"}

Write a warm, informative parent summary that includes:
1. A friendly greeting to ${client?.guardian_name ?? "the caregiver"}
2. Overall progress highlights
3. Skills their child worked on and how they did
4. Any behaviors and how staff responded
5. Things to celebrate or milestones reached
6. Simple home practice suggestions (2-3 ideas)
7. What to expect next
8. Encouraging closing

Keep it positive, supportive, and under 400 words.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 800,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await res.json();
      setSummary(data.content?.[0]?.text ?? "Unable to generate summary.");
    } catch {
      setSummary("Generation failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function copyToClipboard() {
    if (!summary) return;
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function sendToParentPortal() {
    if (!summary || !selectedClientId) return;
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    await supabase.from("notifications").insert({
      user_id: user.id,
      message: summary,
      type: "parent_message",
      read: false,
    });

    alert("Summary sent to parent portal!");
  }

  return (
    <div className="space-y-6">
      <PageHeader title="AI Parent Summary Generator">
        <p className="text-gray-500 text-sm">Generate caregiver-friendly progress summaries.</p>
      </PageHeader>

      <Section title="Summary Settings">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Client</label>
            <select value={selectedClientId} onChange={(e) => { setSelectedClientId(e.target.value); setSummary(null); }}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">Select client...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Time Period</label>
            <div className="flex gap-1 border border-gray-200 rounded-lg p-1">
              {PERIODS.map((p) => (
                <button key={p.value} onClick={() => setPeriod(p.value)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${period === p.value ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700"}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Writing Tone</label>
            <div className="space-y-1">
              {TONES.map((t) => (
                <button key={t.value} onClick={() => setTone(t.value)}
                  className={`w-full text-left text-xs px-3 py-1.5 rounded-lg border transition-all ${tone === t.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-blue-300"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <Button onClick={generateSummary} loading={generating} disabled={!selectedClientId}>
          🤖 Generate Parent Summary
        </Button>
      </Section>

      {generating && (
        <Section title="Generating...">
          <div className="flex items-center gap-3 py-4">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Writing a personalized summary for the caregiver...</p>
          </div>
        </Section>
      )}

      {summary && (
        <Section title="Generated Summary">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {summary}
          </div>
          <div className="mt-4 flex gap-2 flex-wrap">
            <Button variant="outline" onClick={copyToClipboard}>
              {copied ? "✓ Copied!" : "📋 Copy to Clipboard"}
            </Button>
            <Button variant="outline" onClick={sendToParentPortal}>
              📤 Send to Parent Portal
            </Button>
            <Button variant="outline" onClick={generateSummary} loading={generating}>
              🔄 Regenerate
            </Button>
            <Button variant="outline" onClick={() => setSummary(null)}>
              Clear
            </Button>
          </div>
        </Section>
      )}
    </div>
  );
}