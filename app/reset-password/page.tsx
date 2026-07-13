"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let resolved = false;

    async function establishSession() {
      // PKCE-style link: ?code=... in the query string
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (!exchangeError) {
          resolved = true;
          setSessionReady(true);
          setCheckingSession(false);
          window.history.replaceState({}, "", "/reset-password");
          return;
        }
      }

      // Hash-fragment style link: #access_token=...&type=recovery
      // The Supabase client parses this automatically on load and fires PASSWORD_RECOVERY.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        resolved = true;
        setSessionReady(true);
        setCheckingSession(false);
      }
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event: string, session: any) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
        resolved = true;
        setSessionReady(true);
        setCheckingSession(false);
      }
    });

    establishSession();

    // Give it a few seconds to resolve via either path before giving up
    const timeout = setTimeout(() => {
      if (!resolved) {
        setCheckingSession(false);
        setSessionReady(false);
      }
    }, 4000);

    return () => {
      clearTimeout(timeout);
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  async function handleSubmit() {
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    setSuccess(true);
    setLoading(false);
    await supabase.auth.signOut();
    setTimeout(() => router.push("/login"), 2000);
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8 text-center">
          <p className="text-sm text-gray-500">Verifying your reset link...</p>
        </div>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8 space-y-4 text-center">
          <h1 className="text-2xl font-bold text-gray-800">Link expired or invalid</h1>
          <p className="text-sm text-gray-500">
            This password reset link is no longer valid. Reset links can only be used once and expire after a short time.
          </p>
          <a href="/forgot-password" className="inline-block text-blue-600 hover:underline text-sm font-medium">
            Request a new reset link →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Set a new password</h1>
          <p className="text-sm text-gray-500 mt-1">Choose a new password for your account.</p>
        </div>

        {success ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700 text-center space-y-2">
            <p className="text-2xl">✅</p>
            <p className="font-semibold">Password updated!</p>
            <p>Redirecting you to sign in...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Re-enter password"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
