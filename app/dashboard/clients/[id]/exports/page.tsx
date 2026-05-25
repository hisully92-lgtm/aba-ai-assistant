"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";

type ExportRecord = {
  id: string;
  client_id: string;
  created_by: string;
  type: string;
  status: "pending" | "approved" | "rejected";
  file_url: string | null;
  summary: any;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
};

function statusColor(status: string) {
  if (status === "approved") return "bg-green-100 text-green-700 border-green-200";
  if (status === "rejected") return "bg-red-100 text-red-700 border-red-200";
  return "bg-yellow-100 text-yellow-700 border-yellow-200";
}

function statusDot(status: string) {
  if (status === "approved") return "bg-green-500";
  if (status === "rejected") return "bg-red-500";
  return "bg-yellow-400";
}

export default function ExportHistoryPage({
  params,
}: {
  params: { id: string };
}) {
  const clientId = params.id;
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<{ full_name: string } | null>(null);

  useEffect(() => {
    async function init() {
      await Promise.all([loadClient(), loadExports()]);
      setLoading(false);
    }
    init();
  }, [clientId]);

  async function loadClient() {
    const { data } = await supabase
      .from("clients")
      .select("full_name")
      .eq("id", clientId)
      .single();
    setClient(data);
  }

  async function loadExports() {
    const { data } = await supabase
      .from("client_exports")
      .select("id, client_id, created_by, type, status, file_url, summary, created_at, approved_by, approved_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    setExports(data ?? []);
  }

  if (loading) return <div className="p-6 text-gray-400">Loading export history...</div>;

  return (
    <div className="space-y-6 p-6">
      <PageHeader title={`Export History — ${client?.full_name ?? clientId}`} />

      {exports.length === 0 ? (
        <Section title="Timeline">
          <p className="text-gray-400 text-sm">No exports found for this client.</p>
        </Section>
      ) : (
        <Section title={`Timeline — ${exports.length} export${exports.length !== 1 ? "s" : ""}`}>
          <div className="relative">
            <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" />
            <div className="space-y-6 pl-10">
              {exports.map((exp) => (
                <div key={exp.id} className="relative">
                  <div className={`absolute -left-7 top-1.5 w-3 h-3 rounded-full border-2 border-white ${statusDot(exp.status)}`} />
                  <div className="border border-gray-100 rounded-xl bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-800 capitalize">
                          {exp.type.replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Created {new Date(exp.created_at).toLocaleString()}
                        </p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full border ${statusColor(exp.status)}`}>
                        {exp.status}
                      </span>
                    </div>

                    {exp.approved_at && (
                      <p className="text-xs text-gray-400 mt-2">
                        {exp.status === "approved" ? "Approved" : "Reviewed"}{" "}
                        {new Date(exp.approved_at).toLocaleString()}
                      </p>
                    )}

                    {exp.summary && typeof exp.summary === "object" && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
                        <p className="font-medium text-gray-700 mb-1">Summary</p>
                        <pre className="whitespace-pre-wrap font-sans">
                          {JSON.stringify(exp.summary, null, 2)}
                        </pre>
                      </div>
                    )}

                    {exp.file_url && (
                      <div className="mt-3">
                        <button
                          onClick={() => window.open(exp.file_url!, "_blank")}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          View File →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}