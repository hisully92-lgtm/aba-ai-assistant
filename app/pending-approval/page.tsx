"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      // This is the key line that fixes your issue
      await supabase.auth.getSession();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        router.replace("/onboarding");
      } else {
        router.replace("/login");
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      Signing you in...
    </div>
  );
}