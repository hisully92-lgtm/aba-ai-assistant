"use client";

import { supabase } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/roles";
import { useRouter } from "next/navigation";

export async function requireRole(allowedRoles: UserRole[]) {
  const router = useRouter();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    router.replace("/login");
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  const role = profile?.role as UserRole;

  if (!allowedRoles.includes(role)) {
    router.replace("/login");
    return null;
  }

  return { user: session.user, role };
}