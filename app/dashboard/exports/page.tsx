"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function ExportHistoryPage() {
  const [exports, setExports] = useState<any[]>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("client_exports")
      .select("*")
      .order("created_at", { ascending: false });

    setExports(data || []);
  }

  return (
    <div className="p-6 bg-white rounded-xl border shadow">
      <h2 className="text-xl font-bold mb-4">Export History</h2>

      {exports.map((exp) => (
        <div key={exp.id} className="border p-3 rounded mb-2">
          <p className="font-medium">{exp.type}</p>
          <p className="text-sm text-gray-500">{exp.status}</p>
          <p className="text-xs text-gray-400">
            {new Date(exp.created_at).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}