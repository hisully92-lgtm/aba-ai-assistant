"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleAuth = async () => {
      const { error } = await supabase.auth.getSession();

      if (error) {
        console.error("Auth callback error:", error.message);
        router.push("/login");
        return;
      }

      router.push("/dashboard");
    };

    handleAuth();
  }, [router]);

  return <div>Signing you in...</div>;
}