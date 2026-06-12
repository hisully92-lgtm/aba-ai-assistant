"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";

type Stats = {
  totalClients: number;
  sessionsThisWeek: number;
  activeGoals: number;
  pendingSessions: number;
  expiringAuths: number;
  hoursThisWeek: number;
};

type ChecklistItem = {
  key: string;
  label: string;
  description: string;
  href: string;
  done: boolean;
};

function StatSkeleton() {
  return (
    <div className="border rounded-xl p-4 text-center bg-white animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-12 mx-auto mb-2" />
      <div className="h-3 bg-gray-200 rounded w-20 mx-auto" />
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [checklistDone, setChecklistDone] = useState(false);
  const [clockedIn, setClockedIn] = useState(false);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const [
      { data: profile },
      { data: clients },
      { data: sessions },
      { data: goals },
      { data: timeEntries },
      { data: intakes },
      { data: activeTimeEntry },
    ] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
      supabase.from("clients").select("id").eq("created_by", user.id),
      supabase.from("sessions").select("id, status, created_at").eq("created_by", user.id),
      supabase.from("client_goals").select("id, status").eq("created_by", user.id),
      supabase.from("time_entries").select("duration_minutes, clock_in").eq("created_by", user.id),
      supabase.from("client_intake").select("authorization_end").gte("authorization_end", now.toISOString().split("T")[0]).lte("authorization_end", thirtyDaysFromNow),
      supabase.from("time_entries").select("id").eq("created_by", user.id).is("clock_out", null).limit(1),
    ]);

    setUserName(profile?.full_name?.split(" ")[0] ?? "");
    setClockedIn((activeTimeEntry ?? []).length > 0);

    const sessionsThisWeek = (sessions ?? []).filter((s: any) => s.created_at >= weekAgo).length;
    const pendingSessions = (sessions ?? []).filter((s: any) => s.status === "pending").length;
    const activeGoals = (goals ?? []).filter((g: any) => g.status === "active").length;
    const hoursThisWeek = (timeEntries ?? [])
  .filter((e: any) => e.clock_in >= weekAgo)
  .reduce((sum: any, e: any) => sum + (e.duration_minutes ?? 0), 0) / 60;

    setStats({
      totalClients: (clients ?? []).length,
      sessionsThisWeek,
      activeGoals,
      pendingSessions,
      expiringAuths: (intakes ?? []).length,
      hoursThisWeek: Math.round(hoursThisWeek * 10) / 10,
    });

    // Build checklist
    const hasClients = (clients ?? []).length > 0;
    const hasSessions = (sessions ?? []).length > 0;
    const hasGoals = (goals ?? []).length > 0;
    const hasTimeEntry = (timeEntries ?? []).length > 0;
    const hasProfile = !!profile?.full_name;

    const items: ChecklistItem[] = [
      {
        key: "profile",
        label: "Complete your profile",
        description: "Add your credentials and role",
        href: "/dashboard/settings/profile",
        done: hasProfile,
      },
      {
        key: "client",
        label: "Add your first client",
        description: "Start tracking a learner",
        href: "/dashboard/clients",
        done: hasClients,
      },
      {
        key: "goal",
        label: "Create a treatment goal",
        description: "Set measurable targets for a client",
        href: "/dashboard/goals",
        done: hasGoals,
      },
      {
        key: "session",
        label: "Log your first session",
        description: "Record a therapy session note",
        href: "/dashboard/sessions",
        done: hasSessions,
      },
      {
        key: "time",
        label: "Clock in for a session",
        description: "Track your billable hours",
        href: "/dashboard/timetracking",
        done: hasTimeEntry,
      },
    ];

    setChecklist(items);
    setChecklistDone(items.every(i => i.done));
    setLoading(false);
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const quickActions = [
    {
      label: clockedIn ? "Clock Out" : "Clock In",
      icon: "⏱️",
      href: "/dashboard/timetracking",
      color: clockedIn ? "bg-green-600 text-white hover:bg-green-700" : "bg-blue-600 text-white hover:bg-blue-700",
    },
    { label: "+ New Session", icon: "📋", href: "/dashboard/sessions", color: "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50" },
    { label: "+ Add Client", icon: "👤", href: "/dashboard/clients", color: "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50" },
    { label: "+ Add Goal", icon: "🎯", href: "/dashboard/goals", color: "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50" },
    { label: "Progress Report", icon: "📄", href: "/dashboard/progress-reports", color: "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50" },
    { label: "View Analytics", icon: "📊", href: "/dashboard/analytics/graphs", color: "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50" },
  ];

  const statCards = stats ? [
    { label: "Total Clients", value: stats.totalClients, color: "text-blue-600", icon: "👥" },
    { label: "Sessions This Week", value: stats.sessionsThisWeek, color: "text-purple-600", icon: "📋" },
    { label: "Active Goals", value: stats.activeGoals, color: "text-green-600", icon: "🎯" },
    { label: "Pending Notes", value: stats.pendingSessions, color: stats.pendingSessions > 0 ? "text-yellow-600" : "text-gray-400", icon: "⚠️" },
    { label: "Expiring Auths", value: stats.expiringAuths, color: stats.expiringAuths > 0 ? "text-red-500" : "text-gray-400", icon: "📅" },
    { label: "Hours This Week", value: stats.hoursThisWeek, color: "text-indigo-600", icon: "⏱️" },
  ] : [];

  const completedCount = checklist.filter(i => i.done).length;

  return (
    <div className="space-y-6">
      <PageHeader title={loading ? "Dashboard" : `${greeting()}${userName ? `, ${userName}` : ""}!`}>
        <p className="text-gray-500 text-sm">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
      </PageHeader>

      {/* ALERTS */}
      {!loading && stats && (
        <div className="space-y-2">
          {stats.pendingSessions > 0 && (
            <Link href="/dashboard/sessions" className="block">
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800 hover:bg-yellow-100 transition-colors">
                ⚠️ You have <strong>{stats.pendingSessions}</strong> pending session note{stats.pendingSessions > 1 ? "s" : ""} that need completion.
              </div>
            </Link>
          )}
          {stats.expiringAuths > 0 && (
            <Link href="/dashboard/clients" className="block">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800 hover:bg-red-100 transition-colors">
                📅 <strong>{stats.expiringAuths}</strong> client authorization{stats.expiringAuths > 1 ? "s" : ""} expiring within 30 days.
              </div>
            </Link>
          )}
          {clockedIn && (
            <Link href="/dashboard/timetracking" className="block">
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800 hover:bg-green-100 transition-colors">
                ✅ You are currently clocked in. Tap to view your time entry.
              </div>
            </Link>
          )}
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {loading
          ? [...Array(6)].map((_, i) => <StatSkeleton key={i} />)
          : statCards.map(stat => (
            <div key={stat.label} className="border rounded-xl p-4 text-center bg-white">
              <div className="text-2xl mb-1">{stat.icon}</div>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1 leading-tight">{stat.label}</p>
            </div>
          ))
        }
      </div>

      {/* QUICK ACTIONS */}
      <Section title="Quick Actions">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {quickActions.map(action => (
            <Link key={action.label} href={action.href}
              className={`flex flex-col items-center gap-2 px-3 py-4 rounded-xl text-sm font-medium transition-colors text-center ${action.color}`}>
              <span className="text-2xl">{action.icon}</span>
              <span className="leading-tight">{action.label}</span>
            </Link>
          ))}
        </div>
      </Section>

      {/* ONBOARDING CHECKLIST */}
      {!loading && !checklistDone && (
        <Section title={`Getting Started (${completedCount}/${checklist.length})`}>
          <div className="mb-3">
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${(completedCount / checklist.length) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{checklist.length - completedCount} step{checklist.length - completedCount !== 1 ? "s" : ""} remaining</p>
          </div>
          <div className="space-y-2">
            {checklist.map(item => (
              <Link key={item.key} href={item.done ? "#" : item.href}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  item.done
                    ? "border-green-100 bg-green-50 cursor-default"
                    : "border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50"
                }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  item.done ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
                }`}>
                  {item.done ? "✓" : ""}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${item.done ? "text-green-700 line-through" : "text-gray-800"}`}>
                    {item.label}
                  </p>
                  <p className="text-xs text-gray-400">{item.description}</p>
                </div>
                {!item.done && <span className="text-gray-300 ml-auto shrink-0">→</span>}
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* ALL DONE STATE */}
      {!loading && checklistDone && completedCount === checklist.length && (
        <div className="text-center py-8 border border-dashed border-green-200 rounded-2xl bg-green-50">
          <div className="text-4xl mb-2">🎉</div>
          <p className="text-green-700 font-semibold">Setup complete!</p>
          <p className="text-green-600 text-sm mt-1">You&apos;re fully set up and ready to go.</p>
        </div>
      )}
    </div>
  );
}