"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import jsPDF from "jspdf";

type Client = { id: string; full_name: string; diagnosis: string | null; guardian_name: string | null };

export default function ProgressReportsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("clients").select("id, full_name, diagnosis, guardian_name").eq("created_by", user.id);
    setClients(data ?? []);
    setLoading(false);
  }

  async function generateAIReport() {
    if (!selectedClientId) return;
    setGeneratingAI(true);
    setReport(null);

    const client = clients.find((c) => c.id === selectedClientId);

    const [{ data: sessions }, { data: behaviors }, { data: programs }] = await Promise.all([
      supabase.from("sessions").select("date, status, behaviors_observed, programs_targeted, notes, soap_assessment, soap_plan").eq("client_id", selectedClientId).gte("date", dateFrom).lte("date", dateTo).order("date", { ascending: false }),
      supabase.from("behaviors").select("behavior_name, frequency, intensity, intervention_used, created_at").eq("client_id", selectedClientId).gte("created_at", dateFrom).lte("created_at", dateTo),
      supabase.from("programs").select("program_name, prompt_level, trial_data, mastery_criteria, created_at").eq("client_id", selectedClientId).gte("created_at", dateFrom).lte("created_at", dateTo),
    ]);

    const prompt = `You are a BCBA writing a clinical progress report for an ABA therapy client.

Client: ${client?.full_name}
Diagnosis: ${client?.diagnosis ?? "Not specified"}
Report Period: ${dateFrom} to ${dateTo}

Sessions (${sessions?.length ?? 0}):
${sessions?.slice(0, 10).map((s) => `- ${s.date}: ${s.behaviors_observed ? `Behaviors: ${s.behaviors_observed}` : "No behaviors"} | Programs: ${s.programs_targeted ?? "None"} | ${s.soap_assessment ?? s.notes ?? ""}`).join("\n") ?? "No sessions"}

Behaviors (${behaviors?.length ?? 0}):
${behaviors?.map((b) => `- ${b.behavior_name}: ${b.frequency}, ${b.intensity} intensity, Intervention: ${b.intervention_used}`).join("\n") ?? "No behaviors"}

Skill Programs (${programs?.length ?? 0}):
${programs?.map((p) => `- ${p.program_name}: ${p.trial_data ?? "No data"} (Mastery: ${p.mastery_criteria})`).join("\n") ?? "No programs"}

Write a professional ABA progress report with these sections:
1. Summary of Progress
2. Behavior Reduction Goals
3. Skill Acquisition Goals
4. Clinical Recommendations
5. Plan for Next Period

Be specific, clinical, and professional. Use ABA terminology.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await res.json();
      setReport(data.content?.[0]?.text ?? "Unable to generate report.");
    } catch {
      setReport("AI report generation failed. Please try again.");
    } finally {
      setGeneratingAI(false);
    }
  }

  async function exportPDF() {
    if (!report || !selectedClientId) return;
    setGenerating(true);

    const client = clients.find((c) => c.id === selectedClientId);
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("ABA Progress Report", 20, 20);

    doc.setFontSize(12);
    doc.text(`Client: ${client?.full_name ?? "Unknown"}`, 20, 35);
    doc.text(`Diagnosis: ${client?.diagnosis ?? "Not specified"}`, 20, 43);
    doc.text(`Report Period: ${dateFrom} to ${dateTo}`, 20, 51);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 59);

    doc.setLineWidth(0.3);
    doc.line(20, 65, 190, 65);

    const lines = doc.splitTextToSize(report, 170);
    let y = 73;
    lines.forEach((line: string) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(line, 20, y);
      y += 7;
    });

    doc.save(`progress-report-${client?.full_name?.replace(/\s/g, "-")}-${dateTo}.pdf`);
    setGenerating(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Progress Reports">
        <p className="text-gray-500 text-sm">AI-generated clinical progress reports with one-click PDF export.</p>
      </PageHeader>

      <Section title="Generate Report">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Client</label>
            <select value={selectedClientId} onChange={(e) => { setSelectedClientId(e.target.value); setReport(null); }}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">Select client...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">From Date</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">To Date</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={generateAIReport} loading={generatingAI} disabled={!selectedClientId}>
            🤖 Generate AI Report
          </Button>
          {report && (
            <Button variant="outline" onClick={exportPDF} loading={generating}>
              📄 Export PDF
            </Button>
          )}
        </div>
      </Section>

      {generatingAI && (
        <Section title="Generating...">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Analyzing session data and generating clinical report...</p>
          </div>
        </Section>
      )}

      {report && (
        <Section title="Generated Report">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {report}
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={exportPDF} loading={generating}>
              📄 Export as PDF
            </Button>
            <Button variant="outline" onClick={() => setReport(null)}>
              Clear
            </Button>
          </div>
        </Section>
      )}
    </div>
  );
}