"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import CompanyBanner from "@/components/layout/CompanyBanner";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50">
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
          lg:relative lg:z-auto lg:translate-x-0 lg:flex-shrink-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* MAIN CONTENT */}
      <div
        className="flex min-w-0 flex-1 flex-col overflow-x-hidden"
        style={{
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          minHeight: "100vh",
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
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
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

        <main
          className="flex-1 overflow-x-hidden p-4 md:p-6 lg:p-8"
          style={{
            touchAction: "pan-y",
            overscrollBehavior: "contain",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}