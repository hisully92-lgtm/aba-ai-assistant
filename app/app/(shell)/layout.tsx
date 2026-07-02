"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { TimerProvider, EVVProvider } from "@/lib/mobileContext";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then((result: any) => {
      if (!result?.data?.user) { router.replace("/app"); return; }
      setChecked(true);
    });
  }, [router]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0f172a" }}>
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <TimerProvider>
      <EVVProvider>{children}</EVVProvider>
    </TimerProvider>
  );
}
