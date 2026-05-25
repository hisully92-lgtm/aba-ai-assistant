"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type CompanyContext = {
  companyId: string | null;
  companyName: string | null;
  role: string | null;
  loading: boolean;
};

let cachedContext: CompanyContext | null = null;

export function useCompany(): CompanyContext {
  const [context, setContext] = useState<CompanyContext>(
    cachedContext ?? { companyId: null, companyName: null, role: null, loading: true }
  );

  useEffect(() => {
    if (cachedContext) {
      setContext(cachedContext);
      return;
    }

    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        setContext({ companyId: null, companyName: null, role: null, loading: false });
        return;
      }

      const { data } = await supabase
        .from("company_users")
        .select("company_id, role, companies(name)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      const result: CompanyContext = {
        companyId: data?.company_id ?? null,
        companyName: (data?.companies as any)?.name ?? null,
        role: data?.role ?? null,
        loading: false,
      };

      cachedContext = result;
      setContext(result);
    }

    load();
  }, []);

  return context;
}

// Call this on logout to clear cache
export function clearCompanyCache() {
  cachedContext = null;
}