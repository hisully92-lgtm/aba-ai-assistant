"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

export default function AuthLoading() {
  useEffect(() => {
    async function check() {
      await new Promise(r => setTimeout(r, 500));
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        window.location.href = "/login?error=no_session";
        return;
      }

      const { data: companyUser } = await supabase
        .from("company_users")
        .select("company_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (companyUser?.company_id) {
        window.location.href = "/dashboard";
      } else {
        window.location.href = "/onboarding";
      }
    }
    check();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-500">Signing you in...</p>
      </div>
    </div>
  );
}