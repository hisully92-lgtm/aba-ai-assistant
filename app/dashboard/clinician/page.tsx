"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function ClinicianPage() {
  const router = useRouter();

  useEffect(() => {
    async function redirect() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (user) {
        router.replace(`/dashboard/clinician/${user.id}`);
      }
    }
    redirect();
  }, [router]);

  return (
    <div className="p-8 text-gray-400">Loading clinician view...</div>
  );
}