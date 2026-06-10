"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import Link from "next/link";

type Client = { id: string; full_name: string };
type ReportSummary = {
  progress_reports: number;
  session_notes: number;
  incident_reports: number;
  bip_plans: number;
};

const REPORT_TYPES = [
  {
    title: "Progress Reports",
    desc: "AI-generated clinical progress reports for insurance and supervision.",
    href: "/dashboard/progress-reports",
    icon: "📊",
    color: "border-blue-200 bg-blue-50",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  {
    title: "Session Notes",
    desc: "All documented therapy sessions with SOAP notes and behavior data.",
    href: "/dashboard/sessions",
    icon: "📋",
    color: "border-green-200 bg-green-50",
    badgeColor: "bg-green-100 text-green-700",
  },
  {
    title: "Incident Reports",
    desc: "Filed incident reports with CPS and 911 documentation.",
    href: "/dashboard/incidents",
    icon: "🚨",
    color: "border-red-200 bg-red-50",
    badgeColor: "bg-red-100 text-red-700",
  },
  {
    title: "BIP Plans",
    desc: "Behavior intervention plans with treatment fidelity tracking.",
    href: "/dashboard/bip",
    icon: "🧠",
    color: "border-purple-200 bg-purple-50",
    badgeColor: "bg-purple-100 text-purple-700",
  },
  {
    title: "Assessments",
    desc: "VB-MAPP, ABLLS-R, AFLS, and EFL assessment records.",
    href: "/dashboard/assessments",
    icon: "📝",
    color: "border-orange-200 bg-orange-50",
    badgeColor: "bg-orange-100 text-orange-700",
  },
  {
    title: "Supervision Logs",
    desc: "BCBA supervision hours and competency records.",
    href: "/dashboard/supervision",
    icon: "👤",
    color: "border-indigo-200 bg-indigo-50",
    badgeColor: "bg-indigo-100 text-indigo-700",
  },
  {
    title: "Analytics",
    desc: "Visual behavior graphs, heatmaps, and macro trends.",
    href: "/dashboard/analytics/graphs",
    icon: "📈",
    color: "border-teal-200 bg-teal-50",
    badgeColor: "bg-teal-100 text-teal-700",
  },
  {
    title: "Data Exports",
    desc: "Export all clinic data in HIPAA-compliant formats.",
    href: "/dashboard/exports",
    icon: "📦",
    color: "border-gray-200 bg-gray-50",
    badgeColor: "bg-gray-100 text-gray-700",
  },
];

export default function ReportsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [
      { data: clientData },
      { count: progressCount },
      { count: sessionCount },
      { count: incidentCount },
      { count: bipCount },
    ] = await Promise.all([
      supabase.from("clients").select("id, full_name").order("full_name"),
      supabase.from("progress_reports").select("*", { count: "exact", head: true }).eq("created_by", user.id),
      supabase.from("sessions").select("*", { count: "exact", head: true }).eq("created_by", user.id),
      supabase.from("incident_reports").select("*", { count: "exact", head: true }).eq("created_by", user.id),
      supabase.from("behavior_intervention_plans").select("*", { count: "exact", head: true }).eq("created_by", user.id),
    ]);

    setClients(clientData ?? []);
    setSummary({
      progress_reports: progressCount ?? 0,
      session_notes: sessionCount ?? 0,
      incident_reports: incidentCount ?? 0,
      bip_plans: bipCount ?? 0,
    });
    setLoading(false);
  }

  async function handleGenerateReport() {
    if (!selectedClient) return;
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 1000));
    setGenerating(false);
    setGenerated(true);
    setTimeout(() => window.location.href = "/dashboard/progress-reports", 1500);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reports & Documentation" />

      {/* SUMMARY STATS */}
      {!loading && summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Progress Reports", value: summary.progress_reports, color: "text-blue-600" },
            { label: "Session Notes", value: summary.session_notes, color: "text-green-600" },
            { label: "Incident Reports", value: summary.incident_reports, color: "text-red-600" },
            { label: "BIP Plans", value: summary.bip_plans, color: "text-purple-600" },
          ].map((stat) => (
            <div key={stat.label} className="border border-gray-100 rounded-xl p-4 text-center bg-white">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* QUICK GENERATE */}
      <Section title="Quick Report Generator">
        <p className="text-sm text-gray-500 mb-4">Generate an AI-powered progress report for a client based on their recent session data.</p>
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-48">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Select Client</label>
            <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">Select client...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
          <Button onClick={handleGenerateReport} loading={generating} disabled={!selectedClient}>
            Generate Progress Report
          </Button>
        </div>
        {generated && (
          <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
            ✓ Redirecting to progress reports...
          </div>
        )}
      </Section>

      {/* REPORT TYPES */}
      <Section title="All Reports & Documentation">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {REPORT_TYPES.map((type) => (
            <Link key={type.title} href={type.href}
              className={`flex items-center gap-3 border rounded-xl p-4 transition-all hover:shadow-md ${type.color}`}>
              <span className="text-2xl shrink-0">{type.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{type.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{type.desc}</p>
              </div>
              <span className="text-gray-300 shrink-0">→</span>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}