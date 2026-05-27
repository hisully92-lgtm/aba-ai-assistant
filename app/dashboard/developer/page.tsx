"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRole, ROLE_TIERS } from "@/lib/hooks/useRole";

type CompanyOverview = {
  id: string;
  name: string;
  owner_email: string;
  plan: string;
  user_count: number;
  client_count: number;
  session_count: number;
  created_at: string;
  status: string;
};

type SystemStats = {
  totalCompanies: number;
  totalUsers: number;
  totalClients: number;
  totalSessions: number;
  totalIncidents: number;
  totalAuthorizations: number;
};

export default function DeveloperPage() {
  const { isDeveloper, loading: roleLoading } = useRole();
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyOverview[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "companies" | "users" | "logs" | "system">("overview");
  const [logs, setLogs] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [impersonating, setImpersonating] = useState<string | null>(null);

  useEffect(() => {
    if (!roleLoading && !isDeveloper) {
      router.replace("/dashboard");
    }
  }, [isDeveloper, roleLoading]);

  useEffect(() => {
    if (isDeveloper) init();
  }, [isDeveloper]);

  async function init() {
    const [
      { count: companyCount },
      { count: userCount },
      { count: clientCount },
      { count: sessionCount },
      { count: incidentCount },
      { count: authCount },
      { data: userData },
      { data: logData },
    ] = await Promise.all([
      supabase.from("companies").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("clients").select("*", { count: "exact", head: true }),
      supabase.from("sessions").select("*", { count: "exact", head: true }),
      supabase.from("incident_reports").select("*", { count: "exact", head: true }),
      supabase.from("insurance_authorizations").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("id, full_name, email, role, is_developer, created_at, status").order("created_at", { ascending: false }),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100),
    ]);

    setStats({
      totalCompanies: companyCount ?? 0,
      totalUsers: userCount ?? 0,
      totalClients: clientCount ?? 0,
      totalSessions: sessionCount ?? 0,
      totalIncidents: incidentCount ?? 0,
      totalAuthorizations: authCount ?? 0,
    });

    setAllUsers(userData ?? []);
    setLogs(logData ?? []);

    // Build company overviews
    const { data: companiesData } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
    if (companiesData) {
      const overviews: CompanyOverview[] = await Promise.all(
        companiesData.map(async (company: any) => {
          const [{ count: users }, { count: clients }, { count: sessions }] = await Promise.all([
            supabase.from("company_users").select("*", { count: "exact", head: true }).eq("company_id", company.id),
            supabase.from("clients").select("*", { count: "exact", head: true }).eq("company_id", company.id),
            supabase.from("sessions").select("*", { count: "exact", head: true }).eq("company_id", company.id),
          ]);
          return {
            id: company.id,
            name: company.name ?? "Unnamed",
            owner_email: company.owner_email ?? "",
            plan: company.plan ?? "starter",
            user_count: users ?? 0,
            client_count: clients ?? 0,
            session_count: sessions ?? 0,
            created_at: company.created_at,
            status: company.status ?? "active",
          };
        })
      );
      setCompanies(overviews);
    }

    setLoading(false);
  }

  async function updateUserRole(userId: string, role: string) {
    await supabase.from("profiles").update({ role } as any).eq("id", userId);
    setAllUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role } : u));
  }

  async function updateUserStatus(userId: string, status: string) {
    await supabase.from("profiles").update({ status } as any).eq("id", userId);
    setAllUsers((prev) => prev.map((u) => u.id === userId ? { ...u, status } : u));
  }

  async function toggleDeveloper(userId: string, current: boolean) {
    await supabase.from("profiles").update({ is_developer: !current } as any).eq("id", userId);
    setAllUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_developer: !current } : u));
  }

  const filteredUsers = allUsers.filter((u) =>
    !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const ROLES = ["developer", "admin", "director", "supervisor", "clinician", "student_analyst", "rbt", "bt", "office", "accounting", "hr", "parent"];

  function roleBadge(role: string, isDev: boolean) {
    if (isDev) return "bg-purple-100 text-purple-700";
    if (role === "admin") return "bg-red-100 text-red-700";
    if (role === "director") return "bg-orange-100 text-orange-700";
    if (role === "supervisor") return "bg-blue-100 text-blue-700";
    if (role === "clinician") return "bg-green-100 text-green-700";
    if (role === "student_analyst") return "bg-yellow-100 text-yellow-700";
    if (role === "rbt" || role === "bt") return "bg-teal-100 text-teal-700";
    if (["office", "accounting", "hr"].includes(role)) return "bg-gray-100 text-gray-600";
    return "bg-gray-100 text-gray-500";
  }

  if (roleLoading || loading) return <div className="p-8 text-gray-400">Loading developer dashboard...</div>;
  if (!isDeveloper) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="🛠 Developer Dashboard">
        <div className="flex gap-2">
          <span className="text-xs px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full font-medium">
            Developer Access
          </span>
          <Link href="/dashboard/admin/integrations">
            <Button variant="outline">Integrations</Button>
          </Link>
        </div>
      </PageHeader>

      {/* SYSTEM STATS */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { label: "Companies", value: stats.totalCompanies, color: "text-blue-600" },
            { label: "Users", value: stats.totalUsers, color: "text-green-600" },
            { label: "Clients", value: stats.totalClients, color: "text-purple-600" },
            { label: "Sessions", value: stats.totalSessions, color: "text-orange-500" },
            { label: "Incidents", value: stats.totalIncidents, color: "text-red-500" },
            { label: "Auths", value: stats.totalAuthorizations, color: "text-teal-600" },
          ].map((stat) => (
            <div key={stat.label} className="border rounded-xl p-3 text-center bg-white">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* TABS */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {[
          { key: "overview", label: "Overview" },
          { key: "companies", label: `Companies (${companies.length})` },
          { key: "users", label: `All Users (${allUsers.length})` },
          { key: "logs", label: "Audit Logs" },
          { key: "system", label: "System" },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.key ? "border-purple-500 text-purple-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Section title="Quick Actions">
            <div className="space-y-2">
              {[
                { label: "View All Integrations", href: "/dashboard/admin/integrations", icon: "🔌" },
                { label: "Analytics Dashboard", href: "/dashboard/analytics", icon: "📊" },
                { label: "Revenue Cycle", href: "/dashboard/billing/rcm", icon: "💰" },
                { label: "All Incident Reports", href: "/dashboard/incidents", icon: "⚠️" },
                { label: "Authorization Tracker", href: "/dashboard/authorizations", icon: "📋" },
                { label: "Staff Performance", href: "/dashboard/staff-performance", icon: "👥" },
                { label: "Visual Analytics", href: "/dashboard/analytics/graphs", icon: "📈" },
              ].map((item) => (
                <Link key={item.label} href={item.href}>
                  <div className="flex items-center gap-3 border border-gray-100 rounded-lg p-3 bg-white hover:shadow-sm transition-shadow cursor-pointer">
                    <span className="text-xl">{item.icon}</span>
                    <span className="text-sm font-medium text-gray-700">{item.label}</span>
                    <span className="ml-auto text-gray-400 text-xs">→</span>
                  </div>
                </Link>
              ))}
            </div>
          </Section>

          <Section title="Role Access Tiers">
            <div className="space-y-2">
              {[
                { role: "developer", tier: 99, access: "Full system access — all companies, all data", color: "bg-purple-100 text-purple-700" },
                { role: "admin", tier: 10, access: "Full company access — all users and data", color: "bg-red-100 text-red-700" },
                { role: "director", tier: 9, access: "Clinical + billing + staff management", color: "bg-orange-100 text-orange-700" },
                { role: "supervisor", tier: 8, access: "Clinical + staff oversight + reports", color: "bg-blue-100 text-blue-700" },
                { role: "clinician", tier: 7, access: "Clinical tools + clients + reports", color: "bg-green-100 text-green-700" },
                { role: "student_analyst", tier: 6, access: "Student hub + limited clinical tools", color: "bg-yellow-100 text-yellow-700" },
                { role: "rbt / bt", tier: 4, access: "Session notes + clients + basic tools", color: "bg-teal-100 text-teal-700" },
                { role: "office", tier: 3, access: "Billing + scheduling + client intake", color: "bg-gray-100 text-gray-600" },
                { role: "accounting / hr", tier: 3, access: "Billing/payroll or staff management only", color: "bg-gray-100 text-gray-600" },
                { role: "parent", tier: 1, access: "Parent portal only", color: "bg-gray-50 text-gray-500" },
              ].map((item) => (
                <div key={item.role} className="flex items-center gap-3 border border-gray-100 rounded-lg p-2.5 bg-white">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${item.color}`}>
                    {item.role}
                  </span>
                  <span className="text-xs text-gray-500 flex-1">{item.access}</span>
                  <span className="text-xs text-gray-400">T{item.tier}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* COMPANIES TAB */}
      {activeTab === "companies" && (
        <div className="space-y-3">
          {companies.length === 0 && (
            <Section title="Companies">
              <p className="text-gray-400 text-sm">No companies yet.</p>
            </Section>
          )}
          {companies.map((company) => (
            <div key={company.id} className="border border-gray-100 rounded-xl p-4 bg-white">
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <p className="font-bold text-gray-800">{company.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {company.owner_email} · Joined {new Date(company.created_at).toLocaleDateString()}
                  </p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{company.plan}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${company.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {company.status}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="border rounded-lg p-2">
                    <p className="text-lg font-bold text-blue-600">{company.user_count}</p>
                    <p className="text-xs text-gray-400">Users</p>
                  </div>
                  <div className="border rounded-lg p-2">
                    <p className="text-lg font-bold text-green-600">{company.client_count}</p>
                    <p className="text-xs text-gray-400">Clients</p>
                  </div>
                  <div className="border rounded-lg p-2">
                    <p className="text-lg font-bold text-purple-600">{company.session_count}</p>
                    <p className="text-xs text-gray-400">Sessions</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* USERS TAB */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex gap-3 items-center">
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="border rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-purple-300" />
            <p className="text-sm text-gray-400">{filteredUsers.length} users</p>
          </div>
          <div className="space-y-2">
            {filteredUsers.map((user) => (
              <div key={user.id} className={`border rounded-xl p-4 bg-white ${user.is_developer ? "border-purple-200" : "border-gray-100"}`}>
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800">{user.full_name ?? "Unknown"}</p>
                      {user.is_developer && <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">🛠 Developer</span>}
                    </div>
                    <p className="text-xs text-gray-400">{user.email} · Joined {new Date(user.created_at).toLocaleDateString()}</p>
                    <div className="flex gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${roleBadge(user.role ?? "", user.is_developer)}`}>
                        {user.role ?? "no role"} (T{ROLE_TIERS[user.role ?? ""] ?? 0})
                      </span>
                      {user.status === "inactive" && (
                        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">Inactive</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <select value={user.role ?? ""} onChange={(e) => updateUserRole(user.id, e.target.value)}
                      className="text-xs border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-300">
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <select value={user.status ?? "active"} onChange={(e) => updateUserStatus(user.id, e.target.value)}
                      className="text-xs border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-300">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">Dev</span>
                      <button onClick={() => toggleDeveloper(user.id, user.is_developer)}
                        className={`w-10 h-5 rounded-full transition-all relative ${user.is_developer ? "bg-purple-500" : "bg-gray-300"}`}>
                        <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${user.is_developer ? "left-6" : "left-1"}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LOGS TAB */}
      {activeTab === "logs" && (
        <Section title="System Audit Logs">
          {logs.length === 0 ? (
            <p className="text-gray-400 text-sm">No audit logs yet.</p>
          ) : (
            <div className="space-y-1">
              {logs.map((log) => (
                <div key={log.id} className="border border-gray-100 rounded-lg p-3 bg-white text-xs">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="font-medium text-gray-800">{log.action}</span>
                      {log.resource && <span className="text-gray-500 ml-2">→ {log.resource}</span>}
                      <p className="text-gray-400 mt-0.5">User: {log.user_id?.slice(0, 8)}...</p>
                    </div>
                    <p className="text-gray-400 shrink-0">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* SYSTEM TAB */}
      {activeTab === "system" && (
        <div className="space-y-4">
          <Section title="Environment Status">
            <div className="space-y-2">
              {[
                { key: "NEXT_PUBLIC_SUPABASE_URL", label: "Supabase URL", status: "configured" },
                { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Supabase Service Role", status: "configured" },
                { key: "ANTHROPIC_API_KEY", label: "Anthropic (Claude AI)", status: "configured" },
                { key: "RESEND_API_KEY", label: "Resend Email", status: "configured" },
                { key: "NEXT_PUBLIC_VAPID_PUBLIC_KEY", label: "VAPID Push Notifications", status: "configured" },
                { key: "SQUARE_ACCESS_TOKEN", label: "Square Payments", status: "sandbox" },
                { key: "TWILIO_ACCOUNT_SID", label: "Twilio SMS", status: "pending" },
                { key: "DAILY_API_KEY", label: "Daily.co Video", status: "pending" },
                { key: "AVAILITY_USERNAME", label: "Availity EDI", status: "pending" },
                { key: "CHANGE_HEALTHCARE_CLIENT_ID", label: "Change Healthcare EDI", status: "pending" },
              ].map((env) => (
                <div key={env.key} className="flex justify-between items-center border border-gray-100 rounded-lg p-3 bg-white text-sm">
                  <div>
                    <p className="font-medium text-gray-800">{env.label}</p>
                    <p className="text-xs font-mono text-gray-400">{env.key}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${env.status === "configured" ? "bg-green-100 text-green-700" : env.status === "sandbox" ? "bg-yellow-100 text-yellow-700" : "bg-orange-100 text-orange-700"}`}>
                    {env.status === "configured" ? "✓ Configured" : env.status === "sandbox" ? "Sandbox" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Mobile Scroll Fix">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-bold text-blue-800">📱 Mobile scroll issue detected</p>
              <p className="text-sm text-blue-700">The fix is already applied in layout.tsx with <code className="bg-blue-100 px-1 rounded">overflow-x-hidden</code>. If scrolling is still broken on mobile, check these:</p>
              <ul className="text-xs text-blue-600 space-y-1 list-disc list-inside">
                <li>Make sure no parent div has <code className="bg-blue-100 px-1 rounded">overflow: hidden</code> without a height</li>
                <li>The sidebar overlay div needs <code className="bg-blue-100 px-1 rounded">pointer-events-none</code> when closed</li>
                <li>Add <code className="bg-blue-100 px-1 rounded">touch-action: pan-y</code> to the main content area</li>
              </ul>
            </div>
          </Section>

          <Section title="Vercel Deployment">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border border-gray-100 rounded-lg p-3">
                <span className="text-gray-600">Live URL</span>
                <a href="https://aba-ai-assistant-wtwd.vercel.app" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                  aba-ai-assistant-wtwd.vercel.app →
                </a>
              </div>
              <div className="flex justify-between border border-gray-100 rounded-lg p-3">
                <span className="text-gray-600">Framework</span>
                <span className="text-gray-800">Next.js 16 (App Router)</span>
              </div>
              <div className="flex justify-between border border-gray-100 rounded-lg p-3">
                <span className="text-gray-600">Database</span>
                <span className="text-gray-800">Supabase (PostgreSQL)</span>
              </div>
              <div className="flex justify-between border border-gray-100 rounded-lg p-3">
                <span className="text-gray-600">AI</span>
                <span className="text-gray-800">Anthropic Claude Sonnet + Haiku</span>
              </div>
              <div className="flex justify-between border border-gray-100 rounded-lg p-3">
                <span className="text-gray-600">Payments</span>
                <span className="text-gray-800">Square (Sandbox)</span>
              </div>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}