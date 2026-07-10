"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

const YOUR_COMPANY_ID = "fcb8cbb2-4136-4d02-ba09-5355cc888189";

export default function SendInvitePage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }

    const { data: cu } = await supabase
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", user.id)
      .eq("company_id", YOUR_COMPANY_ID)
      .maybeSingle();

    if (!cu || !["admin", "director", "clinical_director"].includes(cu.role ?? "")) {
      window.location.href = "/dashboard";
      return;
    }

    setAuthorized(true);
    setLoading(false);
  }

  async function handleSend() {
    setSending(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch("/api/admin/send-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ email, orgName }),
      });

      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json();
        setError(data.error || "Something went wrong.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;
  if (!authorized) return null;

  return (
    <div className="max-w-lg mx-auto py-16 px-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Send Onboarding Invite</h1>
      <p className="text-gray-500 text-sm mb-8">
        Send a one-time onboarding link to an approved clinic. Expires in 1 hour.
      </p>

      {sent ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <p className="text-2xl mb-2">✅</p>
          <p className="font-semibold text-green-800">Invite sent to {email}</p>
          <button
            onClick={() => { setSent(false); setEmail(""); setOrgName(""); }}
            className="text-sm text-green-600 underline mt-3"
          >
            Send another
          </button>
        </div>
      ) : (
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 space-y-5">
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">
              Contact Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">
              Organization Name (for your reference, optional)
            </label>
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            onClick={handleSend}
            disabled={sending || !email}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send Invite"}
          </button>
        </div>
      )}
    </div>
  );
}
