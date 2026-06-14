"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";

type Invite = {
  id: string;
  student_email: string;
  student_name: string | null;
  client_id: string | null;
  message: string | null;
  token: string;
  status: string;
  accepted_at: string | null;
  created_at: string;
};

type Client = { id: string; full_name: string };

export default function StudentInvitePage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReviewer, setIsReviewer] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState("");

  // Form
  const [studentEmail, setStudentEmail] = useState("");
  const [studentName, setStudentName] = useState("");
  const [clientId, setClientId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const role = companyUser?.role ?? "";
    setCompanyId(companyUser?.company_id ?? "");
    setIsReviewer(["admin", "supervisor", "clinical_director", "bcba"].includes(role));

    const [{ data: inviteData }, { data: clientData }] = await Promise.all([
      supabase.from("student_analyst_invites")
        .select("*")
        .eq("company_id", companyUser?.company_id)
        .order("created_at", { ascending: false }),
      supabase.from("clients").select("id, full_name"),
    ]);

    setInvites(inviteData ?? []);
    setClients(clientData ?? []);
    setLoading(false);
  }

  async function handleSend() {
    if (!studentEmail.trim()) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const token = crypto.randomUUID();

    const { data } = await supabase.from("student_analyst_invites").insert({
      company_id: companyId,
      student_email: studentEmail.trim().toLowerCase(),
      student_name: studentName.trim() || null,
      client_id: clientId || null,
      message: message.trim() || null,
      token,
      status: "pending",
      invited_by: user.id,
    }).select().single();

    // Send invite email
    const inviteLink = `${window.location.origin}/onboarding?invite=${token}&role=student_analyst`;
    await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: studentEmail.trim(),
        subject: "You have been invited to collaborate on ABA AI Assistant",
        body: `
          <h2>You have been invited to collaborate</h2>
          <p>A BCBA or supervisor has invited you to collaborate on a client case using ABA AI Assistant.</p>
          ${message.trim() ? `<p><strong>Message:</strong> ${message.trim()}</p>` : ""}
          <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p><strong>Click the link below to accept your invitation:</strong></p>
            <a href="${inviteLink}" style="color: #2563eb; font-weight: bold;">${inviteLink}</a>
          </div>
          <p style="color: #6b7280; font-size: 12px;">This invite link is unique to you. Do not share it with others.</p>
        `,
      }),
    });

    if (data) setInvites(prev => [data, ...prev]);
    setStudentEmail(""); setStudentName(""); setClientId(""); setMessage("");
    setShowForm(false);
    setSaving(false);
  }

  async function revokeInvite(id: string) {
    await supabase.from("student_analyst_invites").update({ status: "revoked" }).eq("id", id);
    setInvites(prev => prev.map(i => i.id === id ? { ...i, status: "revoked" } : i));
  }

  async function copyLink(token: string) {
    const link = `${window.location.origin}/onboarding?invite=${token}&role=student_analyst`;
    await navigator.clipboard.writeText(link);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  const clientMap = new Map(clients.map(c => [c.id, c.full_name]));

  function statusColor(status: string) {
    if (status === "accepted") return "bg-green-100 text-green-700";
    if (status === "pending") return "bg-yellow-100 text-yellow-700";
    if (status === "revoked") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-600";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Student Analyst Invites">
        {isReviewer && (
          <button onClick={() => setShowForm(s => !s)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            {showForm ? "Cancel" : "+ Send Invite"}
          </button>
        )}
      </PageHeader>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
        🎓 Invite student analysts and trainees to collaborate on specific client cases.
        Each invite generates a unique link. Students must be invited by a BCBA or supervisor.
        All student work requires BCBA approval before it is finalized.
      </div>

      {showForm && isReviewer && (
        <Section title="Send Collaboration Invite">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Student Email *</label>
                <input type="email" value={studentEmail} onChange={e => setStudentEmail(e.target.value)}
                  placeholder="student@email.com"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Student Name (optional)</label>
                <input type="text" value={studentName} onChange={e => setStudentName(e.target.value)}
                  placeholder="First and last name"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Client to Collaborate On (optional)</label>
                <select value={clientId} onChange={e => setClientId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="">General collaboration</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Personal Message (optional)</label>
                <input type="text" value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="e.g. Looking forward to working with you on this case"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-xs text-yellow-700">
              📧 An email will be sent to the student with a unique invite link. The link expires after 7 days if not accepted.
              All student contributions must be approved by a supervising BCBA before being included in official records.
            </div>

            <div className="flex gap-2">
              <button onClick={handleSend} disabled={saving || !studentEmail.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? "Sending..." : "Send Invite"}
              </button>
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </Section>
      )}

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Invites", value: invites.length, color: "text-blue-600" },
          { label: "Accepted", value: invites.filter(i => i.status === "accepted").length, color: "text-green-600" },
          { label: "Pending", value: invites.filter(i => i.status === "pending").length, color: "text-yellow-600" },
        ].map(stat => (
          <div key={stat.label} className="border rounded-xl p-4 text-center bg-white">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}

      {!loading && invites.length === 0 && (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
          <p className="text-4xl mb-3">🎓</p>
          <p className="text-gray-600 font-medium">No invites sent yet</p>
          <p className="text-gray-400 text-sm mt-1">BCBAs and supervisors can invite student analysts to collaborate on cases.</p>
        </div>
      )}

      <div className="space-y-3">
        {invites.map(invite => (
          <div key={invite.id} className="border border-gray-100 rounded-xl p-4 bg-white">
            <div className="flex justify-between items-start gap-3 flex-wrap">
              <div>
                <p className="font-medium text-gray-800">{invite.student_name ?? invite.student_email}</p>
                <p className="text-xs text-gray-400 mt-0.5">{invite.student_email}</p>
                {invite.client_id && (
                  <p className="text-xs text-blue-600 mt-0.5">
                    Client: {clientMap.get(invite.client_id) ?? "Unknown"}
                  </p>
                )}
                {invite.message && <p className="text-xs text-gray-400 italic mt-1">{invite.message}</p>}
                <p className="text-xs text-gray-300 mt-1">{new Date(invite.created_at).toLocaleDateString()}</p>
                {invite.accepted_at && (
                  <p className="text-xs text-green-600 mt-0.5">
                    Accepted {new Date(invite.accepted_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2 items-end">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(invite.status)}`}>
                  {invite.status}
                </span>
                {invite.status === "pending" && (
                  <div className="flex gap-2">
                    <button onClick={() => copyLink(invite.token)}
                      className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                      {copied === invite.token ? "Copied!" : "Copy Link"}
                    </button>
                    {isReviewer && (
                      <button onClick={() => revokeInvite(invite.id)}
                        className="text-xs px-2 py-1 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors">
                        Revoke
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}