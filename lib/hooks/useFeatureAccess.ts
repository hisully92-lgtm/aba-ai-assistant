import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type AccessMap = Record<string, boolean>;

export function useFeatureAccess() {
  const [access, setAccess] = useState<AccessMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { void init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) { setLoading(false); return; }

    const { data: cu } = await supabase
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!cu) { setLoading(false); return; }

    // Admins and directors get full access always
    if (["admin", "director", "clinical_director"].includes(cu.role ?? "")) {
      setAccess({});
      setLoading(false);
      return;
    }

    const { data: accessData } = await supabase
      .from("feature_access")
      .select("feature_key, enabled")
      .eq("company_id", cu.company_id)
      .eq("role", cu.role);

    const map: AccessMap = {};
    for (const row of accessData ?? []) {
      map[row.feature_key] = row.enabled;
    }

    setAccess(map);
    setLoading(false);
  }

  function canAccess(key: string): boolean {
    // If no settings saved yet, default to true
    if (!(key in access)) return true;
    return access[key];
  }

  return { canAccess, loading };
}