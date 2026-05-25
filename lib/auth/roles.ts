// =========================
// ROLE DEFINITIONS
// =========================

export type UserRole = "admin" | "supervisor" | "clinician" | "viewer";

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 4,
  supervisor: 3,
  clinician: 2,
  viewer: 1,
};

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    "view_supervisor_dashboard",
    "view_clinician_dashboard",
    "approve_exports",
    "reject_exports",
    "view_audit_logs",
    "manage_users",
    "view_analytics",
    "export_reports",
    "view_all_clients",
    "add_supervisor_notes",
  ],
  supervisor: [
    "view_supervisor_dashboard",
    "view_clinician_dashboard",
    "approve_exports",
    "reject_exports",
    "view_analytics",
    "export_reports",
    "view_all_clients",
    "add_supervisor_notes",
  ],
  clinician: [
    "view_clinician_dashboard",
    "export_reports",
    "view_own_clients",
  ],
  viewer: [
    "view_own_clients",
  ],
};

export function hasPermission(role: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasMinimumRole(userRole: UserRole, minimumRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    admin: "Administrator",
    supervisor: "Supervisor",
    clinician: "Clinician",
    viewer: "Viewer",
  };
  return labels[role] ?? "Unknown";
}