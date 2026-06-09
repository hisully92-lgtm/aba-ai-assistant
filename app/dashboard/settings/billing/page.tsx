"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Contract = {
  id: string;
  plan_name: string;
  plan_type: string;
  contract_length_months: number;
  price_per_month: number;
  total_price: number;
  discount_percent: number;
  start_date: string;
  end_date: string;
  auto_renew: boolean;
  renewal_reminder_days: number;
  status: string;
  payment_method: string;
  created_at: string;
};

const CONTRACT_OPTIONS = [
  { months: 1, label: "Monthly" },
  { months: 3, label: "3 Months" },
  { months: 6, label: "6 Months" },
  { months: 9, label: "9 Months" },
  { months: 12, label: "12 Months (Annual)" },
];

const PLANS = [
  {
    name: "Starter",
    type: "starter",
    icon: "🌱",
    description: "Perfect for solo practitioners just getting started",
    pricing: { 1: 59, 3: 56, 6: 53, 9: 51, 12: 49 },
    features: [
      "1 clinician",
      "Up to 10 clients",
      "Basic data collection",
      "Session notes",
      "Progress reports",
      "Email support",
    ],
  },
  {
    name: "Professional",
    type: "professional",
    icon: "⚡",
    description: "For growing practices with multiple clinicians",
    popular: true,
    pricing: { 1: 119, 3: 113, 6: 107, 9: 103, 12: 99 },
    features: [
      "Up to 5 clinicians",
      "Unlimited clients",
      "All data collection tools",
      "AI session notes + treatment plans",
      "Insurance billing + authorizations",
      "SAFMEDS + student hub",
      "Parent portal",
      "Visual analytics + graphs",
      "Priority support",
    ],
  },
  {
    name: "Clinic",
    type: "clinic",
    icon: "🏥",
    description: "For established clinics and multi-location practices",
    pricing: { 1: 239, 3: 227, 6: 215, 9: 207, 12: 199 },
    features: [
      "Unlimited clinicians",
      "Unlimited clients",
      "Everything in Professional",
      "Developer dashboard access",
      "Custom branding",
      "Multi-location support",
      "QuickBooks integration",
      "EDI 837 claim submission",
      "Dedicated account manager",
      "API access",
      "White-label options",
    ],
  },
];

const PAYMENT_METHODS = ["Credit Card", "ACH / Bank Transfer", "Check", "Invoice"];

