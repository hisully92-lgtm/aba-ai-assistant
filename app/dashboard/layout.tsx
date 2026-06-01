"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Sidebar from "@/components/layout/Sidebar";
import CompanyBanner from "@/components/layout/CompanyBanner";
import Link from "next/link";
import OnboardingTutorial from "@/components/OnboardingTutorials";

function SkeletonLoader() {
  return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-64 bg-[#1a2234] hidden lg:block shrink-0" />
      <div className="flex-1 p-8 space-y-6">
        <div className="h-8 bg-gray-200 rounded-xl w-48 animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAccess = async () => {
      const { data: sessionData } = await supabase.auth.getUser();
      const user = sessionData?.user;

      if (!user) { router.replace("/login"); return; }

      const { data: companyUsers } = await supabase
        .from("company_users")
        .select("status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (!companyUsers) {
        router.replace("/onboarding");
        return;
      }

      setLoading(false);
    };

    checkAccess();
  }, [router]);

  if (loading) return <SkeletonLoader />;

  return (
    <div className="flex min-h-screen bg-gray-50" style={{ height: "100vh", overflow: "hidden" }}>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          style={{ touchAction: "none" }} />
      )}

      <div className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:z-auto lg:flex-shrink-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex flex-1 flex-col min-w-0"
        style={{
          height: "100vh",
          overflow: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "thin",
          scrollbarColor: "#cbd5e1 transparent",
          touchAction: "pan-y",
          overscrollBehavior: "contain",
        }}>

        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-[#2a3a54] bg-[#1a2234] px-4 py-3 lg:hidden">
          <button type="button" aria-label="Open sidebar"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-white transition-colors hover:bg-[#2a3a54]">
            ☰
          </button>
          <h1 className="text-lg font-bold text-white">ABA AI</h1>
          <div className="ml-auto">
            <Link href="/dashboard/search" aria-label="Search"
              className="inline-block rounded-lg p-1.5 text-white transition-colors hover:bg-[#2a3a54]">
              🔍
            </Link>
          </div>
        </div>

        <CompanyBanner />

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <OnboardingTutorial />
          {children}
        </main>
      </div>
    </div>
  );
}