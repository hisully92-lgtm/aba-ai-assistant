"use client";

import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

const SETTINGS_SECTIONS = [
  {
    href: "/dashboard/settings/profile",
    icon: "👤",
    title: "My Profile",
    desc: "Name, photo, credentials, license number",
    color: "border-blue-100 hover:border-blue-300 hover:bg-blue-50",
  },
  {
    href: "/dashboard/settings/security",
    icon: "🔒",
    title: "Security",
    desc: "Password reset, magic link, two-factor authentication",
    color: "border-purple-100 hover:border-purple-300 hover:bg-purple-50",
  },
  {
    href: "/dashboard/settings/notifications",
    icon: "🔔",
    title: "Notifications",
    desc: "Push notifications and in-app alert preferences",
    color: "border-yellow-100 hover:border-yellow-300 hover:bg-yellow-50",
  },
  {
    href: "/dashboard/settings/sms",
    icon: "📱",
    title: "SMS Alerts",
    desc: "Text message alerts for sessions, pings, and reminders",
    color: "border-green-100 hover:border-green-300 hover:bg-green-50",
  },
  {
    href: "/dashboard/settings/billing",
    icon: "💳",
    title: "Plan & Billing",
    desc: "Subscription plan, payment method, invoices",
    color: "border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50",
  },
];

export default function SettingsPage() {
  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account, profile, and preferences.</p>
      </div>

      <div className="space-y-3">
        {SETTINGS_SECTIONS.map(section => (
          <Link key={section.href} href={section.href}
            className={`flex items-center gap-4 p-4 border rounded-xl bg-white transition-all ${section.color}`}>
            <span className="text-2xl shrink-0">{section.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800">{section.title}</p>
              <p className="text-sm text-gray-500 mt-0.5">{section.desc}</p>
            </div>
            <span className="text-gray-300 shrink-0">→</span>
          </Link>
        ))}
      </div>

      <div className="pt-2 border-t border-gray-100">
        <button onClick={handleLogout}
          className="flex items-center gap-4 p-4 border border-red-100 rounded-xl bg-white w-full text-left hover:bg-red-50 hover:border-red-300 transition-all">
          <span className="text-2xl shrink-0">🚪</span>
          <div>
            <p className="font-semibold text-red-600">Log Out</p>
            <p className="text-sm text-gray-400 mt-0.5">Sign out of your account on this device</p>
          </div>
        </button>
      </div>
    </div>
  );
}