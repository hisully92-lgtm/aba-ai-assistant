"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase/client";

import Button from "@/components/ui/Button";

import { approveExport } from "@/lib/exports/approveExport";
import { rejectExport } from "@/lib/exports/rejectExport";

type ExportItem = {
  id: string;
  client_id: string;
  created_at: string;
  status: "pending" | "approved" | "rejected";
};

export default function SupervisorDashboardPage() {
  const [exportsData, setExportsData] = useState<ExportItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExports();
  }, []);

  async function loadExports() {
    setLoading(true);

    const { data, error } = await supabase
      .from("client_exports")
      .select("id, client_id, created_at, status")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Load exports error:", error.message);
      setLoading(false);
      return;
    }

    setExportsData((data as ExportItem[]) || []);

    setLoading(false);
  }

  async function handleApprove(exportId: string) {
    try {
      const { data: authData } =
        await supabase.auth.getUser();

      const user = authData?.user;

      if (!user) return;

      await approveExport(exportId, user.id);

      await loadExports();
    } catch (error) {
      console.error("Approve export error:", error);
    }
  }

  async function handleReject(exportId: string) {
    try {
      await rejectExport(exportId);

      await loadExports();
    } catch (error) {
      console.error("Reject export error:", error);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      {/* HEADER */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold">
          Supervisor Approval Queue
        </h2>

        <p className="text-gray-600">
          Review and approve clinical export packets.
        </p>
      </div>

      {/* LOADING */}
      {loading && (
        <p className="text-gray-500">
          Loading exports...
        </p>
      )}

      {/* EMPTY */}
      {!loading && exportsData.length === 0 && (
        <p className="text-gray-500">
          No exports found.
        </p>
      )}

      {/* EXPORT LIST */}
      {!loading && exportsData.length > 0 && (
        <div className="space-y-4">
          {exportsData.map((item) => (
            <div
              key={item.id}
              className="border rounded-xl p-4 bg-gray-50"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                {/* INFO */}
                <div>
                  <p className="font-medium">
                    Client ID: {item.client_id}
                  </p>

                  <p className="text-sm text-gray-500 mt-1">
                    Created{" "}
                    {new Date(
                      item.created_at
                    ).toLocaleString()}
                  </p>

                  <div className="mt-2">
                    <span className="text-xs px-2 py-1 rounded-full border bg-white">
                      {item.status}
                    </span>
                  </div>
                </div>

                {/* ACTIONS */}
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    onClick={() =>
                      handleApprove(item.id)
                    }
                  >
                    Approve
                  </Button>

                  <Button
                    variant="danger"
                    onClick={() =>
                      handleReject(item.id)
                    }
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}