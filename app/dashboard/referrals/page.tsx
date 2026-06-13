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
  referred_phone: string | null;
  status: string;
  months_subscribed: number;
  free_months_earned: number;
  free_months_applied: boolean;
  notes: string | null;
  created_at: string;
};

type InternalReferral = {
  id: string;
  referral_type: string;
  referred_name: string;
  referred_email: string | null;
  referred_phone: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

type RewardCode = {
  id: string;
  code: string;
  free_months: number;
  status: string;
  redeemed_at: string | null;
  expires_at: string | null;
  created_at: string;
};

const REFERRAL_TIERS = [
  { months: 3, free: 1, label: "3 months", reward: "1 month free" },
  { months: 6, free: 2, label: "6 months", reward: "2 months free" },
  { months: 9, free: 3, label: "9 months", reward: "3 months free" },
  { months: 12, free: 4, label: "12 months", reward: "4 months free" },
];

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [internalReferrals, setInternalReferrals] = useState<InternalReferral[]>([]);
  const [rewardCodes, setRewardCodes] = useState<RewardCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [activeTab, setActiveTab] = useState<"external" | "internal" | "rewards">("external");
  const [copiedCode, setCopiedCode] = useState("");

  // External referral form
  const [clinicName, setClinicName] = useState("");
  const [contactName, setContactName] = useState("");
  const [refEmail, setRefEmail] = useState("");
  const [refPhone, setRefPhone] = useState("");
  const [refNotes, setRefNotes] = useState("");
  const [submitMethod, setSubmitMethod] = useState<"form" | "manual" | "both">("form");
  const [showExternalForm, setShowExternalForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Internal referral form
  const [internalType, setInternalType] = useState<"client" | "employee">("client");
  const [internalName, setInternalName] = useState("");
  const [internalEmail, setInternalEmail] = useState("");
  const [internalPhone, setInternalPhone] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [showInternalForm, setShowInternalForm] = useState(false);
  const [submittingInternal, setSubmittingInternal] = useState(false);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const cid = companyUser?.company_id ?? "";
    setCompanyId(cid);

    const [{ data: refData }, { data: intData }, { data: codeData }] = await Promise.all([
      supabase.from("referrals").select("*").eq("referrer_company_id", cid).order("created_at", { ascending: false }),
      supabase.from("internal_referrals").select("*").eq("company_id", cid).order("created_at", { ascending: false }),
      supabase.from("referral_reward_codes").select("*").eq("referrer_company_id", cid).order("created_at", { ascending: false }),
    ]);

    setReferrals(refData ?? []);
    setInternalReferrals(intData ?? []);
    setRewardCodes(codeData ?? []);
    setLoading(false);
  }

  async function handleExternalReferral() {
    if (!clinicName.trim()) return;
    setSubmitting(true);

    await supabase.from("referrals").insert({
      referrer_company_id: companyId,
      referrer_user_id: userId,
      referred_clinic_name: clinicName.trim(),
      referred_contact_name: contactName.trim() || null,
      referred_email: refEmail.trim() || null,
      referred_phone: refPhone.trim() || null,
      notes: refNotes.trim() || null,
      status: "pending",
    });

    await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: "hisully92@gmail.com",
        subject: `New Referral Submitted`,
        body: `
          <h2>New Referral</h2>
          <p><strong>Referred Clinic:</strong> ${clinicName}</p>
          <p><strong>Contact:</strong> ${contactName || "N/A"}</p>
          <p><strong>Email:</strong> ${refEmail || "N/A"}</p>
          <p><strong>Phone:</strong> ${refPhone || "N/A"}</p>
          <p><strong>Notes:</strong> ${refNotes || "N/A"}</p>
          <p><strong>Submit Method:</strong> ${submitMethod}</p>
        `,
      }),
    });

    setClinicName(""); setContactName(""); setRefEmail(""); setRefPhone(""); setRefNotes("");
    setShowExternalForm(false);
    await init();
    setSubmitting(false);
  }

  async function handleInternalReferral() {
    if (!internalName.trim()) return;
    setSubmittingInternal(true);

    await supabase.from("internal_referrals").insert({
      company_id: companyId,
      referrer_user_id: userId,
      referral_type: internalType,
      referred_name: internalName.trim(),
      referred_email: internalEmail.trim() || null,
      referred_phone: internalPhone.trim() || null,
      notes: internalNotes.trim() || null,
    });

    setInternalName(""); setInternalEmail(""); setInternalPhone(""); setInternalNotes("");
    setShowInternalForm(false);
    await init();
    setSubmittingInternal(false);
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(""), 2000);
  }

  const totalFreeMonths = rewardCodes.reduce((sum, c) => sum + c.free_months, 0);
  const redeemedMonths = rewardCodes.filter(c => c.status === "redeemed").reduce((sum, c) => sum + c.free_months, 0);
  const pendingMonths = rewardCodes.filter(c => c.status === "active").reduce((sum, c) => sum + c.free_months, 0);

  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    active: "bg-green-100 text-green-700",
    completed: "bg-blue-100 text-blue-700",
    cancelled: "bg-gray-100 text-gray-500",
  };

  const CODE_STATUS_COLORS: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    redeemed: "bg-blue-100 text-blue-700",
    expired: "bg-gray-100 text-gray-500",
  };

  if (loading) return <div className="p-8 text-gray-400">Loading referrals...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Referrals" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Referrals", value: referrals.length, color: "text-blue-600", icon: "🔗" },
          { label: "Free Months Earned", value: totalFreeMonths, color: "text-green-600", icon: "🎁" },
          { label: "Free Months Available", value: pendingMonths, color: "text-orange-500", icon: "⏳" },
        ].map(stat => (
          <div key={stat.label} className="border rounded-xl p-4 text-center bg-white">
            <div className="text-2xl mb-1">{stat.icon}</div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {[
          { key: "external", label: `External Referrals (${referrals.length})` },
          { key: "internal", label: `Internal Referrals (${internalReferrals.length})` },
          { key: "rewards", label: `Rewards (${rewardCodes.length})` },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "external" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowExternalForm(s => !s)}>
              {showExternalForm ? "✕ Cancel" : "+ Refer a Clinic"}
            </Button>
          </div>

          {showExternalForm && (
            <Section title="Refer a Clinic">
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                  🎁 Earn free months when the clinic you refer completes their full contract! 3mo=1mo free, 6mo=2mo free, 9mo=3mo free, 12mo=4mo free.
                  <br /><strong>Note:</strong> Reward codes are only issued after the referred clinic completes their full subscription.
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">How would you like to submit? *</label>
                  <div className="flex gap-2">
                    {[
                      { value: "form", label: "Submit form" },
                      { value: "manual", label: "Reach out myself" },
                      { value: "both", label: "Both" },
                    ].map(opt => (
                      <button key={opt.value} type="button" onClick={() => setSubmitMethod(opt.value as any)}
                        className={`flex-1 border rounded-lg p-2 text-xs font-medium transition-all ${submitMethod === opt.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-blue-300"}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <input type="text" value={clinicName} onChange={e => setClinicName(e.target.value)}
                  placeholder="Clinic name *"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="text" value={contactName} onChange={e => setContactName(e.target.value)}
                    placeholder="Contact name"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  <input type="email" value={refEmail} onChange={e => setRefEmail(e.target.value)}
                    placeholder="Contact email"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  <input type="tel" value={refPhone} onChange={e => setRefPhone(e.target.value)}
                    placeholder="Contact phone"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <textarea value={refNotes} onChange={e => setRefNotes(e.target.value)}
                  placeholder="Additional notes..."
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <Button onClick={handleExternalReferral} loading={submitting} disabled={!clinicName.trim()}>
                  Submit Referral
                </Button>
              </div>
            </Section>
          )}

          {referrals.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">🔗</p>
              <p className="text-sm">No referrals yet. Refer a clinic and earn free months!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {referrals.map(ref => (
                <div key={ref.id} className="border border-gray-100 rounded-xl p-4 bg-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-800">{ref.referred_clinic_name}</p>
                      {ref.referred_contact_name && <p className="text-xs text-gray-400 mt-0.5">{ref.referred_contact_name}</p>}
                      {ref.referred_email && <p className="text-xs text-gray-400">{ref.referred_email}</p>}
                      <p className="text-xs text-gray-400 mt-1">{new Date(ref.created_at).toLocaleDateString()}</p>
                      {ref.months_subscribed > 0 && (
                        <p className="text-xs text-blue-600 mt-1">{ref.months_subscribed} months completed</p>
                      )}
                    </div>
                    <div className="text-right space-y-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ref.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {ref.status}
                      </span>
                      {ref.free_months_earned > 0 && (
                        <p className="text-xs text-green-600 font-medium">🎁 {ref.free_months_earned} month{ref.free_months_earned > 1 ? "s" : ""} earned</p>
                      )}
                    </div>
                  </div>
                  {ref.notes && <p className="text-xs text-gray-500 mt-2 italic">{ref.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "internal" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowInternalForm(s => !s)}>
              {showInternalForm ? "✕ Cancel" : "+ Add Referral"}
            </Button>
          </div>

          {showInternalForm && (
            <Section title="Internal Referral">
              <div className="space-y-3">
                <div className="flex gap-2">
                  {[
                    { value: "client", label: "👤 Client Referral" },
                    { value: "employee", label: "👥 Employee Referral" },
                  ].map(opt => (
                    <button key={opt.value} type="button" onClick={() => setInternalType(opt.value as any)}
                      className={`flex-1 border rounded-lg p-2 text-xs font-medium transition-all ${internalType === opt.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-blue-300"}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <input type="text" value={internalName} onChange={e => setInternalName(e.target.value)}
                  placeholder={internalType === "client" ? "Client name *" : "Employee name *"}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="email" value={internalEmail} onChange={e => setInternalEmail(e.target.value)}
                    placeholder="Email (optional)"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  <input type="tel" value={internalPhone} onChange={e => setInternalPhone(e.target.value)}
                    placeholder="Phone (optional)"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)}
                  placeholder="Notes about this referral..."
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <Button onClick={handleInternalReferral} loading={submittingInternal} disabled={!internalName.trim()}>
                  Submit Referral
                </Button>
              </div>
            </Section>
          )}

          {internalReferrals.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">👥</p>
              <p className="text-sm">No internal referrals yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {internalReferrals.map(ref => (
                <div key={ref.id} className="border border-gray-100 rounded-xl p-4 bg-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-800">{ref.referred_name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${ref.referral_type === "client" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                          {ref.referral_type === "client" ? "👤 Client" : "👥 Employee"}
                        </span>
                      </div>
                      {ref.referred_email && <p className="text-xs text-gray-400 mt-0.5">{ref.referred_email}</p>}
                      {ref.referred_phone && <p className="text-xs text-gray-400">{ref.referred_phone}</p>}
                      {ref.notes && <p className="text-xs text-gray-500 mt-1 italic">{ref.notes}</p>}
                      <p className="text-xs text-gray-400 mt-1">{new Date(ref.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ref.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {ref.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "rewards" && (
        <div className="space-y-4">
          <Section title="How the Referral Program Works">
            <p className="text-sm text-gray-600 mb-4">
              When you refer a clinic and they complete their full contract, you earn free months.
              ABA AI will generate a reward code and email it to you. Enter the code in your billing settings
              to freeze your subscription for 1-4 months after your current contract ends.
            </p>
            <div className="space-y-2">
              {REFERRAL_TIERS.map(tier => (
                <div key={tier.months} className="flex items-center justify-between border border-gray-100 rounded-xl p-4 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-lg">🎁</div>
                    <div>
                      <p className="font-medium text-gray-800">Referred clinic completes {tier.label}</p>
                      <p className="text-xs text-gray-400">You earn: {tier.reward}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-green-600">+{tier.free} month{tier.free > 1 ? "s" : ""} free</span>
                </div>
              ))}
            </div>
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-700">
              ⚠️ Reward codes are only issued after the referred clinic completes their full contracted months. Early cancellations do not qualify.
            </div>
          </Section>

          <Section title="Your Reward Codes">
            {rewardCodes.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-3xl mb-2">🎟️</p>
                <p className="text-sm">No reward codes yet. Refer a clinic to get started!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rewardCodes.map(code => (
                  <div key={code.id} className={`border rounded-xl p-4 bg-white ${code.status === "redeemed" ? "border-blue-100" : code.status === "expired" ? "border-gray-100 opacity-60" : "border-green-200"}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-mono font-bold text-lg text-gray-800">{code.code}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CODE_STATUS_COLORS[code.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {code.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">🎁 {code.free_months} free month{code.free_months > 1 ? "s" : ""}</p>
                        {code.expires_at && (
                          <p className="text-xs text-gray-400 mt-0.5">Expires {new Date(code.expires_at).toLocaleDateString()}</p>
                        )}
                        {code.redeemed_at && (
                          <p className="text-xs text-blue-600 mt-0.5">✓ Redeemed {new Date(code.redeemed_at).toLocaleDateString()}</p>
                        )}
                      </div>
                      {code.status === "active" && (
                        <div className="flex flex-col gap-2 items-end">
                          <button onClick={() => copyCode(code.code)}
                            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                            {copiedCode === code.code ? "✓ Copied!" : "📋 Copy Code"}
                          </button>
                          <p className="text-xs text-blue-500">Go to Billing → Enter code to redeem</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pendingMonths > 0 && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-green-800">🎉 You have {pendingMonths} free month{pendingMonths > 1 ? "s" : ""} to redeem!</p>
                <p className="text-xs text-green-600 mt-1">Go to Settings → Plan & Billing → Enter your reward code to apply your free months.</p>
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}