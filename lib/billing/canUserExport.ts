import { supabase } from "@/lib/supabase/client";

type Plan = "free" | "basic" | "pro" | "enterprise";

type BillingStatus = {
  plan: Plan;
  exportLimit: number;
  exportsUsed: number;
  canExport: boolean;
};

export async function canUserExport(): Promise<BillingStatus> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return {
      plan: "free",
      exportLimit: 0,
      exportsUsed: 0,
      canExport: false,
    };
  }

  // 👇 profile must contain billing info (we’ll add this later if missing)
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, exports_used, export_limit")
    .eq("id", user.id)
    .single();

  const plan = (profile?.plan as Plan) ?? "free";
  const exportLimit = profile?.export_limit ?? 3;
  const exportsUsed = profile?.exports_used ?? 0;

  const canExport = plan !== "free" && exportsUsed < exportLimit;

  return {
    plan,
    exportLimit,
    exportsUsed,
    canExport,
  };
}