"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Link from "next/link";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  created_at: string;
  status: string | null;
};

const ROLES = ["admin", "director", "supervisor", "clinician", "student_analyst", "rbt", "bt", "office", "accounting", "hr", "parent"];

const ROLE_TIERS: Record<string, number> = {
  admin: 10,
  director: 9,
  supervisor: 8,
  clinician: 7,
  student_analyst: 6,
  rbt: 5,
  bt: 4,
  office: 3,
  accounting: 3,
  hr: 3,
  parent: 1,
};

export default function AdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("rbt");
  const [inviteName, setInviteName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "logs" | "system">("users");
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalClients: 0, totalSessions: 0, totalIncidents: 0 });

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: profileData } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    setProfiles(profileData ?? []);

    const [{ count: clientCount }, { count: sessionCount }, { count: incidentCount }] = await Promise.all([
      supabase.from("clients").select("*", { count: "exact", head: true }),
      supabase.from("sessions").select("*", { count: "exact", head: true }),
      supabase.from("incident_reports").select("*", { count: "exact", head: true }),
    ]);

    setStats({
      totalUsers: profileData?.length ?? 0,
      totalClients: clientCount ?? 0,
      totalSessions: sessionCount ?? 0,
      totalIncidents: incidentCount ?? 0,
    });

    const { data: logData } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50);
    setLogs(logData ?? []);

    setLoading(false);
  }

  async function updateRole(userId: string, role: string) {
    await supabase.from("profiles").update({ role } as any).eq("id", userId);
    setProfiles((prev) => prev.map((p) => p.id === userId ? { ...p, role } : p));
  }

  async function updateStatus(userId: string, status: string) {
    await supabase.from("profiles").update({ status } as any).eq("id", userId);
    setProfiles((prev) => prev.map((p) => p.id === userId ? { ...p, status } : p));
  }

  async function handleInvite() {
    if (!inviteEmail || !inviteName) return;
    setInviting(true);

    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, full_name: inviteName, role: inviteRole }),
    });

    if (res.ok) {
      setInviteSuccess(true);
      setInviteEmail(""); setInviteName(""); setInviteRole("rbt");
      setTimeout(() => setInviteSuccess(false), 3000);
      await init();
    }
    setInviting(false);
  }

  const filtered = profiles.filter((p) => {
    const matchesSearch = !search || p.full_name?.toLowerCase().includes(search.toLowerCase()) || p.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = !filterRole || p.role === filterRole;
    return matchesSearch && matchesRole;
  });

  function roleBadge(role: string | null) {
    if (!role) return "bg-gray-100 text-gray-500";
    if (role === "admin" || role === "director") return "bg-purple-100 text-purple-700";
    if (role === "supervisor") return "bg-blue-100 text-blue-700";
    if (role === "clinician" || role === "rbt" || role === "bt") return "bg-green-100 text-green-700";
    if (role === "student_analyst") return "bg-yellow-100 text-yellow-700";
    return "bg-gray-100 text-gray-600";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Admin Panel">
        <div className="flex gap-2">
          <Link href="/dashboard/admin/logs">
            <Button variant="outline">📋 Audit Logs</Button>
          </Link>
          <Link href="/dashboard/analytics">
            <Button variant="outline">📊 Analytics</Button>
          </Link>
        </div>
      </PageHeader>

      {/* SYSTEM STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: stats.totalUsers, color: "text-blue-600" },
          { label: "Total Clients", value: stats.totalClients, color: "text-green-600" },
          { label: "Total Sessions", value: stats.totalSessions, color: "text-purple-600" },
          { label: "Incident Reports", value: stats.totalIncidents, color: "text-red-500" },
        ].map((stat) => (
          <div key={stat.label} className="border rounded-xl p-4 text-center bg-white">
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { key: "users", label: "User Management" },
          { key: "logs", label: "Audit Logs" },
          { key: "system", label: "System" },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* USERS TAB */}
      {activeTab === "users" && (
        <>
          {/* INVITE */}
          <Section title="Invite New User">
            {inviteSuccess && <p className="text-green-600 text-sm mb-3">✓ Invitation sent!</p>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                placeholder="Full name"
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                placeholder="Email address"
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <div className="flex gap-2">
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <Button onClick={handleInvite} loading={inviting} disabled={!inviteEmail || !inviteName}>
                  Invite
                </Button>
              </div>
            </div>
          </Section>

          {/* SEARCH + FILTER */}
          <div className="flex flex-wrap gap-3 items-center">
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="border rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">All Roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <p className="text-sm text-gray-400">{filtered.length} users</p>
          </div>

          {/* USER LIST */}
          {loading && <p className="text-gray-400 text-sm">Loading users...</p>}
          <div className="space-y-2">
            {filtered.map((user) => (
              <div key={user.id} className="border border-gray-100 rounded-xl p-4 bg-white">
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <div>
                    <p className="font-semibold text-gray-800">{user.full_name ?? "Unknown"}</p>
                    <p className="text-xs text-gray-400">{user.email} · Joined {new Date(user.created_at).toLocaleDateString()}</p>
                    <div className="flex gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${roleBadge(user.role)}`}>
                        {user.role ?? "no role"} (tier {ROLE_TIERS[user.role ?? ""] ?? 0})
                      </span>
                      {user.status === "inactive" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Inactive</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <select value={user.role ?? ""} onChange={(e) => updateRole(user.id, e.target.value)}
                      className="text-xs border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300">
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <select value={user.status ?? "active"} onChange={(e) => updateStatus(user.id, e.target.value)}
                      className="text-xs border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* LOGS TAB */}
      {activeTab === "logs" && (
        <Section title="Recent Audit Logs">
          {logs.length === 0 ? (
            <p className="text-gray-400 text-sm">No audit logs yet.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="border border-gray-100 rounded-lg p-3 bg-white text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-medium text-gray-800">{log.action}</span>
                      {log.resource && <span className="text-gray-500 ml-2">→ {log.resource}</span>}
                    </div>
                    <p className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">User: {log.user_id?.slice(0, 8)}...</p>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* SYSTEM TAB */}
      {activeTab === "system" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: "Analytics Dashboard", href: "/dashboard/analytics", icon: "📊", desc: "View all platform metrics" },
            { label: "Revenue Cycle", href: "/dashboard/billing/rcm", icon: "💰", desc: "Billing and revenue overview" },
            { label: "Incident Reports", href: "/dashboard/incidents", icon: "⚠️", desc: "View all incident reports" },
            { label: "Waitlist", href: "/dashboard/waitlist", icon: "📝", desc: "Manage client waitlist" },
            { label: "Staff Performance", href: "/dashboard/staff-performance", icon: "👥", desc: "Team performance metrics" },
            { label: "Credentials", href: "/dashboard/credentials", icon: "🏅", desc: "Staff credential tracking" },
            { label: "Insurance Providers", href: "/dashboard/insurance-providers", icon: "🏥", desc: "Insurance provider guide" },
            { label: "API Docs", href: "/dashboard/docs", icon: "📖", desc: "Developer documentation" },
          ].map((item) => (
            <Link key={item.label} href={item.href}>
              <div className="border border-gray-100 rounded-xl p-4 bg-white hover:shadow-md transition-shadow cursor-pointer">
                <p className="text-2xl mb-2">{item.icon}</p>
                <p className="font-semibold text-gray-800">{item.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}