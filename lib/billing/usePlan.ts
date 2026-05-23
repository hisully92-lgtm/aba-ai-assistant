"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export function usePlan() {
  const [plan, setPlan] = useState<string>("free");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPlan() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;

      if (!user) {
        setPlan("free");
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .single();

      setPlan(data?.plan || "free");
      setLoading(false);
    }

    fetchPlan();
  }, []);

  return { plan, loading };
}