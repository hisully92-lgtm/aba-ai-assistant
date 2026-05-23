import { supabase } from "@/lib/supabase/client";

export async function getUserWithPlan() {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return { user: null, plan: "free" };
  }

  const { data } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  return {
    user,
    plan: data?.plan || "free",
  };
}