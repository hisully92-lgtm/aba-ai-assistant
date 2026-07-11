"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type PlanType = "starter" | "basic" | "professional" | "growth" | "enterprise" | "clinic" | null;

export const PLAN_LIMITS = {
  starter:      { clinicians: 1,   clients: 10,  locations: 1  },
  basic:        { clinicians: 3,   clients: 25,  locations: 1  },
  professional: { clinicians: 5,   clients: 9999, locations: 2  },
  growth:       { clinicians: 25,  clients: 9999, locations: 5  },
  enterprise:   { clinicians: 75,  clients: 9999, locations: 15 },
  clinic:       { clinicians: 9999, clients: 9999, locations: 9999 },
};

export const PLAN_FEATURES = {
  starter:      { ai: false, insurance: false, edi: false, quickbooks: false, customBranding: false, whiteLabel: false, api: false, safmeds: false, parentPortal: false, analytics: false },
  basic:        { ai: true,  insurance: false, edi: false, quickbooks: false, customBranding: false, whiteLabel: false, api: false, safmeds: false, parentPortal: true,  analytics: false },
  professional: { ai: true,  insurance: true,  edi: false, quickbooks: false, customBranding: false, whiteLabel: false, api: false, safmeds: true,  parentPortal: true,  analytics: true  },
  growth:       { ai: true,  insurance: true,  edi: false, quickbooks: false, customBranding: false, whiteLabel: false, api: false, safmeds: true,  parentPortal: true,  analytics: true  },
  enterprise:   { ai: true,  insurance: true,  edi: true,  quickbooks: true,  customBranding: true,  whiteLabel: false, api: false, safmeds: true,  parentPortal: true,  analytics: true  },
  clinic:       { ai: true,  insurance: true,  edi: true,  quickbooks: true,  customBranding: true,  whiteLabel: true,  api: true,  safmeds: true,  parentPortal: true,  analytics: true  },
};

export const PLAN_NAMES: Record<string, string> = {
  starter: "Starter",
  basic: "Basic",
  professional: "Professional",
  growth: "Growth",
  enterprise: "Enterprise",
  clinic: "Clinic",
};

export const UPGRADE_PATH: Record<string, string> = {
  starter: "basic",
  basic: "professional",
  professional: "growth",
  growth: "enterprise",
  enterprise: "clinic",
  clinic: "clinic",
};

export function usePlanGate() {
  const [plan, setPlan] = useState<PlanType>(null);
  const [loading, setLoading] = useState(true);
  const [clientCount, setClientCount] = useState(0);
  const [clinicianCount, setClinicianCount] = useState(0);
  const [locationCount, setLocationCount] = useState(0);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) { setLoading(false); return; }

    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const cid = companyUser?.company_id ?? null;
    setCompanyId(cid);

    const { data: contract } = await supabase
      .from("subscription_contracts")
      .select("plan_type")
      .eq("user_id", user.id)
      .in("status", ["active", "trial"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const planType = (contract?.plan_type ?? "starter") as PlanType;
    setPlan(planType);

    if (cid) {
      const [
        { count: clients },
        { count: clinicians },
        { count: locations },
      ] = await Promise.all([
        supabase.from("clients").select("*", { count: "exact", head: true }),
        supabase.from("company_users").select("*", { count: "exact", head: true }).eq("company_id", cid).eq("status", "active"),
        supabase.from("locations").select("*", { count: "exact", head: true }).eq("company_id", cid),
      ]);

      setClientCount(clients ?? 0);
      setClinicianCount(clinicians ?? 0);
      setLocationCount(locations ?? 0);
    }

    setLoading(false);
  }

  function getLimits() {
    return PLAN_LIMITS[plan ?? "starter"];
  }

  function getFeatures() {
    return PLAN_FEATURES[plan ?? "starter"];
  }

  function canAddClient(): { allowed: boolean; reason?: string; upgradeTo?: string } {
    const limits = getLimits();
    if (clientCount >= limits.clients) {
      return {
        allowed: false,
        reason: "Your " + PLAN_NAMES[plan ?? "starter"] + " plan allows up to " + limits.clients + " clients.",
        upgradeTo: UPGRADE_PATH[plan ?? "starter"],
      };
    }
    return { allowed: true };
  }

  function canAddClinician(): { allowed: boolean; reason?: string; upgradeTo?: string } {
    const limits = getLimits();
    if (clinicianCount >= limits.clinicians) {
      return {
        allowed: false,
        reason: "Your " + PLAN_NAMES[plan ?? "starter"] + " plan allows up to " + limits.clinicians + " clinician" + (limits.clinicians === 1 ? "" : "s") + ".",
        upgradeTo: UPGRADE_PATH[plan ?? "starter"],
      };
    }
    return { allowed: true };
  }

  function canAddLocation(): { allowed: boolean; reason?: string; upgradeTo?: string } {
    const limits = getLimits();
    if (locationCount >= limits.locations) {
      return {
        allowed: false,
        reason: "Your " + PLAN_NAMES[plan ?? "starter"] + " plan allows up to " + limits.locations + " location" + (limits.locations === 1 ? "" : "s") + ".",
        upgradeTo: UPGRADE_PATH[plan ?? "starter"],
      };
    }
    return { allowed: true };
  }

  function hasFeature(feature: keyof typeof PLAN_FEATURES.starter): { allowed: boolean; upgradeTo?: string } {
    const features = getFeatures();
    if (!features[feature]) {
      return { allowed: false, upgradeTo: UPGRADE_PATH[plan ?? "starter"] };
    }
    return { allowed: true };
  }

  return {
    plan,
    loading,
    clientCount,
    clinicianCount,
    locationCount,
    companyId,
    limits: getLimits(),
    features: getFeatures(),
    canAddClient,
    canAddClinician,
    canAddLocation,
    hasFeature,
    planName: PLAN_NAMES[plan ?? "starter"],
    upgradePath: UPGRADE_PATH[plan ?? "starter"],
  };
}
