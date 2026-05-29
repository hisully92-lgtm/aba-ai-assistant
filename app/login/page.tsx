"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  async function handleSubmit() {
    if (!email.trim()) { setError("Please enter your email."); return; }
    setLoading(true);
    setError(null);

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (otpError) {
      setError(otpError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* BANNER */}
      <div className="relative h-60 flex items-center justify-center overflow-hidden">
        <Image
          src="/login-banner.jpg"
          alt="ABA AI"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/50" />
        <h1 className="relative text-5xl font-black text-white z-10">ABA AI</h1>
      </div>

      {/* FORM */}
      <div className="flex justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8 space-y-6">

          {/* Toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setMode("signin"); setError(null); }}
              className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                mode === "signin"
                  ? "bg-blue-600 text-white"
                  : "border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode("signup"); setError(null); }}
              className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                mode === "signup"
                  ? "bg-blue-600 text-white"
                  : "border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              Create Account
            </button>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {mode === "signin"
                ? "Enter your email and we'll send you a magic link to sign in."
                : "Enter your email to get started. We'll send you a magic link."}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {sent ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700 text-center space-y-2">
              <p className="text-2xl">📧</p>
              <p className="font-semibold">Check your email!</p>
              <p>We sent a link to <strong>{email}</strong></p>
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="text-xs text-green-600 underline mt-2"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="you@clinic.com"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {loading ? "Sending..." : mode === "signin" ? "Send Magic Link" : "Create Account"}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}