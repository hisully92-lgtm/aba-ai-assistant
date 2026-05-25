"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import {
  getUserCompany, getCompanyMembers, getCompanyInvites,
  removeMember, cancelInvite,
  type Company, type CompanyUser, type Invite,
} from "@/lib/teams";
import { useRole } from "@/lib/hooks/useRole";

const ROLES = ["clinician", "supervisor", "admin", "clinical_director", "rbt", "bt", "student_analyst", "parent"];

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
  status: string | null;
  seat_type: string | null;
};

export default function TeamPage() {
  const { isSupervisor, isAdmin, loading: roleLoading } = useRole();
  const [company, setCompany] = useState<Company | null>(null);
  const [members, setMembers] = useState<CompanyUser[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkEmails, setBulkEmails] = useState("");
  const [bulkRole, setBulkRole] = useState("clinician");
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [showBulk, setShowBulk] = useState(false);

  useEffect(() => { init(); }, []);

  async function init() {
    const co = await getUserCompany();
    setCompany(co);

    if (co) {
      const [m, i] = await Promise.all([
        getCompanyMembers(co.id),
        getCompanyInvites(co.id),
      ]);
      setMembers(m);
      setInvites(i);

      // Load profiles for all members
      if (m.length > 0) {
        const userIds = m.map((mem) => mem.user_id);
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name, role, status, seat_type")
          .in("id", userIds);

        const map = new Map((profileData ?? []).map((p: Profile) => [p.id, p]));
        setProfiles(map);
      }
    }

    setLoading(false);
  }

  async function handleRemoveMember(memberId: string) {
    await removeMember(memberId);
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  }

  async function handleCancelInvite(inviteId: string) {
    await cancelInvite(inviteId);
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
  }

  async function handleSuspend(userId: string, currentStatus: string) {
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    await supabase.from("profiles").update({ status: newStatus }).eq("id", userId);
    setProfiles((prev) => {
      const updated = new Map(prev);
      const profile = updated.get(userId);
      if (profile) updated.set(userId, { ...profile, status: newStatus });
      return updated;
    });
  }

  async function handleRoleChange(userId: string, role: string) {
    await supabase.from("profiles").update({ role }).eq("id", userId);
    setProfiles((prev) => {
      const updated = new Map(prev);
      const profile = updated.get(userId);
      if (profile) updated.set(userId, { ...profile, role });
      return updated;
    });
  }

  async function handleBulkInvite() {
    if (!company || !bulkEmails.trim()) return;
    setBulkSending(true);
    setBulkError(null);

    const emails = bulkEmails
      .split(/[\n,]/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@"));

    if (emails.length === 0) {
      setBulkError("No valid email addresses found.");
      setBulkSending(false);
      return;
    }

    const token = () => crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from("invites").insert(
      emails.map((email) => ({
        company_id: company.id,
        email,
        status: "pending",
        token: token(),
        expires_at: expiresAt,
      }))
    );

    if (error) {
      setBulkError(error.message);
    } else {
      setBulkSuccess(true);
      setBulkEmails("");
      setShowBulk(false);
      const updated = await getCompanyInvites(company.id);
      setInvites(updated);
      setTimeout(() => setBulkSuccess(false), 3000);
    }

    setBulkSending(false);
  }

  function statusBadge(status: string | null) {
    if (status === "suspended") return "bg-red-100 text-red-700";
    if (status === "active") return "bg-green-100 text-green-700";
    return "bg-gray-100 text-gray-500";
  }

  function roleBadge(role: string | null) {
    if (role === "admin") return "bg-purple-100 text-purple-700";
    if (role === "supervisor" || role === "clinical_director") return "bg-blue-100 text-blue-700";
    if (role === "clinician" || role === "rbt" || role === "bt") return "bg-green-100 text-green-700";
    return "bg-gray-100 text-gray-600";
  }

  if (roleLoading || loading) return <div className="p-6 text-gray-400">Loading team...</div>;

  if (!company) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader title="Team" />
        <Section title="No Team Found">
          <p className="text-gray-400 text-sm">You are not part of a clinic team yet.</p>
        </Section>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader title={`Team — ${company.name}`}>
        <div className="flex gap-2">
          {isSupervisor && (
            <>
              <Button variant="outline" onClick={() => setShowBulk(!showBulk)}>
                Bulk Invite
              </Button>
              <Button onClick={() => window.location.href = "/dashboard/team/invite"}>
                Invite Member
              </Button>
            </>
          )}
        </div>
      </PageHeader>

      {bulkSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          ✓ Invites sent successfully.
        </div>
      )}

      {/* BULK INVITE */}
      {showBulk && isSupervisor && (
        <Section title="Bulk Invite Members">
          {bulkError && <p className="text-red-500 text-sm mb-3">{bulkError}</p>}
          <div className="space-y-3 max-w-lg">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Email Addresses (one per line or comma-separated)
              </label>
              <textarea
                value={bulkEmails}
                onChange={(e) => setBulkEmails(e.target.value)}
                placeholder="john@clinic.com&#10;jane@clinic.com&#10;..."
                rows={5}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Role</label>
              <select
                value={bulkRole}
                onChange={(e) => setBulkRole(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleBulkInvite} loading={bulkSending}>Send Invites</Button>
              <Button variant="outline" onClick={() => setShowBulk(false)}>Cancel</Button>
            </div>
          </div>
        </Section>
      )}

      {/* MEMBERS */}
      <Section title={`Members (${members.length})`}>
        {members.length === 0 ? (
          <p className="text-gray-400 text-sm">No members yet.</p>
        ) : (
          <div className="space-y-2">
            {members.map((member) => {
              const profile = profiles.get(member.user_id);
              return (
                <div key={member.id} className="border border-gray-100 rounded-lg p-3 bg-white">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {profile?.full_name ?? member.user_id}
                      </p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(profile?.status ?? member.status)}`}>
                          {profile?.status ?? member.status}
                        </span>
                        {profile?.role && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge(profile.role)}`}>
                            {profile.role}
                          </span>
                        )}
                        {profile?.seat_type && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            {profile.seat_type}
                          </span>
                        )}
                      </div>
                    </div>

                    {(isSupervisor || isAdmin) && (
                      <div className="flex gap-2 flex-wrap">
                        {/* ROLE CHANGE */}
                        <select
                          value={profile?.role ?? "clinician"}
                          onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                          className="text-xs border rounded-lg px-2 py-1 focus:outline-none"
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>

                        {/* SUSPEND/ACTIVATE */}
                        <Button
                          variant="outline"
                          onClick={() => handleSuspend(member.user_id, profile?.status ?? "active")}
                        >
                          {profile?.status === "suspended" ? "Activate" : "Suspend"}
                        </Button>

                        {/* REMOVE */}
                        <Button variant="danger" onClick={() => handleRemoveMember(member.id)}>
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* PENDING INVITES */}
      {(isSupervisor || isAdmin) && invites.length > 0 && (
        <Section title={`Pending Invites (${invites.length})`}>
          <div className="space-y-2">
            {invites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-3 bg-white">
                <div>
                  <p className="text-sm font-medium text-gray-700">{invite.email}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Expires {new Date(invite.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <Button variant="outline" onClick={() => handleCancelInvite(invite.id)}>
                  Cancel
                </Button>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}