/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Link from "next/link";
import { usePlanGate } from "@/lib/hooks/usePlanGate";
import UpgradePrompt from "@/components/ui/UpgradePrompt";

type TeamMember = {
  user_id: string;
  role: string | null;
  status: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
};

type ClinicianReport = {
  id: string;
  full_name: string;
  role: string;
  sessionCount: number;
  clientCount: number;
  pendingNotes: number;
};

type RoleCode = {
  id: string;
  code: string;
  role: string;
  used: boolean;
  used_by: string | null;
  expires_at: string | null;
  created_at: string;
};

type Company = {
  id: string;
  name: string;
  clinic_code: string | null;
  slug: string;
};

const ROLES = ["admin", "director", "supervisor", "clinician", "student_analyst", "rbt", "bt", "office", "accounting", "hr", "parent"];
const CODE_ROLES = ["admin", "supervisor", "clinical_director", "director"];

const ROLE_TIERS: Record<string, number> = {
  admin: 10, director: 9, supervisor: 8, clinician: 7,
  student_analyst: 6, rbt: 5, bt: 4, office: 3,
  accounting: 3, hr: 3, parent: 1,
};

function generateCode(role: string, clinicCode: string): string {
  const rolePrefix = role.toUpperCase().slice(0, 4);
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${clinicCode}-${rolePrefix}-${year}-${random}`;
}

export default function AdminPage() {
  const { canAddClinician, clinicianCount, limits, planName } = usePlanGate();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [roleCodes, setRoleCodes] = useState<RoleCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("clinician");
  const [inviteName, setInviteName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"users" | "codes" | "reports" | "logs" | "system">("users");
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalClients: 0, totalSessions: 0, totalIncidents: 0 });
  const [clinicianReports, setClinicianReports] = useState<ClinicianReport[]>([]);
  const [expiringAuths, setExpiringAuths] = useState<any[]>([]);
  const [reportLoading, setReportLoading] = useState(false);

  const [newCodeRole, setNewCodeRole] = useState("supervisor");
  const [newCodeExpiry, setNewCodeExpiry] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });
  const [generatingCode, setGeneratingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!companyUser?.company_id) { setLoading(false); return; }

    const { data: companyData } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyUser.company_id)
      .limit(1)
      .maybeSingle();
    setCompany(companyData ?? null);

    const { data: teamData } = await supabase
      .rpc("get_company_team", { company_uuid: companyUser.company_id });

    const members: TeamMember[] = (teamData ?? []).map((m: any) => ({
      user_id: m.user_id,
      role: m.role,
      status: m.status,
      full_name: m.full_name,
      email: null,
      created_at: m.created_at,
    }));

    setTeam(members);
    setStats(prev => ({ ...prev, totalUsers: members.length }));

    const { data: codesData } = await supabase
      .from("role_codes")
      .select("*")
      .eq("company_id", companyUser.company_id)
      .order("created_at", { ascending: false });
    setRoleCodes(codesData ?? []);

    const [{ count: clientCount }, { count: sessionCount }, { count: incidentCount }] = await Promise.all([
      supabase.from("clients").select("*", { count: "exact", head: true }),
      supabase.from("sessions").select("*", { count: "exact", head: true }),
      supabase.from("incident_reports").select("*", { count: "exact", head: true }),
    ]);

    setStats(prev => ({
      ...prev,
      totalClients: clientCount ?? 0,
      totalSessions: sessionCount ?? 0,
      totalIncidents: incidentCount ?? 0,
    }));

    const { data: logData } = await supabase
      .from("audit_logs").select("*")
      .order("created_at", { ascending: false }).limit(50);
    setLogs(logData ?? []);
    setLoading(false);
  }

  async function generateRoleCode() {
    if (!company) return;
    setGeneratingCode(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const clinicCode = company.clinic_code ?? company.slug.toUpperCase().slice(0, 6);
    const code = generateCode(newCodeRole, clinicCode);
    const { data } = await supabase.from("role_codes").insert([{
      code, role: newCodeRole, used: false,
      expires_at: newCodeExpiry, company_id: company.id, created_by: user.id,
    }]).select().single();
    if (data) setRoleCodes(prev => [data, ...prev]);
    setGeneratingCode(false);
  }

  async function deleteCode(id: string) {
    await supabase.from("role_codes").delete().eq("id", id);
    setRoleCodes(prev => prev.filter(c => c.id !== id));
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  async function loadReports() {
    setReportLoading(true);
    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);

    const [{ data: sessions }, { data: clients }, { data: auths }] = await Promise.all([
      supabase.from("sessions").select("id, created_by, client_id, status"),
      supabase.from("clients").select("id, created_by"),
      supabase.from("insurance_authorizations")
        .select("id, client_id, insurance_provider, authorization_end")
        .lte("authorization_end", thirtyDays.toISOString().split("T")[0])
        .gte("authorization_end", new Date().toISOString().split("T")[0]),
    ]);

    setExpiringAuths(auths ?? []);

    const clinicians = team.filter(m =>
      ["clinician", "rbt", "bt", "supervisor", "student_analyst"].includes(m.role ?? "")
    );

    const reports: ClinicianReport[] = clinicians.map(c => {
      const userSessions = (sessions ?? []).filter((s: any) => s.created_by === c.user_id);
      const userClients = (clients ?? []).filter((cl: any) => cl.created_by === c.user_id);
      const pendingNotes = userSessions.filter((s: any) => s.status === "pending").length;
      return {
        id: c.user_id,
        full_name: c.full_name ?? "Unknown",
        role: c.role ?? "",
        sessionCount: userSessions.length,
        clientCount: userClients.length,
        pendingNotes,
      };
    }).sort((a, b) => b.sessionCount - a.sessionCount);

    setClinicianReports(reports);
    setReportLoading(false);
  }

  useEffect(() => {
    if (activeTab === "reports" && clinicianReports.length === 0) {
      void loadReports();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function updateRole(userId: string, role: string) {
    await supabase.from("profiles").update({ role } as any).eq("id", userId);
    await supabase.from("company_users").update({ role }).eq("user_id", userId).eq("company_id", company?.id ?? "");
    setTeam(prev => prev.map(m => m.user_id === userId ? { ...m, role } : m));
  }

  async function updateStatus(userId: string, status: string) {
      if (userId === "a8f7b957-0aed-4e72-94e5-f4c87d27eade") {
        alert("This account is locked and cannot have its status changed.");
        return;
      }
    await supabase.from("profiles").update({ status } as any).eq("id", userId);
    await supabase.from("company_users").update({ status }).eq("user_id", userId).eq("company_id", company?.id ?? "");
    if (status === "active") {
      setTeam(prev => prev.map(m => m.user_id === userId ? { ...m, status } : m));
    } else {
      setTeam(prev => prev.filter(m => m.user_id !== userId));
    }
  }

  async function handleInvite() {
    if (!inviteEmail || !company) return;

    // Check plan gate before inviting
    const check = canAddClinician();
    if (!check.allowed) return;

    setInviting(true);
    setInviteError(null);

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: inviteEmail.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
        shouldCreateUser: true,
        data: {
          full_name: inviteName.trim(),
          invited_to_company: company.id,
          invited_role: inviteRole,
        },
      },
    });

    if (otpError) {
      setInviteError(otpError.message);
    } else {
      setInviteSuccess(true);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("clinician");
      setTimeout(() => setInviteSuccess(false), 4000);
    }
    setInviting(false);
  }

  function daysUntil(dateStr: string) {
    return Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  }

  const filtered = team.filter(m => {
    const matchesSearch = !search ||
      m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = !filterRole || m.role === filterRole;
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

  const clinicianGate = canAddClinician();

  return (
    <div className="space-y-6">
      <PageHeader title="Admin Panel">
        <div className="flex gap-2">
          <Link href="/dashboard/admin/logs">
            <Button variant="outline">Audit Logs</Button>
          </Link>
          <Link href="/dashboard/analytics">
            <Button variant="outline">Analytics</Button>
          </Link>
        </div>
      </PageHeader>

      {company && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white">
          <div className="flex justify-between items-start flex-wrap gap-3">
            <div>
              <p className="text-xs text-blue-200 uppercase tracking-wide mb-1">Your Clinic</p>
              <p className="text-xl font-bold">{company.name}</p>
              <p className="text-sm text-blue-200 mt-0.5">Share this code with staff to join your clinic</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-blue-200 uppercase tracking-wide mb-1">Clinic ID Code</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-black font-mono tracking-widest">
                  {company.clinic_code ?? company.slug.toUpperCase().slice(0, 8)}
                </p>
                <button
                  onClick={() => navigator.clipboard.writeText(company.clinic_code ?? company.slug.toUpperCase().slice(0, 8))}
                  className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg transition-colors">
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PLAN USAGE BANNER */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: `Team Members (${clinicianCount}/${limits.clinicians === 9999 ? "∞" : limits.clinicians})`,
            value: stats.totalUsers,
            color: clinicianGate.allowed ? "text-blue-600" : "text-orange-500",
          },
          { label: "Total Clients", value: stats.totalClients, color: "text-green-600" },
          { label: "Total Sessions", value: stats.totalSessions, color: "text-purple-600" },
          { label: "Incident Reports", value: stats.totalIncidents, color: "text-red-500" },
        ].map(stat => (
          <div key={stat.label} className="border rounded-xl p-4 text-center bg-white">
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* PLAN INFO */}
      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm">
        <span className="text-gray-600">Current plan: <strong>{planName}</strong></span>
        <Link href="/dashboard/settings/billing"
          className="text-blue-600 hover:underline text-xs font-medium">
          Manage Plan →
        </Link>
      </div>

      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {[
          { key: "users", label: "Team" },
          { key: "codes", label: "Role Codes" },
          { key: "reports", label: "Reports" },
          { key: "logs", label: "Audit Logs" },
          { key: "system", label: "System" },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "users" && (
        <>
          <Section title="Invite New Team Member">
            {inviteSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 mb-3">
                ✓ Magic link sent. They will receive an email to join your clinic.
              </div>
            )}
            {inviteError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-3">
                {inviteError}
              </div>
            )}

            {/* PLAN GATE — show upgrade prompt if at clinician limit */}
            {!clinicianGate.allowed ? (
              <UpgradePrompt
                reason={clinicianGate.reason!}
                upgradeTo={clinicianGate.upgradeTo}
                feature="Adding more team members"
              />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input type="text" value={inviteName} onChange={e => setInviteName(e.target.value)}
                    placeholder="Full name (optional)"
                    className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                    placeholder="Email address *"
                    className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  <div className="flex gap-2">
                    <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                      className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <Button onClick={handleInvite} loading={inviting} disabled={!inviteEmail}>
                      Send Invite
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Staff will receive a magic link. They still need to enter your clinic code <strong>{company?.clinic_code}</strong> during onboarding.
                </p>
              </>
            )}
          </Section>

          <div className="flex flex-wrap gap-3 items-center">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search team..."
              className="border rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">All Roles</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <p className="text-sm text-gray-400">{filtered.length} members</p>
          </div>

          {loading && <p className="text-gray-400 text-sm">Loading team...</p>}

          {!loading && team.length === 0 && (
            <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
              <p className="text-4xl mb-3">👥</p>
              <p className="text-gray-600 font-medium">No team members yet</p>
              <p className="text-gray-400 text-sm mt-1">Invite staff or share your clinic code so they can join.</p>
            </div>
          )}

          <div className="space-y-2">
            {filtered.map(member => (
              <div key={member.user_id} className="border border-gray-100 rounded-xl p-4 bg-white">
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <div>
                    <p className="font-semibold text-gray-800">{member.full_name ?? "Unknown"}</p>
                    <p className="text-xs text-gray-400">
                      {member.email && `${member.email} · `}
                      Joined {new Date(member.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${roleBadge(member.role)}`}>
                        {member.role ?? "no role"} (tier {ROLE_TIERS[member.role ?? ""] ?? 0})
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        {member.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <select value={member.role ?? ""} onChange={e => updateRole(member.user_id, e.target.value)}
                      className="text-xs border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300">
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <select value={member.status} onChange={e => updateStatus(member.user_id, e.target.value)}
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

      {activeTab === "codes" && (
        <div className="space-y-6">
          <Section title="Generate Role Code">
            <p className="text-sm text-gray-500 mb-4">
              Generate a one-time code for staff who need elevated roles. Send the code — they enter it during onboarding.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Role</label>
                <select value={newCodeRole} onChange={e => setNewCodeRole(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  {CODE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Expires</label>
                <input type="date" value={newCodeExpiry} onChange={e => setNewCodeExpiry(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div className="flex items-end">
                <Button onClick={generateRoleCode} loading={generatingCode} className="w-full">
                  Generate Code
                </Button>
              </div>
            </div>
            {company && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                Codes are prefixed with your clinic code: <strong>{company.clinic_code ?? company.slug.toUpperCase().slice(0, 6)}</strong>
              </div>
            )}
          </Section>

          <Section title="Role Codes">
            {roleCodes.length === 0 ? (
              <p className="text-gray-400 text-sm">No codes generated yet.</p>
            ) : (
              <div className="space-y-2">
                {roleCodes.map(code => {
                  const expired = code.expires_at ? new Date(code.expires_at) < new Date() : false;
                  return (
                    <div key={code.id} className={`border rounded-xl p-4 bg-white flex justify-between items-center flex-wrap gap-3 ${code.used ? "opacity-50" : expired ? "border-red-200" : "border-gray-100"}`}>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-mono font-bold text-gray-800 text-sm">{code.code}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge(code.role)}`}>{code.role}</span>
                          {code.used && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Used</span>}
                          {!code.used && expired && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Expired</span>}
                          {!code.used && !expired && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Active</span>}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Created {new Date(code.created_at).toLocaleDateString()}
                          {code.expires_at && ` · Expires ${code.expires_at}`}
                          {code.used && " · Used"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {!code.used && !expired && (
                          <button onClick={() => copyCode(code.code)}
                            className="text-xs px-3 py-1.5 border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                            {copiedCode === code.code ? "Copied!" : "Copy"}
                          </button>
                        )}
                        <button onClick={() => deleteCode(code.id)}
                          className="text-xs px-3 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </div>
      )}

      {activeTab === "reports" && (
        <div className="space-y-6">
          {reportLoading && <p className="text-gray-400 text-sm">Loading reports...</p>}
          {expiringAuths.length > 0 && (
            <Section title="Expiring Authorizations (Next 30 Days)">
              <div className="space-y-2">
                {expiringAuths.map(auth => (
                  <div key={auth.id} className={`flex justify-between items-center border rounded-xl p-3 ${daysUntil(auth.authorization_end) <= 7 ? "border-red-200 bg-red-50" : "border-orange-200 bg-orange-50"}`}>
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{auth.insurance_provider}</p>
                      <p className="text-xs text-gray-500">Expires {auth.authorization_end}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${daysUntil(auth.authorization_end) <= 7 ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                      {daysUntil(auth.authorization_end)} days
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}
          <Section title="Team Activity Report">
            {clinicianReports.length === 0 ? (
              <p className="text-gray-400 text-sm">No clinician data yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Clinician</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Role</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">Clients</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">Sessions</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">Pending Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clinicianReports.map(report => (
                      <tr key={report.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 px-3 font-medium text-gray-800">{report.full_name}</td>
                        <td className="py-3 px-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${roleBadge(report.role)}`}>{report.role}</span>
                        </td>
                        <td className="py-3 px-3 text-center text-blue-600 font-semibold">{report.clientCount}</td>
                        <td className="py-3 px-3 text-center text-purple-600 font-semibold">{report.sessionCount}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${report.pendingNotes > 0 ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                            {report.pendingNotes}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
          <Section title="Clinic Summary">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Active Clinicians", value: clinicianReports.length, color: "text-blue-600" },
                { label: "Total Sessions", value: clinicianReports.reduce((a, b) => a + b.sessionCount, 0), color: "text-purple-600" },
                { label: "Total Clients", value: stats.totalClients, color: "text-green-600" },
                { label: "Pending Notes", value: clinicianReports.reduce((a, b) => a + b.pendingNotes, 0), color: "text-yellow-600" },
              ].map(stat => (
                <div key={stat.label} className="border rounded-xl p-4 text-center bg-white">
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {activeTab === "logs" && (
        <Section title="Recent Audit Logs">
          {logs.length === 0 ? (
            <p className="text-gray-400 text-sm">No audit logs yet.</p>
          ) : (
            <div className="space-y-2">
              {logs.map(log => (
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

      {activeTab === "system" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: "Analytics Dashboard", href: "/dashboard/analytics", icon: "📊", desc: "View all platform metrics" },
            { label: "Revenue Cycle", href: "/dashboard/billing/rcm", icon: "💰", desc: "Billing and revenue overview" },
            { label: "Incident Reports", href: "/dashboard/incidents", icon: "⚠️", desc: "View all incident reports" },
            { label: "Waitlist", href: "/dashboard/waitlist", icon: "📋", desc: "Manage client waitlist" },
            { label: "Staff Performance", href: "/dashboard/staff-performance", icon: "👥", desc: "Team performance metrics" },
            { label: "Credentials", href: "/dashboard/credentials", icon: "🏅", desc: "Staff credential tracking" },
            { label: "Insurance Providers", href: "/dashboard/insurance-providers", icon: "🏥", desc: "Insurance provider guide" },
            { label: "API Docs", href: "/dashboard/docs", icon: "📖", desc: "Developer documentation" },
          ].map(item => (
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
