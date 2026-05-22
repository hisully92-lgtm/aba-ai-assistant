import { supabase } from "@/lib/supabase/client";

export async function handleExport(data: any[]) {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("exports_used, export_limit")
    .eq("id", user.id)
    .single();

  if (!profile) return;

  // 🚫 BLOCK IF LIMIT REACHED
  if (profile.exports_used >= profile.export_limit) {
    alert("Export limit reached. Upgrade to Pro.");
    return;
  }

  // ✅ INCREMENT USAGE
  await supabase
    .from("profiles")
    .update({
      exports_used: profile.exports_used + 1,
    })
    .eq("id", user.id);

  // 📦 EXPORT LOGIC
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