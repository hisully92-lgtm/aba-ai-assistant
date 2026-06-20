"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Image from "next/image";

export default function ParentLoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email.trim()) { setError("Please enter your email."); return; }
    setLoading(true);
    setError(null);

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/parent/auth/confirm`,
        shouldCreateUser: false,
      },
    });

    if (otpError) {
      setError("We could not find an account with that email. Please contact your clinic.");
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col">
      <div className="relative h-48 flex items-center justify-center overflow-hidden">
        <Image src="/login-banner.jpg" alt="ABA AI" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 text-center">
          <h1 className="text-4xl font-black text-white">ABA AI</h1>
          <p className="text-blue-200 text-sm mt-1">Parent & Caregiver Portal</p>
        </div>
      </div>

      <div className="flex justify-center px-4 py-10 flex-1">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Welcome</h2>
            <p className="text-sm text-gray-500 mt-1">
              Sign in to view your child&apos;s therapy progress, sessions, and documents.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {sent ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center space-y-2">
              <p className="text-2xl">📧</p>
              <p className="font-semibold text-green-800">Check your email!</p>
              <p className="text-sm text-green-700">
                We sent a magic link to <strong>{email}</strong>
              </p>
              <p className="text-xs text-green-600">Click the link to access your portal.</p>
              <button onClick={() => { setSent(false); setEmail(""); }}
                className="text-xs text-green-600 underline mt-2">
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
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  placeholder="your@email.com"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg text-sm transition-colors disabled:opacity-50">
                {loading ? "Sending..." : "Send Magic Link →"}
              </button>

              <p className="text-xs text-center text-gray-400">
                We will email you a secure link — no password needed.
              </p>
            </div>
          )}

          <div className="border-t pt-4 text-center">
            <p className="text-xs text-gray-400">
              Are you a clinician?{" "}
              <a href="/login" className="text-blue-500 hover:underline">Sign in here</a>
            </p>
          </div>
        </div>
      </div>

      <footer className="py-4 text-center text-xs text-gray-400">
        <p>HIPAA compliant · Secure · ABA AI Assistant</p>
      </footer>
    </main>
  );
}
