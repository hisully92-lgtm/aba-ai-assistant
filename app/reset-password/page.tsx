"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

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
    setTimeout(() => router.push("/dashboard"), 2000);
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
            <p>Redirecting you to your dashboard...</p>
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
