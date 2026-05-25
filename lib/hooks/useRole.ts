import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  hasPermission,
  hasMinimumRole,
  type UserRole,
} from "@/lib/auth/roles";

type RoleState = {
  role: UserRole | null;
  loading: boolean;
  hasPermission: (permission: string) => boolean;
  hasMinimumRole: (minimumRole: UserRole) => boolean;
  isAdmin: boolean;
  isSupervisor: boolean;
  isClinician: boolean;
};

export function useRole(): RoleState {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRole() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      setRole((profile?.role as UserRole) ?? "clinician");
      setLoading(false);
    }

    loadRole();
  }, []);

  return {
    role,
    loading,
    hasPermission: (permission: string) =>
      role ? hasPermission(role, permission) : false,
    hasMinimumRole: (minimumRole: UserRole) =>
      role ? hasMinimumRole(role, minimumRole) : false,
    isAdmin: role === "admin",
    isSupervisor: role === "supervisor" || role === "admin",
    isClinician: role === "clinician" || role === "supervisor" || role === "admin",
  };
}