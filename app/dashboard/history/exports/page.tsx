"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";

type ExportRecord = {
  id: string;
  client_id: string;
  type: string;
  status: string;
  created_at: string;
  approved_at: string | null;
};

export default function ExportHistoryPage() {
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return;

      const { data } = await supabase
        .from("client_exports")
        .select("id, client_id, type, status, created_at, approved_at")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      setExports(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  function statusColor(status: string) {
    if (status === "approved") return "bg-green-100 text-green-700";
    if (status === "rejected") return "bg-red-100 text-red-700";
    return "bg-yellow-100 text-yellow-700";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Export History">
        <p className="text-gray-500 text-sm">All your submitted clinical exports.</p>
      </PageHeader>

      <Section title={`${exports.length} exports`}>
        {loading && <p className="text-gray-400 text-sm">Loading...</p>}
        {!loading && exports.length === 0 && (
          <p className="text-gray-400 text-sm">No exports found.</p>
        )}
        <div className="space-y-3">
          {exports.map((exp) => (
            <div key={exp.id} className="border border-gray-100 rounded-xl p-4 bg-white flex justify-between items-start">
              <div>
                <p className="font-medium text-gray-800 capitalize">{exp.type.replace(/_/g, " ")}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(exp.created_at).toLocaleString()}
                </p>
                {exp.approved_at && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Reviewed: {new Date(exp.approved_at).toLocaleString()}
                  </p>
                )}
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor(exp.status)}`}>
                {exp.status}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}