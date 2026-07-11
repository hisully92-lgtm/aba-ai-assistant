"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

interface UpgradePromptProps {
  reason: string;
  upgradeTo?: string;
  feature?: string;
  inline?: boolean;
}

export default function UpgradePrompt({ reason, upgradeTo, feature, inline = false }: UpgradePromptProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleRequestUpgrade() {
    setSending(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      let companyId = "";
      let companyName = "Your clinic";

      if (user) {
        const { data: companyUser } = await supabase
          .from("company_users")
          .select("company_id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        if (companyUser?.company_id) {
          companyId = companyUser.company_id;
          const { data: company } = await supabase
            .from("companies")
            .select("name")
            .eq("id", companyUser.company_id)
            .single();
          companyName = company?.name || "Your clinic";
        }
      }

      await fetch("/api/request-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          companyName,
          currentPlan: "current",
          requestedPlan: upgradeTo || "next tier",
          resourceType: feature || reason,
        }),
      });
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  if (inline) {
    return (
      <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700">
        <span>Limit reached:</span>
        <span>{reason}</span>
        <button
          onClick={handleRequestUpgrade}
          disabled={sending || sent}
          className="ml-auto shrink-0 bg-orange-500 text-white px-2 py-1 rounded-lg hover:bg-orange-600 transition-colors font-medium disabled:opacity-50"
        >
          {sent ? "Requested" : sending ? "Sending..." : "Request Upgrade"}
        </button>
      </div>
    );
  }

  return (
    <div className="border-2 border-dashed border-orange-200 rounded-2xl p-8 text-center bg-orange-50">
      <p className="font-bold text-gray-800 text-lg mb-2">
        {feature ? feature + " requires an upgrade" : "Upgrade to unlock this feature"}
      </p>
      <p className="text-sm text-gray-500 mb-6">{reason}</p>
      <button
        onClick={handleRequestUpgrade}
        disabled={sending || sent}
        className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {sent ? "Upgrade Requested" : sending ? "Sending..." : "Request Upgrade"}
      </button>
      {upgradeTo && !sent && (
        <p className="text-xs text-gray-400 mt-3">
          Suggested next plan: <strong className="capitalize">{upgradeTo}</strong>
        </p>
      )}
      {sent && (
        <p className="text-xs text-gray-400 mt-3">
          Our team will reach out shortly to help you upgrade.
        </p>
      )}
    </div>
  );
}
