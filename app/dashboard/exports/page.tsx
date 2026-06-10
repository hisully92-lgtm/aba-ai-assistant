"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";

type ExportRecord = {
  id: string;
  type: string;
  status: string;
  file_url: string | null;
  created_at: string;
  metadata: any;
};

const EXPORT_TYPES = [
  { id: "clients", label: "Client Records", desc: "All client profiles and intake data", icon: "👥" },
  { id: "sessions", label: "Session Notes", desc: "All session documentation", icon: "📋" },
  { id: "bip", label: "BIP Plans", desc: "Behavior intervention plans", icon: "🧠" },
  { id: "incidents", label: "Incident Reports", desc: "All filed incident reports", icon: "🚨" },
  { id: "progress", label: "Progress Reports", desc: "Clinical progress reports", icon: "📊" },
  { id: "billing", label: "Billing Records", desc: "Claims, superbills, and payment records", icon: "💳" },
  { id: "staff", label: "Staff Records", desc: "Team credentials and supervision logs", icon: "👤" },
  { id: "full", label: "Full Data Export", desc: "Complete clinic data export (HIPAA compliant)", icon: "📦" },
];

export default function ExportsPage() {
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase
      .from("client_exports")
      .select("*")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    setExports(data ?? []);
    setLoading(false);
  }

  async function handleExport(type: string) {
    setExporting(type);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    await supabase.from("client_exports").insert([{
      type,
      status: "pending",
      created_by: user.id,
      metadata: { requested_at: new Date().toISOString() },
    }]);

    await init();
    setExporting(null);
  }

  function statusColor(status: string) {
    if (status === "completed") return "bg-green-100 text-green-700";
    if (status === "pending") return "bg-yellow-100 text-yellow-700";
    if (status === "failed") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-500";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Data Exports">
        <p className="text-gray-500 text-sm">Export your clinic data in HIPAA-compliant formats.</p>
      </PageHeader>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-bold mb-1">📋 HIPAA Data Portability</p>
        <p>All exports are encrypted and comply with HIPAA data portability requirements. Exports are available as CSV or PDF. Large exports may take a few minutes to process.</p>
      </div>

      <Section title="Export Data">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {EXPORT_TYPES.map((type) => (
            <div key={type.id} className="flex items-center gap-3 border border-gray-100 rounded-xl p-4 bg-white">
              <span className="text-2xl shrink-0">{type.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{type.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{type.desc}</p>
              </div>
              <button
                type="button"
                onClick={() => handleExport(type.id)}
                disabled={exporting === type.id}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0 cursor-pointer">
                {exporting === type.id ? "..." : "Export"}
              </button>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Export History (${exports.length})`}>
        {loading && <p className="text-gray-400 text-sm">Loading...</p>}
        {!loading && exports.length === 0 && (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-gray-500 text-sm">No exports yet. Use the buttons above to export your data.</p>
          </div>
        )}
        <div className="space-y-2">
          {exports.map((exp) => (
            <div key={exp.id} className="flex items-center justify-between border border-gray-100 rounded-xl p-3 bg-white">
              <div>
                <p className="text-sm font-medium text-gray-700 capitalize">{exp.type.replace("_", " ")} Export</p>
                <p className="text-xs text-gray-400 mt-0.5">{new Date(exp.created_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(exp.status)}`}>
                  {exp.status}
                </span>
                {exp.file_url && (
                  <a href={exp.file_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline">Download</Button>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}