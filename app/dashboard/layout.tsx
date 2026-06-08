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

function ExpiredScreen({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-red-100 rounded-2xl shadow-lg p-8 text-center space-y-6">
        <div className="text-5xl">🔒</div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscription Expired</h1>
          <p className="text-gray-500 text-sm mt-2">
            {isAdmin
              ? "Your clinic's subscription has expired. Please renew to restore access for your entire team."
              : "Your clinic's subscription has expired. Please contact your administrator to renew access."}
          </p>
        </div>

        {isAdmin ? (
          <div className="space-y-3">
            <Link href="/dashboard/settings/billing"
              className="block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors">
              Renew Subscription →
            </Link>
            <p className="text-xs text-gray-400">
              All team members are locked out until payment is made.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
              Your administrator needs to renew the subscription to restore access.
            </div>
            <button
              onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
              className="block w-full py-3 border border-gray-200 text-gray-600 rounded-xl font-medium text-sm hover:bg-gray-50 transition-colors">
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkAccess = async () => {
      const { data: sessionData } = await supabase.auth.getUser();
      const user = sessionData?.user;

      if (!user) { router.replace("/login"); return; }

      const [{ data: companyUser }, { data: contract }] = await Promise.all([
        supabase
          .from("company_users")
          .select("status, role, company_id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("subscription_contracts")
          .select("status, end_date")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (!companyUser) {
        router.replace("/onboarding");
        return;
      }

      const adminRole = ["admin", "director", "clinical_director"].includes(companyUser.role ?? "");
      setIsAdmin(adminRole);

      // Check if subscription is expired
      if (contract) {
        const isExpired = new Date(contract.end_date) < new Date();
        const isActive = contract.status === "active" || contract.status === "trial";

        if (isExpired || !isActive) {
          setExpired(true);
          setLoading(false);
          return;
        }
      }

      setLoading(false);
    };

    checkAccess();
  }, [router]);

  if (loading) return <SkeletonLoader />;

  // Block everyone when expired — admin sees renew button, others see contact admin message
  if (expired) return <ExpiredScreen isAdmin={isAdmin} />;

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