"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRole } from "@/lib/hooks/useRole";
import { clearCompanyCache } from "@/lib/hooks/useCompany";

type NavChild = { label: string; href: string };
type NavItem = { label: string; href: string; icon: string; children: NavChild[] };

interface SidebarProps {
  onClose?: () => void;
}

const QUICK_INDEX = [
  { label: "Dashboard", href: "/dashboard", icon: "🏠" },
  { label: "Clients", href: "/dashboard/clients", icon: "👥" },
  { label: "Schedule", href: "/dashboard/schedule", icon: "📅" },
  { label: "Billing", href: "/dashboard/insurance", icon: "🏦" },
  { label: "Analytics", href: "/dashboard/analytics/graphs", icon: "📈" },
  { label: "BIP Plans", href: "/dashboard/bip", icon: "🧠" },
  { label: "Team", href: "/dashboard/team", icon: "🏢" },
  { label: "Help", href: "/dashboard/help", icon: "❓" },
];

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const { isAdmin, isSupervisor, isClinician, isStudentAnalyst, isDeveloper } = useRole();
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  async function handleLogout() {
    clearCompanyCache();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function isActive(href: string) {
    if (!pathname) return false;
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  function isChildActive(item: NavItem) {
    return item.children.some((child) => pathname === child.href);
  }

  function toggleSection(key: string) {
    setOpenSections((prev) => {
      const isOpen = isSectionOpenByKey(key);
      if (isOpen) {
        return [...prev.filter((k) => k !== key), key + "_closed"];
      } else {
        return [...prev.filter((k) => k !== key + "_closed"), key];
      }
    });
  }

  function isSectionOpenByKey(key: string) {
    if (openSections.includes(key + "_closed")) return false;
    if (openSections.includes(key)) return true;
    const item = nav.find((i) => i.href + i.label === key);
    return item ? isChildActive(item) : false;
  }

  function isSectionOpen(item: NavItem) {
    const key = item.href + item.label;
    if (openSections.includes(key + "_closed")) return false;
    if (openSections.includes(key)) return true;
    return isChildActive(item);
  }

  function handleNavClick() {
    onClose?.();
  }

  function sortChildren(children: NavChild[]): NavChild[] {
    return [...children].sort((a, b) => a.label.localeCompare(b.label));
  }

  const nav: NavItem[] = [
    {
      label: "Session Notes",
      href: "/dashboard",
      icon: "📋",
      children: sortChildren([
        { label: "Data Collection Hub", href: "/dashboard/data-collection" },
        { label: "New Session", href: "/dashboard" },
        { label: "Recent Sessions", href: "/dashboard/history" },
        { label: "Session Error Log", href: "/dashboard/session-errors" },
        { label: "Session Templates", href: "/dashboard/templates" },
      ]),
    },
    {
      label: "Behavior Interventions",
      href: "/dashboard/behaviors",
      icon: "🧠",
      children: sortChildren([
        { label: "ABC Data", href: "/dashboard/behaviors/abc" },
        { label: "Active Interventions", href: "/dashboard/behaviors" },
        { label: "Behavior Log", href: "/dashboard/behaviors/log" },
        { label: "Intervention History", href: "/dashboard/behaviors/history" },
        { label: "Interval Recording", href: "/dashboard/interval-recording" },
        { label: "Rate Data", href: "/dashboard/rate-data" },
        { label: "Visual Analytics", href: "/dashboard/analytics/graphs" },
      ]),
    },
    {
      label: "Skill Programs",
      href: "/dashboard/programs",
      icon: "🎯",
      children: sortChildren([
        { label: "Active Programs", href: "/dashboard/programs" },
        { label: "Add Program", href: "/dashboard/programs/new" },
        { label: "DTT Data Collection", href: "/dashboard/dtt" },
        { label: "Program Books", href: "/dashboard/program-books" },
        { label: "Program Fidelity", href: "/dashboard/fidelity" },
        { label: "Program Progress", href: "/dashboard/programs/progress" },
      ]),
    },
    {
      label: "Clients / Learners",
      href: "/dashboard/clients",
      icon: "👥",
      children: sortChildren([
        { label: "Add Client", href: "/dashboard/clients/new" },
        { label: "All Clients", href: "/dashboard/clients" },
        { label: "Assessments", href: "/dashboard/assessments" },
        { label: "Authorizations", href: "/dashboard/authorizations" },
        { label: "BIP Plans", href: "/dashboard/bip" },
        { label: "Client Intake", href: "/dashboard/client-intake" },
        { label: "Crisis Plans", href: "/dashboard/crisis-plans" },
        { label: "Discharge Planning", href: "/dashboard/discharge" },
        { label: "Goals Dashboard", href: "/dashboard/goals" },
        { label: "Treatment Plans", href: "/dashboard/treatment-plans" },
        { label: "Waitlist", href: "/dashboard/waitlist" },
      ]),
    },
    {
      label: "Schedule",
      href: "/dashboard/schedule",
      icon: "📅",
      children: sortChildren([
        { label: "Calendar View", href: "/dashboard/schedule" },
        { label: "Geofence", href: "/dashboard/geofence" },
        { label: "Reminders", href: "/dashboard/reminders" },
        { label: "Schedule Conflicts", href: "/dashboard/schedule/conflicts" },
        { label: "Session Changes", href: "/dashboard/session-changes" },
        { label: "Session Recordings", href: "/dashboard/telehealth/recordings" },
        { label: "Signatures", href: "/dashboard/signatures" },
        { label: "Telehealth", href: "/dashboard/telehealth" },
        { label: "Time Tracking", href: "/dashboard/timetracking" },
        { label: "Waiting Room", href: "/dashboard/telehealth/waiting-room" },
      ]),
    },
    {
      label: "Insurance & Billing",
      href: "/dashboard/insurance",
      icon: "🏦",
      children: sortChildren([
        { label: "AI Compliance Check", href: "/dashboard/insurance/ai-check" },
        { label: "Authorizations", href: "/dashboard/authorizations" },
        { label: "Claims & Auth", href: "/dashboard/insurance" },
        { label: "CMS-1500 Claims", href: "/dashboard/billing/cms1500" },
        { label: "Co-pay Tracking", href: "/dashboard/copay" },
        { label: "Eligibility Verification", href: "/dashboard/eligibility" },
        { label: "ERA / EOB Posting", href: "/dashboard/billing/era-eob" },
        { label: "Insurance Providers", href: "/dashboard/insurance-providers" },
        { label: "Payroll Logs", href: "/dashboard/payroll" },
        { label: "Revenue Cycle", href: "/dashboard/billing/rcm" },
        { label: "Superbills", href: "/dashboard/billing/superbills" },
      ]),
    },
    {
      label: "Team",
      href: "/dashboard/team",
      icon: "🏢",
      children: sortChildren([
        { label: "Accounting", href: "/dashboard/accounting" },
        { label: "Competency Checks", href: "/dashboard/competency" },
        { label: "Invite Member", href: "/dashboard/team/invite" },
        { label: "Locations", href: "/dashboard/team/locations" },
        { label: "Members", href: "/dashboard/team" },
        { label: "Staff Performance", href: "/dashboard/staff-performance" },
        { label: "Supervision Logs", href: "/dashboard/supervision" },
        { label: "Time Off Requests", href: "/dashboard/time-off" },
      ]),
    },
    {
      label: "Communication",
      href: "/dashboard/chat",
      icon: "💬",
      children: sortChildren([
        { label: "AI Parent Summary", href: "/dashboard/parent-portal/ai-summary" },
        { label: "Caregiver Training", href: "/dashboard/caregiver-training" },
        { label: "Direct Messages", href: "/dashboard/direct-messages" },
        { label: "Home Program Data", href: "/dashboard/parent-portal/home-program" },
        { label: "Notifications", href: "/dashboard/notifications" },
        { label: "Parent Documents", href: "/dashboard/parent-portal/documents" },
        { label: "Parent Portal", href: "/dashboard/parent-portal" },
        { label: "Team Chat", href: "/dashboard/chat" },
      ]),
    },
    ...(isClinician ? [{
      label: "Clinical",
      href: "/dashboard/clinician",
      icon: "🏥",
      children: sortChildren([
        { label: "AI Assistant", href: "/dashboard/ai-chat" },
        { label: "AI Treatment Plans", href: "/dashboard/ai-treatment-plans" },
        { label: "Assessments", href: "/dashboard/assessments" },
        { label: "BIP Plans", href: "/dashboard/bip" },
        { label: "Clinician View", href: "/dashboard/clinician" },
        { label: "Crisis Plans", href: "/dashboard/crisis-plans" },
        { label: "Data Collection Hub", href: "/dashboard/data-collection" },
        { label: "Discharge Planning", href: "/dashboard/discharge" },
        { label: "Incident Reports", href: "/dashboard/incidents" },
        { label: "Preference Assessment", href: "/dashboard/preference-assessment" },
        { label: "Progress Reports", href: "/dashboard/progress-reports" },
        { label: "Prompt Fading", href: "/dashboard/prompt-fading" },
        { label: "RBT Checklist", href: "/dashboard/rbt-checklist" },
        { label: "Report Templates", href: "/dashboard/report-templates" },
        { label: "SAFMEDS", href: "/dashboard/safmeds" },
        { label: "Social Stories", href: "/dashboard/social-stories" },
        { label: "Suggestions", href: "/dashboard/suggestions" },
        { label: "Task Analysis", href: "/dashboard/task-analysis" },
        { label: "40-Hour RBT Course", href: "/dashboard/training/course" },
        { label: "Training Certificate", href: "/dashboard/training/certificate" },
        { label: "Training Library", href: "/dashboard/training" },
        { label: "Visual Supports", href: "/dashboard/visual-supports" },
      ]),
    }] : []),
    ...(isStudentAnalyst ? [{
      label: "Student Hub",
      href: "/dashboard/student-hub",
      icon: "🎓",
      children: sortChildren([
        { label: "Hour Tracker", href: "/dashboard/student-hub" },
        { label: "My Credentials", href: "/dashboard/credentials" },
        { label: "SAFMEDS", href: "/dashboard/safmeds" },
        { label: "Supervision Logs", href: "/dashboard/supervision" },
      ]),
    }] : []),
    ...(isSupervisor ? [{
      label: "Supervisor",
      href: "/dashboard/supervisor",
      icon: "📊",
      children: sortChildren([
        { label: "Analytics", href: "/dashboard/analytics" },
        { label: "Authorizations", href: "/dashboard/authorizations" },
        { label: "Behavior Heatmap", href: "/dashboard/analytics/heatmap" },
        { label: "Competency Checks", href: "/dashboard/competency" },
        { label: "Dashboard", href: "/dashboard/supervisor" },
        { label: "Error Reports", href: "/dashboard/session-errors" },
        { label: "Incident Reports", href: "/dashboard/incidents" },
        { label: "Macro Trends", href: "/dashboard/analytics/macro" },
        { label: "Program Fidelity", href: "/dashboard/fidelity" },
        { label: "Progress Reports", href: "/dashboard/progress-reports" },
        { label: "Staff Performance", href: "/dashboard/staff-performance" },
        { label: "Supervision Logs", href: "/dashboard/supervision" },
        { label: "Visual Analytics", href: "/dashboard/analytics/graphs" },
      ]),
    }] : []),
    ...(isAdmin ? [{
      label: "Admin",
      href: "/dashboard/admin",
      icon: "🔐",
      children: sortChildren([
        { label: "Admin Panel", href: "/dashboard/admin" },
        { label: "Analytics", href: "/dashboard/analytics" },
        { label: "Audit Logs", href: "/dashboard/admin/logs" },
        { label: "BIP Plans", href: "/dashboard/bip" },
        { label: "Billing Dashboard", href: "/dashboard/admin/billing" },
        { label: "Feature Access", href: "/dashboard/admin/access" },
        { label: "Incident Reports", href: "/dashboard/incidents" },
        { label: "Integrations", href: "/dashboard/admin/integrations" },
        { label: "Locations", href: "/dashboard/admin/locations" },
        { label: "Macro Trends", href: "/dashboard/analytics/macro" },
        { label: "Revenue Cycle", href: "/dashboard/billing/rcm" },
        { label: "Staff Performance", href: "/dashboard/staff-performance" },
        { label: "Training Admin", href: "/dashboard/training/admin" },
        { label: "Visual Analytics", href: "/dashboard/analytics/graphs" },
        { label: "Waitlist", href: "/dashboard/waitlist" },
      ]),
    }] : []),
    ...(isDeveloper ? [{
      label: "Developer",
      href: "/dashboard/developer",
      icon: "🛠",
      children: sortChildren([
        { label: "Accounting", href: "/dashboard/accounting" },
        { label: "Dev Dashboard", href: "/dashboard/developer" },
        { label: "Integrations", href: "/dashboard/admin/integrations" },
      ]),
    }] : []),
    {
      label: "Analytics",
      href: "/dashboard/analytics",
      icon: "📈",
      children: sortChildren([
        { label: "ABA Graphs", href: "/dashboard/analytics/graphs" },
        { label: "Behavior Heatmap", href: "/dashboard/analytics/heatmap" },
        { label: "Macro Trends", href: "/dashboard/analytics/macro" },
      ]),
    },
    {
      label: "History",
      href: "/dashboard/history",
      icon: "📁",
      children: sortChildren([
        { label: "AI Request History", href: "/dashboard/history/ai" },
        { label: "Export History", href: "/dashboard/history/exports" },
        { label: "Progress Reports", href: "/dashboard/progress-reports" },
        { label: "Session History", href: "/dashboard/history" },
      ]),
    },
    {
      label: "Profile / Settings",
      href: "/dashboard/settings",
      icon: "⚙️",
      children: sortChildren([
        { label: "40-Hour RBT Course", href: "/dashboard/training/course" },
        { label: "Install App", href: "/dashboard/pwa" },
        { label: "My Availability", href: "/dashboard/staff-availability" },
        { label: "My Credentials", href: "/dashboard/credentials" },
        { label: "My Profile", href: "/dashboard/settings/profile" },
        { label: "Notifications", href: "/dashboard/settings/notifications" },
        { label: "Plan & Billing", href: "/dashboard/settings/billing" },
        { label: "Security", href: "/dashboard/settings/security" },
        { label: "SMS Alerts", href: "/dashboard/settings/sms" },
        { label: "Student Analyst Hub", href: "/dashboard/student-hub" },
        { label: "Training Certificate", href: "/dashboard/training/certificate" },
        { label: "Training Library", href: "/dashboard/training" },
      ]),
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
  ];

  const filteredNav = searchQuery
    ? nav.map((item) => ({
        ...item,
        children: item.children.filter((child) =>
          child.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.label.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter((item) =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.children.length > 0
      )
    : nav;

  return (
    <div className="w-64 bg-[#1a2234] flex flex-col" style={{ height: "100vh", overflow: "hidden" }}>

      {/* MOBILE CLOSE */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 lg:hidden">
        <h1 className="text-white font-bold text-xl">ABA AI</h1>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* DESKTOP LOGO */}
      <div className="px-4 pt-4 pb-1 hidden lg:block">
        <Image
          src="/login-banner.jpg"
          alt="ABA AI"
          width={220}
          height={80}
          className="rounded-lg mb-2"
        />
        <h1 className="text-white font-bold text-xl">ABA AI</h1>
        <p className="text-gray-500 text-xs mt-0.5">Practice Management</p>
      </div>

      {/* FIXED QUICK INDEX */}
      <div className="px-3 py-2 border-b border-[#2a3a54]">
        <p className="text-gray-500 text-xs uppercase tracking-wide font-medium px-1 mb-1.5">Quick Access</p>
        <div className="grid grid-cols-4 gap-1">
          {QUICK_INDEX.map((item) => (
            <Link key={item.href + item.label} href={item.href} onClick={handleNavClick}
              className={`flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg text-center transition-colors ${isActive(item.href) ? "bg-[#2a3a54] text-white" : "text-gray-400 hover:text-white hover:bg-[#243044]"}`}>
              <span className="text-base">{item.icon}</span>
              <span className="text-xs leading-tight">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* SEARCH */}
      <div className="px-3 py-2 border-b border-[#2a3a54]">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pages..."
            className="w-full bg-[#243044] text-white text-xs rounded-lg px-3 py-2 pl-7 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 border border-[#2a3a54]"
          />
          <svg className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* SCROLLABLE NAV */}
      <div className="flex-1 px-2 py-2 overflow-y-auto"
        style={{ WebkitOverflowScrolling: "touch" as any, overscrollBehavior: "contain" }}>
        <nav className="flex flex-col gap-0.5">
          {filteredNav.map((item) => (
            <div key={`${item.href}-${item.label}`}>
              <div className="flex items-center gap-0.5">
                <Link
                  href={item.href}
                  onClick={handleNavClick}
                  className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-white text-xs font-medium transition-colors ${isActive(item.href) ? "bg-[#2a3a54]" : "bg-[#243044] hover:bg-[#2a3a54]"}`}
                >
                  <span className="text-sm">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
                {item.children.length > 0 && (
                  <button
                    onClick={() => toggleSection(item.href + item.label)}
                    className="px-1.5 py-2 text-gray-400 hover:text-white transition-colors text-xs"
                    type="button"
                  >
                    {isSectionOpen(item) ? "▲" : "▼"}
                  </button>
                )}
              </div>

              {item.children.length > 0 && isSectionOpen(item) && (
                <div className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-[#2a3a54] pl-2.5 mb-1">
                  {item.children.map((child) => (
                    <Link
                      key={`${child.href}-${child.label}`}
                      href={child.href}
                      onClick={handleNavClick}
                      className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${pathname === child.href ? "text-white bg-[#2a3a54]" : "text-gray-400 hover:text-white hover:bg-[#2a3a54]"}`}
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

      {/* LOGOUT */}
      <div className="p-3 border-t border-[#2a3a54]">
        <button
          onClick={handleLogout}
          className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Log out
        </button>
      </div>
    </div>
  );
}