"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";

type Referral = {
  id: string;
  referred_clinic_name: string;
  referred_contact_name: string | null;
  referred_email: string | null;
  months_subscribed: number;
  free_months_earned: number;
  status: string;
  referrer_company_id: string;
  referrer_company_name?: string;
  created_at: string;
};

type RewardCode = {
  id: string;
  code: string;
  referral_id: string;
  referrer_company_id: string;
  referrer_company_name?: string;
  free_months: number;
  status: string;
  redeemed_at: string | null;
  expires_at: string | null;
  created_at: string;
};

const REFERRAL_TIERS = [
  { months: 3, free: 1 },
  { months: 6, free: 2 },
  { months: 9, free: 3 },
  { months: 12, free: 4 },
];

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `REF-${rand(4)}-${rand(4)}-${new Date().getFullYear()}`;
}

export default function ReferralCodesAdminPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [codes, setCodes] = useState<RewardCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState("");
  const [userId, setUserId] = useState("");
  const [copiedCode, setCopiedCode] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "codes">("pending");

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const [{ data: refData }, { data: codeData }] = await Promise.all([
      supabase.from("referrals").select("*").order("created_at", { ascending: false }),
      supabase.from("referral_reward_codes").select("*").order("created_at", { ascending: false }),
    ]);

    // Get company names
    const companyIds = [...new Set([
      ...(refData ?? []).map((r: Referral) => r.referrer_company_id),
      ...(codeData ?? []).map((c: RewardCode) => c.referrer_company_id),
    ].filter(Boolean))];

    let companyNames: Record<string, string> = {};
    if (companyIds.length > 0) {
      const { data: companies } = await supabase.from("companies").select("id, name").in("id", companyIds);
      companyNames = Object.fromEntries((companies ?? []).map((c: any) => [c.id, c.name]));
    }

    setReferrals((refData ?? []).map((r: Referral) => ({
      ...r,
      referrer_company_name: companyNames[r.referrer_company_id],
    })));
    setCodes((codeData ?? []).map((c: RewardCode) => ({
      ...c,
      referrer_company_name: companyNames[c.referrer_company_id],
    })));
    setLoading(false);
  }

  async function generateRewardCode(referral: Referral) {
    setGenerating(referral.id);

    const freeMonths = REFERRAL_TIERS.find(t => t.months === referral.months_subscribed)?.free
      ?? Math.min(4, Math.floor(referral.months_subscribed / 3));

    if (freeMonths === 0) {
      alert("This referral hasn't reached a reward tier yet.");
      setGenerating("");
      return;
    }

    const code = generateCode();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 3);

    const { data } = await supabase.from("referral_reward_codes").insert({
      code,
      referral_id: referral.id,
      referrer_company_id: referral.referrer_company_id,
      free_months: freeMonths,
      status: "active",
      created_by: userId,
      expires_at: expiryDate.toISOString(),
    }).select().single();

    // Update referral status to reward_issued
    await supabase.from("referrals").update({
      status: "completed",
      free_months_earned: freeMonths,
    }).eq("id", referral.id);

    // Email the clinic admin
    if (referral.referred_email) {
      await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: referral.referred_email,
          subject: "🎁 Your Referral Reward Code — ABA AI Assistant",
          body: `
            <h2>Congratulations! You earned a referral reward!</h2>
            <p>Thank you for referring <strong>${referral.referred_clinic_name}</strong> to ABA AI Assistant. 
            They have completed their subscription and you have earned <strong>${freeMonths} free month${freeMonths > 1 ? "s" : ""}</strong>!</p>
            <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <p style="font-size: 12px; color: #166534; margin-bottom: 8px;">YOUR REWARD CODE</p>
              <p style="font-size: 28px; font-weight: bold; font-family: monospace; color: #15803d; letter-spacing: 4px;">${code}</p>
              <p style="font-size: 12px; color: #166534; margin-top: 8px;">Valid for ${freeMonths} free month${freeMonths > 1 ? "s" : ""} · Expires ${expiryDate.toLocaleDateString()}</p>
            </div>
            <p>To redeem your free months:</p>
            <ol>
              <li>Go to your Dashboard → Settings → Plan & Billing</li>
              <li>Enter your reward code in the "Referral Reward Code" field</li>
              <li>Your subscription will be frozen for ${freeMonths} month${freeMonths > 1 ? "s" : ""} after your current contract ends</li>
            </ol>
            <p style="color: #6b7280; font-size: 12px;">Code expires in 90 days. Free months are applied after your current contract ends and before your next billing period begins.</p>
          `,
        }),
      });
    }

    await init();
    setGenerating("");
    alert(`Code generated: ${code}\nFree months: ${freeMonths}\nEmail sent to: ${referral.referred_email || "N/A (no email on file)"}`);
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(""), 2000);
  }

  async function revokeCode(id: string) {
    await supabase.from("referral_reward_codes").update({ status: "expired" }).eq("id", id);
    await init();
  }

  const pendingReferrals = referrals.filter(r => r.status === "active" && r.months_subscribed >= 3);
  const completedReferrals = referrals.filter(r => r.status === "completed");

  const STATUS_COLORS: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    redeemed: "bg-blue-100 text-blue-700",
    expired: "bg-gray-100 text-gray-500",
    pending: "bg-yellow-100 text-yellow-700",
    completed: "bg-purple-100 text-purple-700",
  };

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Referral Reward Codes">
        <p className="text-sm text-gray-500">Generate and manage referral reward codes for clinics</p>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Referrals", value: referrals.length, color: "text-blue-600", icon: "🔗" },
          { label: "Eligible for Reward", value: pendingReferrals.length, color: "text-orange-500", icon: "⏳" },
          { label: "Codes Generated", value: codes.length, color: "text-purple-600", icon: "🎟️" },
          { label: "Codes Redeemed", value: codes.filter(c => c.status === "redeemed").length, color: "text-green-600", icon: "✅" },
        ].map(stat => (
          <div key={stat.label} className="border rounded-xl p-4 text-center bg-white">
            <div className="text-xl mb-1">{stat.icon}</div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {[
          { key: "pending", label: `Eligible Referrals (${pendingReferrals.length})` },
          { key: "codes", label: `All Codes (${codes.length})` },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "pending" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            📋 These referrals have completed enough months to earn a reward. Generate a code and it will be emailed to the referring clinic automatically.
          </div>

          {pendingReferrals.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">🔗</p>
              <p className="text-sm">No referrals eligible for rewards yet.</p>
              <p className="text-xs mt-1">Referrals become eligible after the referred clinic completes 3+ months.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingReferrals.map(ref => {
                const freeMonths = REFERRAL_TIERS.find(t => t.months === ref.months_subscribed)?.free
                  ?? Math.min(4, Math.floor(ref.months_subscribed / 3));
                const existingCode = codes.find(c => c.referral_id === ref.id && c.status === "active");

                return (
                  <div key={ref.id} className="border border-gray-100 rounded-2xl p-5 bg-white">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-800">{ref.referrer_company_name ?? "Unknown Clinic"}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Referred: <strong>{ref.referred_clinic_name}</strong></p>
                        <p className="text-xs text-gray-400">{ref.referred_email ?? "No email on file"}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                            {ref.months_subscribed} months completed
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                            🎁 {freeMonths} month{freeMonths > 1 ? "s" : ""} free earned
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        {existingCode ? (
                          <div className="text-right">
                            <p className="text-xs text-gray-400 mb-1">Code already generated:</p>
                            <p className="font-mono text-sm font-bold text-green-600">{existingCode.code}</p>
                            <button onClick={() => copyCode(existingCode.code)}
                              className="text-xs text-blue-500 hover:underline mt-1">
                              {copiedCode === existingCode.code ? "✓ Copied!" : "Copy"}
                            </button>
                          </div>
                        ) : (
                          <Button
                            onClick={() => generateRewardCode(ref)}
                            loading={generating === ref.id}>
                            🎟️ Generate Code
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {completedReferrals.length > 0 && (
            <Section title="Already Rewarded">
              <div className="space-y-2">
                {completedReferrals.map(ref => (
                  <div key={ref.id} className="border border-gray-100 rounded-xl p-3 bg-white flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{ref.referrer_company_name}</p>
                      <p className="text-xs text-gray-400">Referred: {ref.referred_clinic_name} · {ref.months_subscribed} months</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                      {ref.free_months_earned} months rewarded
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {activeTab === "codes" && (
        <div className="space-y-3">
          {codes.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">🎟️</p>
              <p className="text-sm">No codes generated yet.</p>
            </div>
          ) : (
            codes.map(code => (
              <div key={code.id} className={`border rounded-2xl p-5 bg-white ${code.status === "redeemed" ? "border-blue-100" : code.status === "expired" ? "border-gray-100 opacity-60" : "border-green-100"}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-mono font-bold text-lg text-gray-800">{code.code}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[code.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {code.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{code.referrer_company_name ?? "Unknown Clinic"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      🎁 {code.free_months} month{code.free_months > 1 ? "s" : ""} free ·
                      Created {new Date(code.created_at).toLocaleDateString()} ·
                      {code.expires_at ? ` Expires ${new Date(code.expires_at).toLocaleDateString()}` : " No expiry"}
                    </p>
                    {code.redeemed_at && (
                      <p className="text-xs text-blue-600 mt-0.5">✓ Redeemed {new Date(code.redeemed_at).toLocaleDateString()}</p>
                    )}
                  </div>
                  {code.status === "active" && (
                    <div className="flex gap-2">
                      <button onClick={() => copyCode(code.code)}
                        className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                        {copiedCode === code.code ? "✓ Copied!" : "📋 Copy"}
                      </button>
                      <button onClick={() => revokeCode(code.id)}
                        className="text-xs px-3 py-1.5 border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors">
                        Revoke
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}