"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

import Sidebar from "@/components/layout/Sidebar";
import CompanyBanner from "@/components/layout/CompanyBanner";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  useEffect(() => {
    const checkAccess = async () => {
      const { data: sessionData } = await supabase.auth.getUser();
      const user = sessionData?.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data } = await supabase
        .from("company_users")
        .select("status")
        .eq("user_id", user.id)
        .single();

      if (data?.status !== "active") {
        router.replace("/pending-approval");
        return;
      }

      setLoading(false);
    };

    checkAccess();
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen bg-gray-50"
      style={{ height: "100vh", overflow: "hidden" }}
    >
      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          style={{ touchAction: "none" }}
        />
      )}

      {/* SIDEBAR */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0 lg:z-auto lg:flex-shrink-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* MAIN CONTENT */}
      <div
        className="flex flex-1 flex-col min-w-0"
        style={{
          height: "100vh",
          overflow: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "thin",
          scrollbarColor: "#cbd5e1 transparent",
          touchAction: "pan-y",
          overscrollBehavior: "contain",
        }}
      >
        {/* MOBILE HEADER */}
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-[#2a3a54] bg-[#1a2234] px-4 py-3 lg:hidden">
          <button
            type="button"
            aria-label="Open sidebar"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-white transition-colors hover:bg-[#2a3a54]"
          >
            ☰
          </button>

          <h1 className="text-lg font-bold text-white">ABA AI</h1>

          <div className="ml-auto">
            <Link
              href="/dashboard/search"
              aria-label="Search"
              className="inline-block rounded-lg p-1.5 text-white transition-colors hover:bg-[#2a3a54]"
            >
              🔍
            </Link>
          </div>
        </div>

        <CompanyBanner />

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}