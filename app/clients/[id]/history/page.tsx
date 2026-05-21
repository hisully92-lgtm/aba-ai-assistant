"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function ReportHistoryPage({
  params,
}: {
  params: { id: string };
}) {
  const clientId = params.id;

  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [clientId]);

  async function load() {
    setLoading(true);

    const { data } = await supabase
      .from("clinical_reports")
      .select("*")
      .eq("client_id", clientId)
      .order("report_date", { ascending: false });

    setReports(data || []);
    setLoading(false);
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      <h2 className="text-2xl font-bold mb-2">Report History</h2>

      <p className="text-gray-600 mb-6">
        Longitudinal clinical ABA documentation history.
      </p>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : reports.length === 0 ? (
        <p className="text-gray-500">No reports yet.</p>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => (
            <div key={r.id} className="border rounded-lg p-4 bg-gray-50">
              <p className="font-semibold">{r.report_date}</p>
              <p className="text-sm text-gray-600 whitespace-pre-line mt-2">
                {r.report_text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}