export default function BillingPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlMessage, setUrlMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"plans" | "contracts" | "history">("plans");

  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedMonths, setSelectedMonths] = useState<Record<string, number>>({
    starter: 1, professional: 1, clinic: 1,
  });
  const [autoRenew, setAutoRenew] = useState(true);
  const [reminderDays, setReminderDays] = useState(30);
  const [paymentMethod, setPaymentMethod] = useState("Credit Card");
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    void init();
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      setUrlMessage("Payment successful! Your subscription is now active.");
      setActiveTab("contracts");
    }
    if (params.get("expired") === "true") {
      setUrlMessage("Your trial or subscription has expired. Please renew to continue.");
      setActiveTab("plans");
    }
  }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const { data } = await supabase
      .from("subscription_contracts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setContracts(data ?? []);
    setLoading(false);
  }

  function getPrice(planType: string, months: number): number {
    const plan = PLANS.find(p => p.type === planType);
    if (!plan) return 0;
    return plan.pricing[months as keyof typeof plan.pricing] ?? plan.pricing[1];
  }

  function getSavings(planType: string, months: number): number {
    const monthly = getPrice(planType, 1);
    const discounted = getPrice(planType, months);
    return (monthly - discounted) * months;
  }

  async function handleSubscribe() {
    if (!selectedPlan) return;
    setSaving(true);
    setError(null);

    const months = selectedMonths[selectedPlan];

    // First subscription — free trial, no payment needed
    if (isFirstSubscription) {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) { setSaving(false); return; }

      const plan = PLANS.find(p => p.type === selectedPlan)!;
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + months + 1);

      const { data } = await supabase.from("subscription_contracts").insert([{
        user_id: user.id,
        plan_name: plan.name,
        plan_type: selectedPlan,
        contract_length_months: months,
        price_per_month: 0,
        total_price: 0,
        discount_percent: 0,
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        auto_renew: autoRenew,
        renewal_reminder_days: reminderDays,
        status: "trial",
        payment_method: paymentMethod,
      }]).select().single();

      if (data) {
        setContracts(prev => [data, ...prev]);
        setShowCheckout(false);
        setSuccess(true);
        setActiveTab("contracts");
        setTimeout(() => setSuccess(false), 5000);
      }
      setSaving(false);
      return;
    }

    // Paid subscription — redirect to Square
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ plan: selectedPlan, months }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        setError(data.error ?? "Failed to create checkout. Please try again.");
        setSaving(false);
        return;
      }

      window.location.href = data.url;

    } catch {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  async function toggleAutoRenew(contractId: string, current: boolean) {
    await supabase.from("subscription_contracts").update({ auto_renew: !current }).eq("id", contractId);
    setContracts(prev => prev.map(c => c.id === contractId ? { ...c, auto_renew: !current } : c));
  }

  async function cancelContract(contractId: string) {
    await supabase.from("subscription_contracts").update({ status: "cancelled" }).eq("id", contractId);
    setContracts(prev => prev.map(c => c.id === contractId ? { ...c, status: "cancelled" } : c));
  }

  function daysUntilRenewal(endDate: string) {
    return Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  const activeContract = contracts.find(c => c.status === "active" || c.status === "trial");
  const isFirstSubscription = contracts.length === 0;

  function statusColor(status: string) {
    if (status === "active") return "bg-green-100 text-green-700";
    if (status === "trial") return "bg-blue-100 text-blue-700";
    if (status === "cancelled") return "bg-red-100 text-red-700";
    if (status === "expired") return "bg-orange-100 text-orange-700";
    return "bg-gray-100 text-gray-500";
  }

  const currentPlan = selectedPlan ? PLANS.find(p => p.type === selectedPlan) : null;
  const currentMonths = selectedPlan ? selectedMonths[selectedPlan] : 1;
  const currentMonthly = selectedPlan ? getPrice(selectedPlan, currentMonths) : 0;
  const currentTotal = currentMonthly * currentMonths;
  const currentSavings = selectedPlan ? getSavings(selectedPlan, currentMonths) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Plan & Billing" />

      {/* URL message — expired or success */}
      {urlMessage && (
        <div className={`rounded-xl p-4 text-sm border ${urlMessage.includes("expired") ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"}`}>
          {urlMessage}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
          Your first month is free! You will be charged starting next month.
        </div>
      )}

      {activeContract && (
        <div className={`border rounded-xl p-4 ${activeContract.status === "trial" ? "bg-blue-50 border-blue-200" : "bg-green-50 border-green-200"}`}>
          <div className="flex justify-between items-start flex-wrap gap-3">
            <div>
              <p className="font-bold text-gray-800">
                {activeContract.plan_name} Plan —{" "}
                {activeContract.contract_length_months === 1 ? "Monthly" : `${activeContract.contract_length_months}-Month Contract`}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {activeContract.status === "trial"
                  ? `Free trial ends ${activeContract.end_date}`
                  : `$${activeContract.price_per_month.toFixed(2)}/mo · Renews ${activeContract.end_date}`}
                {activeContract.auto_renew ? " · Auto-renew ON" : " · Auto-renew OFF"}
              </p>
              {daysUntilRenewal(activeContract.end_date) <= 30 && daysUntilRenewal(activeContract.end_date) > 0 && (
                <p className="text-xs text-orange-600 mt-1 font-medium">
                  {activeContract.status === "trial" ? "Trial ends" : "Renews"} in {daysUntilRenewal(activeContract.end_date)} days
                </p>
              )}
            </div>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColor(activeContract.status)}`}>
              {activeContract.status === "trial" ? "Free Trial" : "Active"}
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-200">
        {[
          { key: "plans", label: "Plans & Pricing" },
          { key: "contracts", label: "My Contracts" },
          { key: "history", label: "Billing History" },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "plans" && (
        <div className="space-y-6">

          {!activeContract && (
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white text-center">
              <p className="text-2xl font-black mb-1">First Month Free</p>
              <p className="text-sm opacity-90 mb-3">Try any plan free for 30 days. No credit card required to start.</p>
              <div className="flex justify-center gap-6 text-sm flex-wrap">
                <span>✓ Full access</span>
                <span>✓ Cancel anytime</span>
                <span>✓ No hidden fees</span>
              </div>
            </div>
          )}

          {activeContract?.status === "trial" && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
              <strong>Your free trial ends {activeContract.end_date}.</strong> Select a plan below to continue uninterrupted access after your trial.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map(plan => {
              const months = selectedMonths[plan.type];
              const monthly = getPrice(plan.type, months);
              const savings = getSavings(plan.type, months);
              const isSelected = selectedPlan === plan.type;

              return (
                <div key={plan.type}
                  className={`border-2 rounded-2xl p-6 transition-all relative flex flex-col ${isSelected ? "border-blue-500 bg-blue-50 shadow-md" : "border-gray-200 bg-white"}`}>
                  {plan.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-4 py-1 rounded-full font-bold">
                      Most Popular
                    </span>
                  )}

                  <p className="text-2xl mb-2">{plan.icon}</p>
                  <p className="font-bold text-gray-800 text-xl">{plan.name}</p>
                  <p className="text-xs text-gray-500 mt-1 mb-4">{plan.description}</p>

                  <div className="mb-3">
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Contract Length</label>
                    <select
                      value={months}
                      onChange={e => setSelectedMonths(prev => ({ ...prev, [plan.type]: parseInt(e.target.value) }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
                      {CONTRACT_OPTIONS.map(opt => {
                        const p = getPrice(plan.type, opt.months);
                        const s = getSavings(plan.type, opt.months);
                        return (
                          <option key={opt.months} value={opt.months}>
                            {opt.label} — ${p}/mo{s > 0 ? ` (Save $${s})` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {isFirstSubscription ? (
                    <div className="mb-1">
                      <p className="text-3xl font-bold text-green-600">Free</p>
                      <p className="text-xs text-gray-500 mt-0.5">First month, then ${monthly}/mo</p>
                    </div>
                  ) : (
                    <div className="mb-1">
                      <p className="text-3xl font-bold text-blue-600">
                        ${monthly}<span className="text-sm font-normal text-gray-500">/mo</span>
                      </p>
                      {savings > 0 && (
                        <p className="text-xs text-green-600 font-medium mt-0.5">Save ${savings} over {months} months</p>
                      )}
                      {months === 12 && (
                        <p className="text-xs text-blue-600 font-medium mt-0.5">Best value</p>
                      )}
                    </div>
                  )}

                  <ul className="mt-3 space-y-2 flex-1">
                    {plan.features.map(f => (
                      <li key={f} className="text-xs text-gray-600 flex items-start gap-2">
                        <span className="text-green-500 font-bold mt-0.5 shrink-0">✓</span> {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => { setSelectedPlan(plan.type); setShowCheckout(true); }}
                    className={`w-full mt-5 py-2.5 rounded-xl text-sm font-bold transition-colors ${isSelected && showCheckout ? "bg-blue-600 text-white" : "border-2 border-blue-300 text-blue-600 hover:bg-blue-50"}`}>
                    {isSelected && showCheckout ? "Selected ✓" : `Select ${plan.name}`}
                  </button>
                </div>
              );
            })}
          </div>

          {showCheckout && currentPlan && (
            <Section title="Complete Your Subscription">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-xl p-5 space-y-3">
                  <p className="font-bold text-gray-700">Order Summary</p>
                  {isFirstSubscription && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 font-medium">
                      ✓ First month free applied automatically
                    </div>
                  )}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Plan</span>
                      <span className="font-medium">{currentPlan.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Contract</span>
                      <span className="font-medium">{CONTRACT_OPTIONS.find(c => c.months === currentMonths)?.label}</span>
                    </div>
                    {isFirstSubscription ? (
                      <>
                        <div className="flex justify-between text-green-600 font-medium">
                          <span>First Month</span>
                          <span>FREE</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">After trial</span>
                          <span className="font-medium">${currentMonthly}/mo</span>
                        </div>
                        <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-base">
                          <span>Due Today</span>
                          <span className="text-green-600">$0.00</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Monthly Rate</span>
                          <span className="font-medium">${currentMonthly}/mo</span>
                        </div>
                        {currentSavings > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>Contract Savings</span>
                            <span>Save ${currentSavings}</span>
                          </div>
                        )}
                        <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-base">
                          <span>Total Due</span>
                          <span className="text-blue-600">${currentTotal}</span>
                        </div>
                        {currentMonths > 1 && (
                          <p className="text-xs text-gray-400">Billed as ${currentTotal} for {currentMonths} months</p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Payment Method</label>
                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  <div className="border border-gray-100 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-700">Auto-Renewal Settings</p>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setAutoRenew(!autoRenew)}
                        className={`w-12 h-6 rounded-full transition-all relative ${autoRenew ? "bg-blue-500" : "bg-gray-300"}`}>
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${autoRenew ? "left-7" : "left-1"}`} />
                      </button>
                      <div>
                        <p className="text-sm font-medium text-gray-700">{autoRenew ? "Auto-renew enabled" : "Auto-renew disabled"}</p>
                        <p className="text-xs text-gray-400">{autoRenew ? "Plan renews automatically" : "You will be notified before expiry"}</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Email reminder {reminderDays} days before renewal
                      </label>
                      <input type="range" min={7} max={90} step={7} value={reminderDays}
                        onChange={e => setReminderDays(parseInt(e.target.value))}
                        className="w-full" />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>7 days</span><span>30 days</span><span>90 days</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
                    Renewal reminder email will be sent {reminderDays} days before your contract ends.
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <Button onClick={handleSubscribe} loading={saving} className="w-full">
                    {isFirstSubscription
                      ? "Start Free Trial →"
                      : `Pay with Square — $${currentTotal} ${currentMonths > 1 ? `for ${currentMonths} months` : "/month"}`}
                  </Button>
                  <Button variant="outline" onClick={() => { setShowCheckout(false); setError(null); }} className="w-full">
                    Cancel
                  </Button>
                </div>
              </div>
            </Section>
          )}
        </div>
      )}

      {activeTab === "contracts" && (
        <div className="space-y-4">
          {loading && <p className="text-gray-400 text-sm">Loading...</p>}
          {!loading && contracts.length === 0 && (
            <Section title="No Active Contracts">
              <p className="text-gray-400 text-sm">No subscriptions yet.</p>
              <Button onClick={() => setActiveTab("plans")} className="mt-3">View Plans</Button>
            </Section>
          )}
          {contracts.map(contract => {
            const days = daysUntilRenewal(contract.end_date);
            const isExpiringSoon = days <= contract.renewal_reminder_days && days > 0;
            return (
              <div key={contract.id} className={`border rounded-xl p-5 bg-white ${contract.status === "cancelled" ? "border-gray-200 opacity-60" : isExpiringSoon ? "border-orange-200" : "border-gray-100"}`}>
                <div className="flex justify-between items-start flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-800">{contract.plan_name} Plan</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(contract.status)}`}>
                        {contract.status === "trial" ? "Free Trial" : contract.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {contract.contract_length_months === 1 ? "Monthly" : `${contract.contract_length_months}-Month Contract`} ·
                      {contract.status === "trial" ? " Free trial" : ` $${contract.price_per_month.toFixed(2)}/mo`}
                    </p>
                    <div className="flex gap-3 mt-1 text-xs text-gray-400">
                      <span>{contract.start_date} → {contract.end_date}</span>
                      <span>{contract.payment_method}</span>
                    </div>
                    {isExpiringSoon && (
                      <p className="text-xs text-orange-600 font-medium mt-1">
                        {contract.status === "trial" ? "Trial ends" : "Renews"} in {days} days
                      </p>
                    )}
                  </div>
                  {(contract.status === "active" || contract.status === "trial") && (
                    <div className="flex flex-col gap-2 items-end">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Auto-renew</span>
                        <button onClick={() => toggleAutoRenew(contract.id, contract.auto_renew)}
                          className={`w-10 h-5 rounded-full transition-all relative ${contract.auto_renew ? "bg-blue-500" : "bg-gray-300"}`}>
                          <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${contract.auto_renew ? "left-6" : "left-1"}`} />
                        </button>
                      </div>
                      <button onClick={() => cancelContract(contract.id)} className="text-xs text-red-400 hover:text-red-600">
                        Cancel Contract
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {!loading && (
            <Button variant="outline" onClick={() => setActiveTab("plans")}>+ New Subscription</Button>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <Section title="Billing History">
          {contracts.length === 0 ? (
            <p className="text-gray-400 text-sm">No billing history yet.</p>
          ) : (
            <div className="space-y-2">
              {contracts.map(contract => (
                <div key={contract.id} className="flex justify-between items-center border border-gray-100 rounded-lg p-3 bg-white text-sm">
                  <div>
                    <p className="font-medium text-gray-800">
                      {contract.plan_name} — {contract.contract_length_months === 1 ? "Monthly" : `${contract.contract_length_months}-Month`}
                    </p>
                    <p className="text-xs text-gray-400">{contract.start_date} → {contract.end_date} · {contract.payment_method}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-800">${contract.total_price.toFixed(2)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(contract.status)}`}>
                      {contract.status === "trial" ? "Free Trial" : contract.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}