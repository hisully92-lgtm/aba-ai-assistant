"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePlan } from "@/lib/billing/usePlan";

export function useRequirePro() {
  const { plan, loading } = usePlan();
  const router = useRouter();

  useEffect(() => {
    if (!loading && plan !== "pro") {
      router.push("/dashboard/upgrade");
    }
  }, [plan, loading, router]);

  return { plan, loading };
}