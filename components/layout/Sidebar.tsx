"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useRole } from "@/lib/hooks/useRole";
import { clearCompanyCache } from "@/lib/hooks/useCompany";

type NavChild = { label: string; href: string };
type NavItem = { label: string; href: string; icon: string; children: NavChild[] };

export default function Sidebar() {
  const pathname = usePathname();
  const { isAdmin, isSupervisor, isClinician } = useRole();

  async function handleLogout() {
    clearCompanyCache();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function isActive(href: string) {
    if (!pathname) return false;
    return pathname === href || pathname.startsWith(href + "/");
  }

  const nav: NavItem[] = [
    {
      label: "Session Notes",
      href: "/dashboard",
      icon: "📋",
      children: [
        { label: "New Session", href: "/dashboard" },
        { label: "Recent Sessions", href: "/dashboard/history" },
        { label: "Session Templates", href: "/dashboard/templates" },
        { label: "Session Error Log", href: "/dashboard/session-errors" },
      ],
    },
    {
      label: "Behavior Interventions",
      href: "/dashboard/behaviors",
      icon: "🧠",
      children: [
        { label: "Active Interventions", href: "/dashboard/behaviors" },
        { label: "Behavior Log", href: "/dashboard/behaviors/log" },
        { label: "Intervention History", href: "/dashboard/behaviors/history" },
      ],
    },
    {
      label: "Skill Programs",
      href: "/dashboard/programs",
      icon: "🎯",
      children: [
        { label: "Active Programs", href: "/dashboard/programs" },
        { label: "Program Progress", href: "/dashboard/programs/progress" },
        { label: "Add Program", href: "/dashboard/programs/new" },
      ],
    },
    {
      label: "Clients / Learners",
      href: "/dashboard/clients",
      icon: "👥",
      children: [
        { label: "All Clients", href: "/dashboard/clients" },
        { label: "Add Client", href: "/dashboard/clients/new" },
        { label: "Client Intake", href: "/dashboard/client-intake" },
        { label: "Treatment Plans", href: "/dashboard/treatment-plans" },
        { label: "Case Drilldown", href: "/dashboard/clients" },
        { label: "Timeline", href: "/dashboard/clients" },
        { label: "Exports", href: "/dashboard/clients" },
      ],
    },
    {
      label: "Schedule",
      href: "/dashboard/schedule",
      icon: "📅",
      children: [
        { label: "Calendar View", href: "/dashboard/schedule" },
        { label: "Time Tracking", href: "/dashboard/timetracking" },
        { label: "Signatures", href: "/dashboard/signatures" },
        { label: "Geofence", href: "/dashboard/geofence" },
        { label: "Reminders", href: "/dashboard/reminders" },
      ],
    },
    {
      label: "Insurance & Billing",
      href: "/dashboard/insurance",
      icon: "🏦",
      children: [
        { label: "Claims & Auth", href: "/dashboard/insurance" },
        { label: "Payroll Logs", href: "/dashboard/payroll" },
        { label: "AI Compliance Check", href: "/dashboard/insurance/ai-check" },
      ],
    },
    {
      label: "Team",
      href: "/dashboard/team",
      icon: "🏢",
      children: [
        { label: "Members", href: "/dashboard/team" },
        { label: "Invite Member", href: "/dashboard/team/invite" },
        { label: "Locations", href: "/dashboard/team/locations" },
        { label: "Supervision Logs", href: "/dashboard/supervision" },
        { label: "My Credentials", href: "/dashboard/credentials" },
      ],
    },
    {
      label: "Communication",
      href: "/dashboard/chat",
      icon: "💬",
      children: [
        { label: "Team Chat", href: "/dashboard/chat" },
        { label: "Direct Messages", href: "/dashboard/direct-messages" },
        { label: "Notifications", href: "/dashboard/notifications" },
        { label: "Parent Portal", href: "/dashboard/parent-portal" },
      ],
    },
    ...(isClinician ? [{
      label: "Clinical",
      href: "/dashboard/clinician",
      icon: "🏥",
      children: [
        { label: "Clinician View", href: "/dashboard/clinician" },
        { label: "DTT Data Collection", href: "/dashboard/dtt" },
        { label: "Task Analysis", href: "/dashboard/task-analysis" },
        { label: "AI Assistant", href: "/dashboard/ai-chat" },
        { label: "Suggestions", href: "/dashboard/suggestions" },
        { label: "SAFMEDS", href: "/dashboard/safmeds" },
        { label: "Progress Reports", href: "/dashboard/progress-reports" },
      ],
    }] : []),
    ...(isSupervisor ? [{
      label: "Supervisor",
      href: "/dashboard/supervisor",
      icon: "📊",
      children: [
        { label: "Dashboard", href: "/dashboard/supervisor" },
        { label: "Supervision Logs", href: "/dashboard/supervision" },
        { label: "Error Reports", href: "/dashboard/session-errors" },
        { label: "Progress Reports", href: "/dashboard/progress-reports" },
        { label: "Export Queue", href: "/dashboard/supervisor" },
      ],
    }] : []),
    ...(isAdmin ? [{
      label: "Admin",
      href: "/dashboard/admin",
      icon: "🔐",
      children: [
        { label: "Audit Logs", href: "/dashboard/admin/logs" },
        { label: "Billing Dashboard", href: "/dashboard/admin/billing" },
        { label: "API Docs", href: "/dashboard/docs" },
      ],
    }] : []),
    {
      label: "History",
      href: "/dashboard/history",
      icon: "📁",
      children: [
        { label: "Session History", href: "/dashboard/history" },
        { label: "Progress Reports", href: "/dashboard/progress-reports" },
        { label: "Export History", href: "/dashboard/history/exports" },
        { label: "AI Request History", href: "/dashboard/history/ai" },
      ],
    },
    {
      label: "Profile / Settings",
      href: "/dashboard/settings",
      icon: "⚙️",
      children: [
        { label: "My Profile", href: "/dashboard/settings" },
        { label: "My Credentials", href: "/dashboard/credentials" },
        { label: "Plan & Billing", href: "/dashboard/settings/billing" },
        { label: "Security", href: "/dashboard/settings/security" },
        { label: "Notifications", href: "/dashboard/settings/notifications" },
        { label: "SMS Alerts", href: "/dashboard/settings/sms" },
      ],
    },
    {
      label: "Help",
      href: "/dashboard/help",
      icon: "❓",
      children: [],
    },
    {
      label: "Upgrade to Pro",
      href: "/dashboard/upgrade",
      icon: "⭐",
      children: [],
    },
  ];

  return (
    <div className="w-64 min-h-screen bg-[#1a2234] flex flex-col">
      <div className="p-4 flex-1 overflow-y-auto">
        <Image
          src="/login-banner.jpg"
          alt="ABA AI"
          width={220}
          height={80}
          className="rounded-lg mb-2"
        />
        <h1 className="text-white font-bold text-xl mb-6">ABA AI</h1>

        <nav className="flex flex-col gap-1">
          {nav.map((item) => (
            <div key={item.href + item.label}>
              <Link
                href={item.href}
                className={`flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium transition-colors ${
                  isActive(item.href) ? "bg-[#2a3a54]" : "bg-[#243044] hover:bg-[#2a3a54]"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>

              {item.children.length > 0 && isActive(item.href) && (
                <div className="ml-3 mt-1 flex flex-col gap-1 border-l border-[#2a3a54] pl-3">
                  {item.children.map((child) => (
                    <Link
                      key={child.href + child.label}
                      href={child.href}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        pathname === child.href
                          ? "text-white bg-[#2a3a54]"
                          : "text-gray-400 hover:text-white hover:bg-[#2a3a54]"
                      }`}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-[#2a3a54]">
        <button
          onClick={handleLogout}
          className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-medium"
        >
          Log out
        </button>
      </div>
    </div>
  );
}