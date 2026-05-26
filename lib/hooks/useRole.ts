import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type UserRole =
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

export function useRole() {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRole() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) { setLoading(false); return; }

      setUserId(user.id);

      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      setRole((data?.role as UserRole) ?? null);
      setLoading(false);
    }
    fetchRole();
  }, []);

  function hasPermission(permission: string): boolean {
    if (!role) return false;
    const perms = ROLE_PERMISSIONS[role] ?? [];
    return perms.includes("*") || perms.includes(permission);
  }

  function meetsMinTier(minTier: number): boolean {
    return (ROLE_TIERS[role ?? ""] ?? 0) >= minTier;
  }

  return {
    role,
    loading,
    userId,
    tier: ROLE_TIERS[role ?? ""] ?? 0,
    hasPermission,
    meetsMinTier,
    isAdmin: role === "admin",
    isDirector: role === "director" || role === "admin",
    isSupervisor: role === "supervisor" || role === "director" || role === "admin",
    isClinician: ["clinician", "supervisor", "director", "admin"].includes(role ?? ""),
    isRBT: role === "rbt" || role === "bt",
    isStudentAnalyst: role === "student_analyst",
    isOfficeStaff: ["office", "accounting", "hr"].includes(role ?? ""),
    isParent: role === "parent",
    canBill: ["admin", "director", "office", "accounting"].includes(role ?? ""),
    canSupervise: ["admin", "director", "supervisor"].includes(role ?? ""),
    canViewAllClients: ["admin", "director", "supervisor", "clinician"].includes(role ?? ""),
    canEditTreatmentPlans: ["admin", "director", "supervisor", "clinician"].includes(role ?? ""),
  };
}