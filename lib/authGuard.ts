"use client";

import { supabase } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/roles";

export async function requireAuth(allowedRoles?: UserRole[]) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return { authorized: false, redirect: "/login" };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (error || !profile) {
    return { authorized: false, redirect: "/login" };
  }

  const role = profile.role as UserRole;

  // If no role restriction → just allow logged in users
  if (!allowedRoles) {
    return { authorized: true, user: session.user, role };
  }

  // If role not allowed → block access
  if (!allowedRoles.includes(role)) {
    return { authorized: false, redirect: "/login" };
  }

  return { authorized: true, user: session.user, role };
}