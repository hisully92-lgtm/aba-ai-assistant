"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<"magic" | "password">("magic");
  const [timeoutMsg, setTimeoutMsg] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "timeout") setTimeoutMsg(true);
  }, []);

  async function handleSubmit() {
    if (!email.trim()) { setError("Please enter your email."); return; }
    if (method === "password" && !password.trim()) { setError("Please enter your password."); return; }

    setLoading(true);
    setError(null);

    if (method === "magic") {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: "https://aba-ai-assistant.com/auth/confirm", shouldCreateUser: false },
      });
      if (otpError) { setError(otpError.message); setLoading(false); return; }
      setSent(true);
      setLoading(false);
      return;
    }

    if (method === "password") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(), password,
      });
      if (signInError) { setError(signInError.message); setLoading(false); return; }
      window.location.href = "/dashboard";
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
              Your session expired after 30 minutes of inactivity. Please sign in again.
            </div>
          )}

          <div>
            <h2 className="text-2xl font-bold text-gray-800">Welcome back</h2>
            <p className="text-sm text-gray-500 mt-1">Sign in with a magic link or your password.</p>
          </div>

          <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
            <button type="button" onClick={() => { setMethod("magic"); setError(null); }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${method === "magic" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              Magic Link
            </button>
            <button type="button" onClick={() => { setMethod("password"); setError(null); }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${method === "password" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              Password
            </button>
          </div>

          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

          {sent ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700 text-center space-y-2">
              <p className="text-2xl">📧</p>
              <p className="font-semibold">Check your email!</p>
              <p>We sent a magic link to <strong>{email}</strong></p>
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
                    placeholder="Your password"
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              )}

              {method === "magic" && (
                <p className="text-xs text-gray-400 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  We&apos;ll email you a secure link — no password needed.
                </p>
              )}

              <p className="text-xs text-right">
                <Link href="/forgot-password" className="text-blue-500 hover:underline">
                  Forgot password?
                </Link>
              </p>

              <button type="button" onClick={handleSubmit} disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg text-sm transition-colors disabled:opacity-50 cursor-pointer">
                {loading ? "Please wait..." : method === "magic" ? "Send Magic Link" : "Sign In"}
              </button>

              <p className="text-xs text-center text-gray-400">
                Don&apos;t have an account?{" "}
                <Link href="/request-access" className="text-blue-500 hover:underline">Request Access</Link>
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="py-8 text-center space-y-3">
        <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-400">
          <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
          <Link href="/about" className="hover:text-gray-600 transition-colors">About Us</Link>
          <Link href="/#features" className="hover:text-gray-600 transition-colors">Features</Link>
          <Link href="/#pricing" className="hover:text-gray-600 transition-colors">Pricing</Link>
          <Link href="/contact" className="hover:text-gray-600 transition-colors">Contact</Link>
          <Link href="/suggestions" className="hover:text-gray-600 transition-colors">Suggestions</Link>
          <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy</Link>
          <Link href="/hipaa" className="hover:text-gray-600 transition-colors">HIPAA</Link>
        </div>
        <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-400">
          <a href="https://www.yelp.com/biz/aba-ai-assistant" target="_blank" rel="noopener noreferrer"
            className="hover:text-red-500 transition-colors">Review us on Yelp</a>
          <a href="https://g.page/r/aba-ai-assistant/review" target="_blank" rel="noopener noreferrer"
            className="hover:text-blue-500 transition-colors">Review us on Google</a>
        </div>
        <p className="text-xs text-gray-300">
          Questions?{" "}
          <a href="mailto:support@aba-ai-assistant.com" className="text-blue-400 hover:underline">Contact us</a>
          {" "}or{" "}
          <Link href="/contact" className="text-blue-400 hover:underline">request more information</Link>
        </p>
      </div>
    </main>
  );
}
