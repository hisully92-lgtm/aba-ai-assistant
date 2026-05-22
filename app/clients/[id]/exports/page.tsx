"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";

type ExportRecord = {
  id: string;
  client_id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export default function ClientExportHistoryPage({
  params,
}: {
  params: { id: string };
}) {
  const clientId = params.id;

  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState("");

  useEffect(() => {
    loadExports();
  }, [clientId]);

  async function loadExports() {
    setLoading(true);

    const { data, error } = await supabase
      .from("client_exports")
      .select("id, client_id, created_at, status")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Load export history error:", error.message);
      setLoading(false);
      return;
    }

    setExports((data as ExportRecord[]) || []);
    setLoading(false);
  }

  function filterByMonth(items: ExportRecord[]) {
    if (!monthFilter) return items;

    return items.filter((item) =>
      item.created_at.startsWith(monthFilter)
    );
  }

  async function handleDownload(exportId: string) {
    // placeholder for later PDF/ZIP upgrade
    console.log("Download export:", exportId);
  }

  const filtered = filterByMonth(exports);

  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      {/* HEADER */}
      <h2 className="text-2xl font-bold mb-2">
        Export History
      </h2>

      <p className="text-gray-600 mb-6">
        Clinical export archive for this client.
      </p>

      {/* FILTER */}
      <div className="mb-6">
        <input
          type="month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="border p-2 rounded-lg"
        />
      </div>

      {/* STATES */}
      {loading && (
        <p className="text-gray-500">Loading exports...</p>
      )}

      {!loading && filtered.length === 0 && (
        <p className="text-gray-500">
          No exports found.
        </p>
      )}

      {/* LIST */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((exp) => (
            <div
              key={exp.id}
              className="border rounded-lg p-4 bg-gray-50 flex justify-between items-center"
            >
              <div>
                <p className="font-medium">
                  Export ID: {exp.id}
                </p>

                <p className="text-sm text-gray-500">
                  {new Date(exp.created_at).toLocaleString()}
                </p>

                <span className="text-xs px-2 py-1 border rounded bg-white mt-2 inline-block">
                  {exp.status}
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleDownload(exp.id)}
                >
                  Download
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}