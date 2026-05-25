"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

export default function SecurityPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePasswordReset() {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setSending(true);
    setError(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/dashboard/settings/security`,
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setSent(true);
    }

    setSending(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Security">
        <p className="text-gray-500 text-sm">Manage your password and account security.</p>
      </PageHeader>

      <Section title="Password Reset">
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        {sent ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
            Password reset email sent. Check your inbox.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              className="border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <Button onClick={handlePasswordReset} loading={sending} variant="secondary">
              Send Reset Email
            </Button>
          </div>
        )}
      </Section>

      <Section title="Session">
        <p className="text-sm text-gray-600 mb-3">
          Sign out of your account on this device.
        </p>
        <Button variant="danger" onClick={handleLogout}>
          Log Out
        </Button>
      </Section>
    </div>
  );
}