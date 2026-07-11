"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { PLAN_LIMITS, PLAN_NAMES, PlanType } from "@/lib/hooks/usePlanGate";

const PLAN_ORDER: PlanType[] = ["starter", "basic", "professional", "growth", "enterprise", "clinic"];

const PLAN_PRICES: Record<string, number> = {
  starter: 199, basic: 299, professional: 449, growth: 649, enterprise: 849, clinic: 1099,
};

export default function UpgradeRequiredModal({
  resourceType,
  currentPlan,
  companyId,
  companyName,
  onClose,
}: {
  resourceType: "clinicians" | "clients" | "locations";
  currentPlan: string;
  companyId: string;
  companyName: string;
  onClose: () => void;
}) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);

  const currentIndex = PLAN_ORDER.indexOf(currentPlan as PlanType);
  const availableUpgrades = PLAN_ORDER.slice(currentIndex + 1);

  async function handleRequest(plan: PlanType) {
    setSending(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      let contactName = "";

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        contactName = profile?.full_name || "";
      }

      await fetch("/api/request-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          companyName,
          currentPlan,
          requestedPlan: plan,
          resourceType,
          contactEmail: user?.email || "",
          contactName,
        }),
      });
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  const resourceLabel = { clinicians: "clinicians", clients: "clients", locations: "locations" }[resourceType];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        {sent ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">Sent</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Upgrade request sent!</h3>
            <p className="text-sm text-gray-500 mb-4">
              Our team will reach out shortly to help you upgrade.
            </p>
            <button
              onClick={onClose}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              You have reached your plan's {resourceLabel} limit
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              Your current plan does not include room for more {resourceLabel}. Choose a plan below to request an upgrade.
            </p>

            <div className="space-y-2 mb-5">
              {availableUpgrades.map((planId) => {
                if (!planId) return null;
                const p = PLAN_LIMITS[planId];
                return (
                  <button
                    key={planId}
                    onClick={() => setSelectedPlan(planId)}
                    className={`w-full text-left border-2 rounded-xl p-3 transition-colors ${
                      selectedPlan === planId ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-900 text-sm">{PLAN_NAMES[planId]}</span>
                      <span className="text-blue-600 font-bold text-sm">${PLAN_PRICES[planId]}/mo</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Up to {p.clinicians >= 9999 ? "unlimited" : p.clinicians} clinicians,{" "}
                      {p.clients >= 9999 ? "unlimited" : p.clients} clients,{" "}
                      {p.locations >= 9999 ? "unlimited" : p.locations} locations
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => selectedPlan && handleRequest(selectedPlan)}
                disabled={!selectedPlan || sending}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {sending ? "Sending..." : "Request Upgrade"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
