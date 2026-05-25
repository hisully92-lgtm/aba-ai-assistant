import { supabaseAdmin } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { logAudit } from "@/lib/observability/logAudit";
import { hasMinimumRole, hasPermission, type UserRole } from "@/lib/auth/roles";

type UserProfile = {
  id: string;
  role: UserRole;
  plan: string;
  subscription_status: string;
};

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, role, plan, subscription_status")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new AppError("UNAUTHORIZED", "Profile not found", { status: 401 });
  }

  return {
    id: data.id,
    role: (data.role as UserRole) ?? "clinician",
    plan: data.plan,
    subscription_status: data.subscription_status,
  };
}

export async function requireRole(
  userId: string,
  minimumRole: UserRole
): Promise<UserProfile> {
  const profile = await getUserProfile(userId);

  if (!hasMinimumRole(profile.role, minimumRole)) {
    await logAudit({
      userId,
      action: "rbac.access_denied",
      resource: "role_check",
      metadata: {
        userRole: profile.role,
        requiredRole: minimumRole,
      },
    });

    throw new AppError(
      "FORBIDDEN",
      `This action requires ${minimumRole} access or higher`,
      { status: 403 }
    );
  }

  return profile;
}

export async function requirePermission(
  userId: string,
  permission: string
): Promise<UserProfile> {
  const profile = await getUserProfile(userId);

  if (!hasPermission(profile.role, permission)) {
    await logAudit({
      userId,
      action: "rbac.permission_denied",
      resource: "permission_check",
      metadata: {
        userRole: profile.role,
        requiredPermission: permission,
      },
    });

    throw new AppError(
      "FORBIDDEN",
      `Missing permission: ${permission}`,
      { status: 403 }
    );
  }

  return profile;
}