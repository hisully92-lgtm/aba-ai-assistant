"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

export default function AuthLoading() {
  useEffect(() => {
    async function check() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const token_hash = params.get("token_hash");
      const type = params.get("type");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          window.location.href = `/login?error=${encodeURIComponent(error.message)}`;
          return;
        }
      } else if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as any,
        });
        if (error) {
          window.location.href = `/login?error=${encodeURIComponent(error.message)}`;
          return;
        }
      } else {
        await new Promise(r => setTimeout(r, 1000));
      }

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