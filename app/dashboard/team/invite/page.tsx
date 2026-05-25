"use client";

import { useEffect, useState } from "react";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { getUserCompany, sendInvite, type Company } from "@/lib/teams";
import { useRole } from "@/lib/hooks/useRole";

export default function InvitePage() {
  const { isSupervisor, loading: roleLoading } = useRole();
  const [company, setCompany] = useState<Company | null>(null);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getUserCompany().then(setCompany);
  }, []);

  async function handleInvite() {
    if (!company || !email.trim()) return;
    setSending(true);
    setError(null);
    setSuccess(false);

    const result = await sendInvite(company.id, email);

    if (result.success) {
      setSuccess(true);
      setEmail("");
    } else {
      setError(result.error ?? "Failed to send invite");
    }

    setSending(false);
  }

  if (roleLoading) return <div className="p-6 text-gray-400">Loading...</div>;

  if (!isSupervisor) {
    return (
      <div className="p-6">
        <p className="text-red-500 font-semibold">Access denied. Supervisor or Admin role required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Invite Team Member">
        <p className="text-gray-500 text-sm">Send an invite to join your clinic team.</p>
      </PageHeader>

      <Section title="Send Invite">
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 mb-3">
            Invite sent successfully.
          </div>
        )}

        <div className="flex flex-col gap-3 max-w-md">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              placeholder="colleague@example.com"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <Button onClick={handleInvite} loading={sending}>
            Send Invite
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.href = "/dashboard/team"}
          >
            Back to Team
          </Button>
        </div>
      </Section>
    </div>
  );
}