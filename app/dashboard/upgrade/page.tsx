"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function UpgradePage() {
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;

      if (!user) {
        alert("Not logged in");
        return;
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Checkout failed");
      }

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error("No checkout URL returned");
    } catch (err: any) {
      console.error("Upgrade error:", err.message);
      alert(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">Upgrade to Pro</h1>

      <p className="mt-2 text-gray-600">
        Unlock exports, reports, and AI features.
      </p>

      <button
        onClick={handleUpgrade}
        disabled={loading}
        className="mt-6 px-6 py-3 bg-black text-white rounded"
      >
        {loading ? "Redirecting..." : "Upgrade Now"}
      </button>
    </div>
  );
}