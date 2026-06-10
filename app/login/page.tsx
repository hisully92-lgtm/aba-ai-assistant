"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import Image from "next/image";

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { score, label: "Weak", color: "bg-red-500" };
  if (score <= 2) return { score, label: "Fair", color: "bg-yellow-500" };
  if (score <= 3) return { score, label: "Good", color: "bg-blue-500" };
  return { score, label: "Strong", color: "bg-green-500" };
}

function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain at least one special character (!@#$%^&*).";
  return null;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [method, setMethod] = useState<"magic" | "password">("magic");
  const [timeoutMsg, setTimeoutMsg] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "timeout") setTimeoutMsg(true);
  }, []);

  const strength = method === "password" && mode === "signup" ? getPasswordStrength(password) : null;

  async function handleSubmit() {
    if (!email.trim()) { setError("Please enter your email."); return; }
    if (method === "password" && !password.trim()) { setError("Please enter your password."); return; }

    if (method === "password" && mode === "signup") {
      const validationError = validatePassword(password);
      if (validationError) { setError(validationError); return; }
    }

    setLoading(true);
    setError(null);

    if (method === "magic") {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm`, shouldCreateUser: mode === "signup" },
      });
      if (otpError) { setError(otpError.message); setLoading(false); return; }
      setSent(true);
      setLoading(false);
      return;
    }

    if (method === "password" && mode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
      });
      if (signUpError) { setError(signUpError.message); setLoading(false); return; }
      setSent(true);
      setLoading(false);
      return;
    }

    if (method === "password" && mode === "signin") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(), password,
      });
      if (signInError) { setError(signInError.message); setLoading(false); return; }
      window.location.href = "/auth/confirm";
      return;
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="relative h-60 flex items-center justify-center overflow-hidden">
        <Image src="/login-banner.jpg" alt="ABA AI" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-black/50" />
        <h1 className="relative text-5xl font-black text-white z-10">ABA AI</h1>
      </div>

      <div className="flex justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8 space-y-6">

          {timeoutMsg && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              ⏱️ Your session expired after 30 minutes of inactivity. Please sign in again.
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setMode("signin"); setError(null); setSent(false); }}
              className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${mode === "signin" ? "bg-blue-600 text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
              Sign In
            </button>
            <button type="button" onClick={() => { setMode("signup"); setError(null); setSent(false); }}
              className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${mode === "signup" ? "bg-blue-600 text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
              Create Account
            </button>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {mode === "signin" ? "Sign in with a magic link or your password." : "Create your account with a magic link or password."}
            </p>
          </div>

          <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
            <button type="button" onClick={() => { setMethod("magic"); setError(null); }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${method === "magic" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              ✉️ Magic Link
            </button>
            <button type="button" onClick={() => { setMethod("password"); setError(null); }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${method === "password" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              🔒 Password
            </button>
          </div>

          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

          {sent ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700 text-center space-y-2">
              <p className="text-2xl">📧</p>
              <p className="font-semibold">Check your email!</p>
              <p>We sent a {mode === "signin" ? "magic link" : "verification link"} to <strong>{email}</strong></p>
              <p className="text-xs text-green-600">Click the link in your email to continue.</p>
              <button type="button" onClick={() => { setSent(false); setEmail(""); setPassword(""); setError(null); }}
                className="text-xs text-green-600 underline mt-2">
                Use a different email
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Email address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !password && handleSubmit()}
                  placeholder="you@clinic.com"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>

              {method === "password" && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder={mode === "signup" ? "Min 8 chars, uppercase, number, symbol" : "Your password"}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />

                  {/* PASSWORD STRENGTH */}
                  {mode === "signup" && password && strength && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1,2,3,4].map((i) => (
                          <div key={i} className={`h-1 flex-1 rounded-full ${i <= strength.score ? strength.color : "bg-gray-200"}`} />
                        ))}
                      </div>
                      <p className={`text-xs ${strength.score <= 1 ? "text-red-500" : strength.score <= 2 ? "text-yellow-500" : strength.score <= 3 ? "text-blue-500" : "text-green-600"}`}>
                        {strength.label} password
                      </p>
                      {mode === "signup" && (
                        <ul className="text-xs text-gray-400 mt-1 space-y-0.5">
                          <li className={password.length >= 8 ? "text-green-500" : ""}>✓ At least 8 characters</li>
                          <li className={/[A-Z]/.test(password) ? "text-green-500" : ""}>✓ One uppercase letter</li>
                          <li className={/[0-9]/.test(password) ? "text-green-500" : ""}>✓ One number</li>
                          <li className={/[^A-Za-z0-9]/.test(password) ? "text-green-500" : ""}>✓ One special character</li>
                        </ul>
                      )}
                    </div>
                  )}

                  {mode === "signin" && (
                    <button type="button"
                      onClick={async () => {
                        if (!email.trim()) { setError("Enter your email first."); return; }
                        setLoading(true);
                        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                          redirectTo: `${window.location.origin}/auth/confirm`,
                        });
                        setLoading(false);
                        if (resetError) { setError(resetError.message); return; }
                        setError(null);
                        setSent(true);
                      }}
                      className="text-xs text-blue-500 hover:underline mt-1 block text-right">
                      Forgot password?
                    </button>
                  )}
                </div>
              )}

              {method === "magic" && (
                <p className="text-xs text-gray-400 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  We&apos;ll email you a secure link — no password needed.
                </p>
              )}

              <button type="button" onClick={handleSubmit} disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg text-sm transition-colors disabled:opacity-50 cursor-pointer">
                {loading ? "Please wait..." : method === "magic" ? (mode === "signin" ? "Send Magic Link" : "Create Account →") : (mode === "signin" ? "Sign In →" : "Create Account →")}
              </button>

              {mode === "signin" && (
                <p className="text-xs text-center text-gray-400">
                  Don&apos;t have an account?{" "}
                  <button type="button" onClick={() => setMode("signup")} className="text-blue-500 hover:underline">Create one</button>
                </p>
              )}
              {mode === "signup" && (
                <p className="text-xs text-center text-gray-400">
                  Already have an account?{" "}
                  <button type="button" onClick={() => setMode("signin")} className="text-blue-500 hover:underline">Sign in</button>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}