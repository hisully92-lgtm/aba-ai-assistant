import { supabase } from "@/lib/supabase/client";
import { checkExportLimit, incrementExportUsage } from "@/lib/billing/planEngine";

export async function handleExport(data: any[]) {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) return;

  // CHECK LIMIT VIA PLAN ENGINE
  const { allowed, used, limit } = await checkExportLimit(user.id);

  if (!allowed) {
    alert(`Export limit reached (${used}/${limit}). Upgrade to Pro.`);
    return;
  }

  // INCREMENT USAGE VIA PLAN ENGINE
  await incrementExportUsage(user.id);

  // EXPORT LOGIC
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "export.json";
  a.click();
  URL.revokeObjectURL(url);
}