"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useRole } from "@/lib/hooks/useRole";
import { clearCompanyCache } from "@/lib/hooks/useCompany";

type NavChild = { label: string; href: string };
type NavItem = { label: string; href: string; icon: string; children: NavChild[] };

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const { isAdmin, isSupervisor, isClinician, isStudentAnalyst, isDeveloper } = useRole();

  async function handleLogout() {
    clearCompanyCache();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function isActive(href: string) {
    if (!pathname) return false;
    return pathname === href || pathname.startsWith(href + "/");
  }

  function isChildActive(item: NavItem) {
    return item.children.some((child) => isActive(child.href));
  }

  function handleNavClick() {
    onClose?.();
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
        { label: "Data Collection Hub", href: "/dashboard/data-collection" },
        { label: "Data Collection Hub", href: "/dashboard/data-collection" },
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
        { label: "Interval Recording", href: "/dashboard/interval-recording" },
        { label: "Rate Data", href: "/dashboard/rate-data" },
        { label: "Visual Analytics", href: "/dashboard/analytics/graphs" },
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
        { label: "Program Books", href: "/dashboard/program-books" },
        { label: "Program Graphs", href: "/dashboard/analytics/graphs" },
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
        { label: "Assessments", href: "/dashboard/assessments" },
        { label: "Waitlist", href: "/dashboard/waitlist" },
        { label: "Case Drilldown", href: "/dashboard/clients" },
        { label: "Timeline", href: "/dashboard/clients" },
        { label: "Exports", href: "/dashboard/clients" },
        { label: "Authorizations", href: "/dashboard/authorizations" },
      ],
    },
    {
      label: "Schedule",
      href: "/dashboard/schedule",
      icon: "📅",
      children: [
        { label: "Calendar View", href: "/dashboard/schedule" },
        { label: "Session Changes", href: "/dashboard/session-changes" },
        { label: "Telehealth", href: "/dashboard/telehealth" },
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
        { label: "Insurance Providers", href: "/dashboard/insurance-providers" },
        { label: "ERA / EOB Posting", href: "/dashboard/billing/era-eob" },
        { label: "Superbills", href: "/dashboard/billing/superbills" },
        { label: "Revenue Cycle", href: "/dashboard/billing/rcm" },
        { label: "Payroll Logs", href: "/dashboard/payroll" },
        { label: "AI Compliance Check", href: "/dashboard/insurance/ai-check" },
        { label: "Authorizations", href: "/dashboard/authorizations" },
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
        { label: "Competency Checks", href: "/dashboard/competency" },
        { label: "Staff Performance", href: "/dashboard/staff-performance" },
        { label: "My Availability", href: "/dashboard/staff-availability" },
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
        { label: "Caregiver Training", href: "/dashboard/caregiver-training" },
        { label: "AI Parent Summary", href: "/dashboard/parent-portal/ai-summary" },
        { label: "Parent Documents", href: "/dashboard/parent-portal/documents" },
        { label: "Home Program Data", href: "/dashboard/parent-portal/home-program" },
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
        { label: "Prompt Fading", href: "/dashboard/prompt-fading" },
        { label: "Visual Supports", href: "/dashboard/visual-supports" },
        { label: "Social Stories", href: "/dashboard/social-stories" },
        { label: "Interval Recording", href: "/dashboard/interval-recording" },
        { label: "Rate Data", href: "/dashboard/rate-data" },
        { label: "Program Fidelity", href: "/dashboard/fidelity" },
        { label: "Assessments", href: "/dashboard/assessments" },
        { label: "Incident Reports", href: "/dashboard/incidents" },
        { label: "AI Assistant", href: "/dashboard/ai-chat" },
        { label: "AI Treatment Plans", href: "/dashboard/ai-treatment-plans" },
        { label: "Suggestions", href: "/dashboard/suggestions" },
        { label: "SAFMEDS", href: "/dashboard/safmeds" },
        { label: "Progress Reports", href: "/dashboard/progress-reports" },
        { label: "Report Templates", href: "/dashboard/report-templates" },
        { label: "Caregiver Training", href: "/dashboard/caregiver-training" },
      ],
    }] : []),
    ...(isStudentAnalyst ? [{
      label: "Student Hub",
      href: "/dashboard/student-hub",
      icon: "🎓",
      children: [
        { label: "Hour Tracker", href: "/dashboard/student-hub" },
        { label: "SAFMEDS", href: "/dashboard/safmeds" },
        { label: "Supervision Logs", href: "/dashboard/supervision" },
        { label: "My Credentials", href: "/dashboard/credentials" },
      ],
    }] : []),
    ...(isSupervisor ? [{
      label: "Supervisor",
      href: "/dashboard/supervisor",
      icon: "📊",
      children: [
        { label: "Dashboard", href: "/dashboard/supervisor" },
        { label: "Analytics", href: "/dashboard/analytics" },
        { label: "Macro Trends", href: "/dashboard/analytics/macro" },
        { label: "Behavior Heatmap", href: "/dashboard/analytics/heatmap" },
        { label: "Supervision Logs", href: "/dashboard/supervision" },
        { label: "Staff Performance", href: "/dashboard/staff-performance" },
        { label: "Competency Checks", href: "/dashboard/competency" },
        { label: "Program Fidelity", href: "/dashboard/fidelity" },
        { label: "Incident Reports", href: "/dashboard/incidents" },
        { label: "Error Reports", href: "/dashboard/session-errors" },
        { label: "Progress Reports", href: "/dashboard/progress-reports" },
        { label: "Export Queue", href: "/dashboard/supervisor" },
        { label: "Visual Analytics", href: "/dashboard/analytics/graphs" },
        { label: "Authorizations", href: "/dashboard/authorizations" },
      ],
    }] : []),
    
    
    ...(isDeveloper ? [{
  label: "Developer",
  href: "/dashboard/developer",
  icon: "🛠",
  children: [
    { label: "Dev Dashboard", href: "/dashboard/developer" },
    { label: "All Companies", href: "/dashboard/developer" },
    { label: "All Users", href: "/dashboard/developer" },
    { label: "Integrations", href: "/dashboard/admin/integrations" },
    { label: "Audit Logs", href: "/dashboard/developer" },
    { label: "System Status", href: "/dashboard/developer" },
    { label: "Accounting", href: "/dashboard/accounting" },
  ],
}] : []),
    
    ...(isAdmin ? [{
  label: "Admin",
  href: "/dashboard/admin",
  icon: "🔐",
  children: [
    { label: "Admin Panel", href: "/dashboard/admin" },
    { label: "Integrations", href: "/dashboard/admin/integrations" },
    { label: "Audit Logs", href: "/dashboard/admin/logs" },
    { label: "Billing Dashboard", href: "/dashboard/admin/billing" },
    { label: "Analytics", href: "/dashboard/analytics" },
    { label: "Macro Trends", href: "/dashboard/analytics/macro" },
    { label: "Revenue Cycle", href: "/dashboard/billing/rcm" },
    { label: "Staff Performance", href: "/dashboard/staff-performance" },
    { label: "Incident Reports", href: "/dashboard/incidents" },
    { label: "Waitlist", href: "/dashboard/waitlist" },
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
        { label: "My Profile", href: "/dashboard/settings/profile" },
        { label: "My Credentials", href: "/dashboard/credentials" },
        { label: "My Availability", href: "/dashboard/staff-availability" },
        { label: "Student Analyst Hub", href: "/dashboard/student-hub" },
        { label: "SAFMEDS", href: "/dashboard/safmeds" },
        { label: "Plan & Billing", href: "/dashboard/settings/billing" },
        { label: "Security", href: "/dashboard/settings/security" },
        { label: "Notifications", href: "/dashboard/settings/notifications" },
        { label: "SMS Alerts", href: "/dashboard/settings/sms" },
        { label: "Install App", href: "/dashboard/pwa" },
      ],
    },
    {
      label: "Search",
      href: "/dashboard/search",
      icon: "🔍",
      children: [],
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
    <div className="w-64 h-screen bg-[#1a2234] flex flex-col overflow-hidden">
      <div className="p-4 flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>

        {/* MOBILE HEADER — close button + title */}
        <div className="flex items-center justify-between mb-2 lg:hidden">
          <h1 className="text-white font-bold text-xl">ABA AI</h1>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* DESKTOP HEADER */}
        <Image
          src="/login-banner.jpg"
          alt="ABA AI"
          width={220}
          height={80}
          className="rounded-lg mb-2 hidden lg:block"
        />
        <h1 className="text-white font-bold text-xl mb-6 hidden lg:block">ABA AI</h1>

        <nav className="flex flex-col gap-1">
          {nav.map((item) => (
            <div key={`${item.href}-${item.label}`}>
              <Link
                href={item.href}
                onClick={handleNavClick}
                className={`flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium transition-colors ${
                  isActive(item.href) ? "bg-[#2a3a54]" : "bg-[#243044] hover:bg-[#2a3a54]"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>

              {item.children.length > 0 && isChildActive(item) && (
                <div className="ml-3 mt-1 flex flex-col gap-1 border-l border-[#2a3a54] pl-3">
                  {item.children.map((child) => (
                    <Link
                      key={`${child.href}-${child.label}`}
                      href={child.href}
                      onClick={handleNavClick}
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