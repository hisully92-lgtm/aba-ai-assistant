import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type UserRole =
  | "developer"
  | "admin"
  | "director"
  | "supervisor"
  | "clinician"
  | "student_analyst"
  | "rbt"
  | "bt"
  | "office"
  | "accounting"
  | "hr"
  | "parent"
  | null;

export const ROLE_TIERS: Record<string, number> = {
  developer: 99,
  admin: 10,
  director: 9,
  supervisor: 8,
  clinician: 7,
  student_analyst: 6,
  rbt: 5,
  bt: 4,
  office: 3,
  accounting: 3,
  hr: 3,
  parent: 1,
};

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  developer: ["*"],
  admin: ["*"],
  director: ["dashboard", "clients", "billing", "staff", "reports", "settings", "clinical", "supervisor"],
  supervisor: ["dashboard", "clients", "clinical", "staff", "reports", "supervisor"],
  clinician: ["dashboard", "clients", "clinical", "reports"],
  student_analyst: ["dashboard", "clients", "clinical", "student_hub"],
  rbt: ["dashboard", "clients", "clinical"],
  bt: ["dashboard", "clients", "clinical"],
  office: ["dashboard", "clients", "billing", "insurance"],
  accounting: ["dashboard", "billing", "insurance", "reports"],
  hr: ["dashboard", "staff", "credentials"],
  parent: ["parent_portal"],
};

export const ROLE_DASHBOARD_ACCESS: Record<string, string[]> = {
  developer: ["*"],
  admin: ["*"],
  director: [
    "/dashboard", "/dashboard/clients", "/dashboard/behaviors", "/dashboard/programs",
    "/dashboard/schedule", "/dashboard/insurance", "/dashboard/team", "/dashboard/chat",
    "/dashboard/clinician", "/dashboard/supervisor", "/dashboard/history",
    "/dashboard/settings", "/dashboard/analytics", "/dashboard/billing",
    "/dashboard/authorizations", "/dashboard/incidents", "/dashboard/reports",
  ],
  supervisor: [
    "/dashboard", "/dashboard/clients", "/dashboard/behaviors", "/dashboard/programs",
    "/dashboard/schedule", "/dashboard/team", "/dashboard/chat", "/dashboard/clinician",
    "/dashboard/supervisor", "/dashboard/history", "/dashboard/settings",
    "/dashboard/analytics", "/dashboard/authorizations", "/dashboard/incidents",
  ],
  clinician: [
    "/dashboard", "/dashboard/clients", "/dashboard/behaviors", "/dashboard/programs",
    "/dashboard/schedule", "/dashboard/chat", "/dashboard/clinician",
    "/dashboard/history", "/dashboard/settings",
  ],
  student_analyst: [
    "/dashboard", "/dashboard/clients", "/dashboard/behaviors", "/dashboard/programs",
    "/dashboard/student-hub", "/dashboard/safmeds", "/dashboard/chat", "/dashboard/settings",
  ],
  rbt: [
    "/dashboard", "/dashboard/clients", "/dashboard/behaviors", "/dashboard/programs",
    "/dashboard/schedule", "/dashboard/chat", "/dashboard/history", "/dashboard/settings",
  ],
  bt: [
    "/dashboard", "/dashboard/clients", "/dashboard/behaviors", "/dashboard/programs",
    "/dashboard/schedule", "/dashboard/chat", "/dashboard/history", "/dashboard/settings",
  ],
  office: [
    "/dashboard", "/dashboard/clients", "/dashboard/insurance", "/dashboard/billing",
    "/dashboard/schedule", "/dashboard/authorizations", "/dashboard/settings",
  ],
  accounting: [
    "/dashboard", "/dashboard/billing", "/dashboard/insurance", "/dashboard/payroll",
    "/dashboard/analytics", "/dashboard/settings",
  ],
  hr: [
    "/dashboard", "/dashboard/team", "/dashboard/credentials", "/dashboard/staff-performance",
    "/dashboard/competency", "/dashboard/settings",
  ],
  parent: [
    "/dashboard/parent-portal", "/dashboard/parent-portal/ai-summary",
    "/dashboard/parent-portal/documents", "/dashboard/parent-portal/home-program",
  ],
};

export function useRole() {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isDeveloper, setIsDeveloper] = useState(false);

  useEffect(() => {
    async function fetchRole() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) { setLoading(false); return; }

      setUserId(user.id);

      const { data } = await supabase
        .from("profiles")
        .select("role, is_developer")
        .eq("id", user.id)
        .single();

      const userRole = (data?.role as UserRole) ?? null;
      const devFlag = data?.is_developer ?? false;

      setRole(devFlag ? "developer" : userRole);
      setIsDeveloper(devFlag);
      setLoading(false);
    }
    fetchRole();
  }, []);

  function hasPermission(permission: string): boolean {
    if (isDeveloper) return true;
    if (!role) return false;
    const perms = ROLE_PERMISSIONS[role] ?? [];
    return perms.includes("*") || perms.includes(permission);
  }

  function canAccessPath(path: string): boolean {
    if (isDeveloper) return true;
    if (!role) return false;
    const access = ROLE_DASHBOARD_ACCESS[role] ?? [];
    if (access.includes("*")) return true;
    return access.some((a) => path.startsWith(a));
  }

  function meetsMinTier(minTier: number): boolean {
    return (ROLE_TIERS[role ?? ""] ?? 0) >= minTier;
  }

  return {
    role,
    loading,
    userId,
    isDeveloper,
    tier: ROLE_TIERS[role ?? ""] ?? 0,
    hasPermission,
    canAccessPath,
    meetsMinTier,
    isAdmin: isDeveloper || role === "admin",
    isDirector: isDeveloper || role === "director" || role === "admin",
    isSupervisor: isDeveloper || ["supervisor", "director", "admin"].includes(role ?? ""),
    isClinician: isDeveloper || ["clinician", "supervisor", "director", "admin"].includes(role ?? ""),
    isRBT: role === "rbt" || role === "bt",
    isStudentAnalyst: role === "student_analyst",
    isOfficeStaff: ["office", "accounting", "hr"].includes(role ?? ""),
    isParent: role === "parent",
    canBill: isDeveloper || ["admin", "director", "office", "accounting"].includes(role ?? ""),
    canSupervise: isDeveloper || ["admin", "director", "supervisor"].includes(role ?? ""),
    canViewAllClients: isDeveloper || ["admin", "director", "supervisor", "clinician"].includes(role ?? ""),
    canEditTreatmentPlans: isDeveloper || ["admin", "director", "supervisor", "clinician"].includes(role ?? ""),
  };
}