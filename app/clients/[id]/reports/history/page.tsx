"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function MonthlyReportHistory({
  params,
}: {
  params: { id: string };
}) {
  const clientId = params.id;

  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    load();
  }, [clientId]);

  async function load() {
    const { data } = await supabase
      .from("monthly_clinical_reports")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    setReports(data || []);
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      <h2 className="text-2xl font-bold mb-2">
        Monthly Report History
      </h2>

      <p className="text-gray-600 mb-6">
        Insurance-ready clinical documentation archive.
      </p>

      <div className="space-y-4">
        {reports.map((r) => (
          <div key={r.id} className="border rounded-lg p-4 bg-gray-50">
            <p className="font-semibold">{r.month}</p>

            <p className="text-sm text-gray-600 whitespace-pre-line mt-2">
              {r.summary}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}