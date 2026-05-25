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
  const [magicSent, setMagicSent] = useState(false);
  const [magicSending, setMagicSending] = useState(false);
  const [magicEmail, setMagicEmail] = useState("");
  const [mfaEnrolling, setMfaEnrolling] = useState(false);
  const [mfaQR, setMfaQR] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaVerifying, setMfaVerifying] = useState(false);
  const [mfaSuccess, setMfaSuccess] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePasswordReset() {
    if (!email.trim()) { setError("Please enter your email address."); return; }
    setSending(true);
    setError(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/dashboard/settings/security`,
    });

    if (resetError) { setError(resetError.message); } else { setSent(true); }
    setSending(false);
  }

  async function handleMagicLink() {
    if (!magicEmail.trim()) { setError("Please enter your email address."); return; }
    setMagicSending(true);
    setError(null);

    const { error: magicError } = await supabase.auth.signInWithOtp({
      email: magicEmail.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (magicError) { setError(magicError.message); } else { setMagicSent(true); }
    setMagicSending(false);
  }

  async function handleEnrollMFA() {
    setMfaEnrolling(true);
    setError(null);

    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "ABA AI Authenticator",
      });

      if (enrollError) { setError(enrollError.message); setMfaEnrolling(false); return; }

      if (data?.totp) {
        setMfaQR(data.totp.qr_code);
        setMfaSecret(data.totp.secret);
        setMfaFactorId(data.id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "MFA enrollment failed");
    } finally {
      setMfaEnrolling(false);
    }
  }

  async function handleVerifyMFA() {
    if (!mfaCode.trim() || !mfaFactorId) return;
    setMfaVerifying(true);
    setError(null);

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      });

      if (challengeError) { setError(challengeError.message); setMfaVerifying(false); return; }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challengeData.id,
        code: mfaCode,
      });

      if (verifyError) { setError(verifyError.message); } else { setMfaSuccess(true); setMfaQR(null); }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "MFA verification failed");
    } finally {
      setMfaVerifying(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Security">
        <p className="text-gray-500 text-sm">Manage your password, magic link, and two-factor authentication.</p>
      </PageHeader>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* PASSWORD RESET */}
      <Section title="Password Reset">
        {sent ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
            ✓ Password reset email sent. Check your inbox.
          </div>
        ) : (
          <div className="flex flex-col gap-3 max-w-md">
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

      {/* MAGIC LINK */}
      <Section title="Magic Link Login">
        <p className="text-sm text-gray-500 mb-3">
          Send a passwordless login link to your email. Click the link to sign in instantly.
        </p>
        {magicSent ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
            ✓ Magic link sent! Check your email to sign in.
          </div>
        ) : (
          <div className="flex flex-col gap-3 max-w-md">
            <input
              type="email"
              value={magicEmail}
              onChange={(e) => setMagicEmail(e.target.value)}
              placeholder="Your email address"
              className="border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <Button onClick={handleMagicLink} loading={magicSending} variant="secondary">
              Send Magic Link
            </Button>
          </div>
        )}
      </Section>

      {/* MFA */}
      <Section title="Two-Factor Authentication (2FA)">
        <p className="text-sm text-gray-500 mb-3">
          Add an extra layer of security using an authenticator app like Google Authenticator or Authy.
        </p>

        {mfaSuccess ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
            ✓ Two-factor authentication enabled successfully.
          </div>
        ) : mfaQR ? (
          <div className="space-y-4 max-w-sm">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                1. Scan this QR code with your authenticator app:
              </p>
              <img src={mfaQR} alt="MFA QR Code" className="border rounded-lg p-2 bg-white w-48 h-48" />
            </div>

            {mfaSecret && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Or enter this secret manually:
                </p>
                <code className="text-xs bg-gray-100 px-3 py-2 rounded-lg block break-all">
                  {mfaSecret}
                </code>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">
                2. Enter the 6-digit code from your app:
              </p>
              <input
                type="text"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="border rounded-lg px-3 py-2 text-sm w-32 text-center font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleVerifyMFA} loading={mfaVerifying} disabled={mfaCode.length !== 6}>
                Verify & Enable 2FA
              </Button>
              <Button variant="outline" onClick={() => { setMfaQR(null); setMfaSecret(null); setMfaCode(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={handleEnrollMFA} loading={mfaEnrolling} variant="secondary">
            Enable Two-Factor Authentication
          </Button>
        )}
      </Section>

      {/* SESSION */}
      <Section title="Session">
        <p className="text-sm text-gray-600 mb-3">Sign out of your account on this device.</p>
        <Button variant="danger" onClick={handleLogout}>Log Out</Button>
      </Section>
    </div>
  );
}