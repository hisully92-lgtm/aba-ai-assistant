"use client";

import { useState } from "react";
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

export default function AppLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [method, setMethod] = useState<"magic" | "password">("password");

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
        options: { emailRedirectTo: `https://aba-ai-assistant.com/auth/confirm`, shouldCreateUser: mode === "signup" },
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
      window.location.href = "/dashboard";
      return;
    }
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: "#0f172a" }}
    >
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-2">
          <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg">
            <Image src="/icon-192.png" alt="ABA AI" width={64} height={64} className="object-cover" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">ABA AI</h1>
            <p className="text-xs text-gray-400">Practice Management</p>
          </div>
        </div>

        <div
          className="rounded-2xl p-6 space-y-5"
          style={{ backgroundColor: "#1a2234", border: "1px solid #2a3448" }}
        >
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setMode("signin"); setError(null); setSent(false); }}
              className="py-2 rounded-lg text-sm font-medium transition-colors"
              style={mode === "signin" ? { backgroundColor: "#2563eb", color: "#fff" } : { border: "1px solid #2a3448", color: "#9ca3af" }}>
              Sign In
            </button>
            <button type="button" onClick={() => { setMode("signup"); setError(null); setSent(false); }}
              className="py-2 rounded-lg text-sm font-medium transition-colors"
              style={mode === "signup" ? { backgroundColor: "#2563eb", color: "#fff" } : { border: "1px solid #2a3448", color: "#9ca3af" }}>
              Create Account
            </button>
          </div>

          <div className="flex gap-2 rounded-lg p-1" style={{ backgroundColor: "#0f172a" }}>
            <button type="button" onClick={() => { setMethod("password"); setError(null); }}
              className="flex-1 py-1.5 text-xs font-medium rounded-md transition-colors"
              style={method === "password" ? { backgroundColor: "#1a2234", color: "#60a5fa" } : { color: "#6b7280" }}>
              Password
            </button>
            <button type="button" onClick={() => { setMethod("magic"); setError(null); }}
              className="flex-1 py-1.5 text-xs font-medium rounded-md transition-colors"
              style={method === "magic" ? { backgroundColor: "#1a2234", color: "#60a5fa" } : { color: "#6b7280" }}>
              Magic Link
            </button>
          </div>

          {error && (
            <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: "#3b1a1a", color: "#fca5a5", border: "1px solid #5a2a2a" }}>
              {error}
            </div>
          )}

          {sent ? (
            <div className="rounded-lg p-4 text-sm text-center space-y-2" style={{ backgroundColor: "#132a1e", color: "#86efac", border: "1px solid #1f4a30" }}>
              <p className="text-2xl">📧</p>
              <p className="font-semibold">Check your email!</p>
              <p>We sent a {mode === "signin" ? "magic link" : "verification link"} to <strong>{email}</strong></p>
              <button type="button" onClick={() => { setSent(false); setEmail(""); setPassword(""); setError(null); }}
                className="text-xs underline mt-2" style={{ color: "#86efac" }}>
                Use a different email
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "#9ca3af" }}>Email address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !password && handleSubmit()}
                  placeholder="you@clinic.com"
                  className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none"
                  style={{ backgroundColor: "#0f172a", border: "1px solid #2a3448", color: "#fff" }} />
              </div>

              {method === "password" && (
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: "#9ca3af" }}>Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder={mode === "signup" ? "Min 8 chars, uppercase, number, symbol" : "Your password"}
                    className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none"
                    style={{ backgroundColor: "#0f172a", border: "1px solid #2a3448", color: "#fff" }} />

                  {mode === "signup" && password && strength && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1,2,3,4].map((i) => (
                          <div key={i} className={`h-1 flex-1 rounded-full ${i <= strength.score ? strength.color : ""}`}
                            style={i > strength.score ? { backgroundColor: "#2a3448" } : {}} />
                        ))}
                      </div>
                      <p className={`text-xs ${strength.score <= 1 ? "text-red-400" : strength.score <= 2 ? "text-yellow-400" : strength.score <= 3 ? "text-blue-400" : "text-green-400"}`}>
                        {strength.label} password
                      </p>
                    </div>
                  )}
                </div>
              )}

              {method === "magic" && (
                <p className="text-xs rounded-lg px-3 py-2" style={{ color: "#9ca3af", backgroundColor: "#132038", border: "1px solid #1e3a5f" }}>
                  We&apos;ll email you a secure link — no password needed.
                </p>
              )}

              {mode === "signin" && (
                <p className="text-xs text-right">
                  <a href="/forgot-password" className="hover:underline" style={{ color: "#60a5fa" }}>
                    Forgot password?
                  </a>
                </p>
              )}

              <button type="button" onClick={handleSubmit} disabled={loading}
                className="w-full font-semibold py-3 rounded-lg text-sm transition-colors disabled:opacity-50 cursor-pointer"
                style={{ backgroundColor: "#2563eb", color: "#fff" }}>
                {loading ? "Please wait..." : method === "magic" ? (mode === "signin" ? "Send Magic Link" : "Create Account") : (mode === "signin" ? "Sign In" : "Create Account")}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs" style={{ color: "#4b5563" }}>
          aba-ai-assistant.com
        </p>
      </div>
    </main>
  );
}