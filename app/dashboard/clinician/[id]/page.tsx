"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Props = {
  params: {
    id: string;
  };
};

type ExportItem = {
  id: string;
  client_id: string;
  created_at: string;
  status: string;
};

export default function ClinicianDetailPage({ params }: Props) {
  const [loading, setLoading] = useState(true);
  const [exportsData, setExportsData] = useState<ExportItem[]>([]);

  useEffect(() => {
    loadClinicianData();
  }, [params.id]);

  async function loadClinicianData() {
    setLoading(true);

    const { data, error } = await supabase
      .from("client_exports")
      .select("id, client_id, created_at, status")
      .eq("client_id", params.id) // 👈 KEY FILTER
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading clinician data:", error.message);
      setLoading(false);
      return;
    }

    setExportsData(data || []);
    setLoading(false);
  }

  return (
    <div style={{ padding: 20 }}>
      {/* HEADER */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>
          Clinician / Client View
        </h1>
        <p style={{ color: "#666" }}>
          ID: {params.id}
        </p>
      </div>

      {/* LOADING */}
      {loading && <p style={{ color: "#666" }}>Loading...</p>}

      {/* EMPTY */}
      {!loading && exportsData.length === 0 && (
        <p style={{ color: "#666" }}>
          No records found for this ID.
        </p>
      )}

      {/* LIST */}
      {!loading && exportsData.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {exportsData.map((item) => (
            <div
              key={item.id}
              style={{
                padding: 12,
                border: "1px solid #ddd",
                borderRadius: 10,
                background: "#fafafa",
              }}
            >
              <p><strong>Export ID:</strong> {item.id}</p>
              <p><strong>Status:</strong> {item.status}</p>
              <p style={{ fontSize: 12, color: "#666" }}>
                {new Date(item.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}