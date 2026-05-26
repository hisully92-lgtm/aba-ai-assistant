"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import CompanyBanner from "@/components/layout/CompanyBanner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">

      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR — fixed on mobile, relative on desktop */}
      <div className={`
        fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0 lg:z-auto lg:flex-shrink-0
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col bg-gray-50 min-w-0">

        {/* MOBILE TOP BAR */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-[#1a2234] sticky top-0 z-30 shadow-md">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white p-1.5 rounded-lg hover:bg-[#2a3a54] transition-colors"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-white font-bold text-lg flex-1">ABA AI</h1>
          
            href="/dashboard/search"
            className="text-white p-1.5 rounded-lg hover:bg-[#2a3a54] transition-colors"
            aria-label="Search"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </a>
        </div>

        <CompanyBanner />

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-hidden max-w-full">
          {children}
        </main>

      </div>
    </div>
  );
}