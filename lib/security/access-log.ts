import { logAudit } from "@/lib/audit/logAudit";

export async function logAccess(userId: string, resource: string) {
  await logAudit({
    userId,
    action: "resource_accessed",
    resource,
    metadata: {
      timestamp: new Date().toISOString(),
    },
  });
}