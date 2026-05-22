import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export function useExportLimit() {
  const [exportsUsed, setExportsUsed] = useState(0);
  const [exportLimit, setExportLimit] = useState(10);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLimits();
  }, []);

  async function fetchLimits() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("exports_used, export_limit")
      .eq("id", user.id)
      .single();

    setExportsUsed(data?.exports_used || 0);
    setExportLimit(data?.export_limit || 10);
    setLoading(false);
  }

  const canExport = exportsUsed < exportLimit;

  return {
    exportsUsed,
    exportLimit,
    canExport,
    refresh: fetchLimits,
  };
}