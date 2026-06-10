"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { score, label: "Weak", color: "bg-red-500", textColor: "text-red-500" };
  if (score <= 2) return { score, label: "Fair", color: "bg-yellow-500", textColor: "text-yellow-500" };
  if (score <= 3) return { score, label: "Good", color: "bg-blue-500", textColor: "text-blue-500" };
  return { score, label: "Strong", color: "bg-green-500", textColor: "text-green-600" };
}

export default function SecurityPage() {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [mfaEnrolling, setMfaEnrolling] = useState(false);
  const [mfaQR, setMfaQR] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaVerifying, setMfaVerifying] = useState(false);
  const [mfaSuccess, setMfaSuccess] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaUnenrolling, setMfaUnenrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [lastActivity, setLastActivity] = useState<string | null>(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserEmail(user.email ?? "");
    setEmail(user.email ?? "");

    // Check MFA status
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totpFactor = factors?.totp?.find((f) => f.status === "verified");
    if (totpFactor) {
      setMfaEnabled(true);
      setMfaFactorId(totpFactor.id);
    }

    setLastActivity(new Date().toLocaleString());
  }

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

  async function handleChangePassword() {
    if (!newPassword || !confirmPassword) { setError("Please fill in both password fields."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (!/[A-Z]/.test(newPassword)) { setError("Password must contain at least one uppercase letter."); return; }
    if (!/[0-9]/.test(newPassword)) { setError("Password must contain at least one number."); return; }
    if (!/[^A-Za-z0-9]/.test(newPassword)) { setError("Password must contain at least one special character."); return; }

    setChangingPassword(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) { setError(updateError.message); } else {
      setPasswordChanged(true);
      setNewPassword("");
      setConfirmPassword("");
    }
    setChangingPassword(false);
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
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (challengeError) { setError(challengeError.message); setMfaVerifying(false); return; }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId, challengeId: challengeData.id, code: mfaCode,
      });
      if (verifyError) { setError(verifyError.message); } else {
        setMfaSuccess(true);
        setMfaEnabled(true);
        setMfaQR(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "MFA verification failed");
    } finally {
      setMfaVerifying(false);
    }
  }

  async function handleUnenrollMFA() {
    if (!mfaFactorId) return;
    if (!confirm("Are you sure you want to disable two-factor authentication? This reduces account security.")) return;
    setMfaUnenrolling(true);
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
    if (unenrollError) { setError(unenrollError.message); } else {
      setMfaEnabled(false);
      setMfaSuccess(false);
      setMfaFactorId(null);
    }
    setMfaUnenrolling(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const strength = newPassword ? getPasswordStrength(newPassword) : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Security">
        <p className="text-gray-500 text-sm">Manage your password, 2FA, and session security.</p>
      </PageHeader>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
      )}

      {/* SESSION INFO */}
      <Section title="Session Information">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 mb-1">Signed in as</p>
            <p className="text-gray-800 font-medium truncate">{userEmail}</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 mb-1">Session Timeout</p>
            <p className="text-gray-800 font-medium">30 minutes inactivity</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 mb-1">2FA Status</p>
            <p className={`font-medium ${mfaEnabled ? "text-green-600" : "text-orange-500"}`}>
              {mfaEnabled ? "✓ Enabled" : "⚠️ Not enabled"}
            </p>
          </div>
        </div>
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
          For HIPAA compliance, your session automatically expires after 30 minutes of inactivity. You will be redirected to the login page.
        </div>
      </Section>

      {/* TWO-FACTOR AUTHENTICATION */}
      <Section title="Two-Factor Authentication (2FA)">
        <p className="text-sm text-gray-500 mb-3">
          Add an extra layer of security using an authenticator app like Google Authenticator or Authy.
          {!mfaEnabled && <span className="text-orange-600 font-medium"> Strongly recommended for HIPAA compliance.</span>}
        </p>

        {mfaEnabled ? (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <span className="text-2xl">🔐</span>
              <div>
                <p className="text-sm font-semibold text-green-700">Two-factor authentication is enabled</p>
                <p className="text-xs text-green-600 mt-0.5">Your account is protected with an authenticator app.</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleUnenrollMFA} loading={mfaUnenrolling}>
              Disable 2FA
            </Button>
          </div>
        ) : mfaQR ? (
          <div className="space-y-4 max-w-sm">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">1. Scan this QR code with your authenticator app:</p>
              <img src={mfaQR} alt="MFA QR Code" className="border rounded-lg p-2 bg-white w-48 h-48" />
            </div>
            {mfaSecret && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Or enter this secret manually:</p>
                <code className="text-xs bg-gray-100 px-3 py-2 rounded-lg block break-all">{mfaSecret}</code>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">2. Enter the 6-digit code from your app:</p>
              <input type="text" value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000" maxLength={6}
                className="border rounded-lg px-3 py-2 text-sm w-32 text-center font-mono focus:outline-none focus:ring-2 focus:ring-blue-300" />
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

      {/* CHANGE PASSWORD */}
      <Section title="Change Password">
        <p className="text-sm text-gray-500 mb-3">
          Update your password. Must be at least 8 characters with uppercase, number, and special character.
        </p>
        {passwordChanged ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
            ✓ Password updated successfully.
          </div>
        ) : (
          <div className="space-y-3 max-w-md">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">New Password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              {newPassword && strength && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1,2,3,4].map((i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full ${i <= strength.score ? strength.color : "bg-gray-200"}`} />
                    ))}
                  </div>
                  <p className={`text-xs ${strength.textColor}`}>{strength.label}</p>
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
            </div>
            <Button onClick={handleChangePassword} loading={changingPassword}>Update Password</Button>
          </div>
        )}
      </Section>

      {/* PASSWORD RESET EMAIL */}
      <Section title="Send Password Reset Email">
        <p className="text-sm text-gray-500 mb-3">Send a password reset link to your email address.</p>
        {sent ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
            ✓ Password reset email sent to {email}. Check your inbox.
          </div>
        ) : (
          <div className="flex flex-col gap-3 max-w-md">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              className="border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <Button onClick={handlePasswordReset} loading={sending} variant="secondary">
              Send Reset Email
            </Button>
          </div>
        )}
      </Section>

      {/* SESSION */}
      <Section title="Sign Out">
        <p className="text-sm text-gray-600 mb-3">Sign out of your account on this device. All unsaved work will be lost.</p>
        <Button variant="danger" onClick={handleLogout}>Sign Out</Button>
      </Section>
    </div>
  );
}