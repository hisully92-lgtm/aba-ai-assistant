"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Profile = {
  plan: string;
  subscription_status: string;
  exports_used: number;
  export_limit: number;
};

export default function BillingPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("plan, subscription_status, exports_used, export_limit")
        .eq("id", user.id)
        .single();

      setProfile(data);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Plan & Billing">
        <p className="text-gray-500 text-sm">Manage your subscription and usage.</p>
      </PageHeader>

      <Section title="Current Plan">
        {loading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : profile ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                profile.plan === "pro"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600"
              }`}>
                {profile.plan === "pro" ? "Pro Plan" : "Free Plan"}
              </span>
              <span className={`text-xs px-2 py-1 rounded-full ${
                profile.subscription_status === "active"
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}>
                {profile.subscription_status}
              </span>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-1">
                Exports used: {profile.exports_used} / {profile.export_limit}
              </p>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (profile.exports_used / profile.export_limit) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {profile.plan !== "pro" && (
              <Button onClick={() => window.location.href = "/dashboard/upgrade"}>
                Upgrade to Pro
              </Button>
            )}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">Could not load billing info.</p>
        )}
      </Section>
    </div>
  );
}