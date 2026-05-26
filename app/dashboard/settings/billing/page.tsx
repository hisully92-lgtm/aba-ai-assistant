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

const PLANS = [
  {
    name: "Starter",
    type: "starter",
    monthlyPrice: 49,
    features: ["1 clinician", "Up to 10 clients", "Basic data collection", "Session notes", "Progress reports"],
  },
  {
    name: "Professional",
    type: "professional",
    monthlyPrice: 99,
    features: ["Up to 5 clinicians", "Unlimited clients", "All data collection tools", "AI features", "Billing & insurance", "SAFMEDS", "Parent portal"],
    popular: true,
  },
  {
    name: "Clinic",
    type: "clinic",
    monthlyPrice: 199,
    features: ["Unlimited clinicians", "Unlimited clients", "Everything in Professional", "Custom branding", "Priority support", "API access", "Multi-location"],
  },
];

const CONTRACT_OPTIONS = [
  { months: 1, label: "Monthly", discount: 0 },
  { months: 3, label: "3 Months", discount: 5 },
  { months: 6, label: "6 Months", discount: 10 },
  { months: 9, label: "9 Months", discount: 15 },
  { months: 12, label: "12 Months (Annual)", discount: 20 },
];

const PAYMENT_METHODS = ["Credit Card", "ACH / Bank Transfer", "Check", "Invoice"];

export default function BillingPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"plans" | "contracts" | "history">("plans");

  // Plan selection
  const [selectedPlan, setSelectedPlan] = useState("professional");
  const [selectedMonths, setSelectedMonths] = useState(1);
  const [autoRenew, setAutoRenew] = useState(true);
  const [reminderDays, setReminderDays] = useState(30);
  const [paymentMethod, setPaymentMethod] = useState("Credit Card");
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => { init(); }, []);

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

  function calculatePrice(planType: string, months: number) {
    const plan = PLANS.find((p) => p.type === planType);
    if (!plan) return { monthly: 0, total: 0, discount: 0, savings: 0 };
    const contractOption = CONTRACT_OPTIONS.find((c) => c.months === months);
    const discount = contractOption?.discount ?? 0;
    const monthly = plan.monthlyPrice * (1 - discount / 100);
    const total = monthly * months;
    const savings = plan.monthlyPrice * months - total;
    return { monthly, total, discount, savings };
  }

  async function handleSubscribe() {
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const plan = PLANS.find((p) => p.type === selectedPlan)!;
    const { monthly, total, discount } = calculatePrice(selectedPlan, selectedMonths);

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + selectedMonths);

    const { data, error } = await supabase.from("subscription_contracts").insert([{
      user_id: user.id,
      plan_name: plan.name,
      plan_type: selectedPlan,
      contract_length_months: selectedMonths,
      price_per_month: monthly,
      total_price: total,
      discount_percent: discount,
      start_date: startDate.toISOString().split("T")[0],
      end_date: endDate.toISOString().split("T")[0],
      auto_renew: autoRenew,
      renewal_reminder_days: reminderDays,
      status: "active",
      payment_method: paymentMethod,
    }]).select().single();

    if (!error && data) {
      setContracts((prev) => [data, ...prev]);
      setShowCheckout(false);
      setSuccess(true);
      setActiveTab("contracts");
      setTimeout(() => setSuccess(false), 4000);
    }
    setSaving(false);
  }

  async function toggleAutoRenew(contractId: string, current: boolean) {
    await supabase.from("subscription_contracts").update({ auto_renew: !current }).eq("id", contractId);
    setContracts((prev) => prev.map((c) => c.id === contractId ? { ...c, auto_renew: !current } : c));
  }

  async function cancelContract(contractId: string) {
    await supabase.from("subscription_contracts").update({ status: "cancelled" }).eq("id", contractId);
    setContracts((prev) => prev.map((c) => c.id === contractId ? { ...c, status: "cancelled" } : c));
  }

  function daysUntilRenewal(endDate: string) {
    return Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  const activeContract = contracts.find((c) => c.status === "active");
  const pricing = calculatePrice(selectedPlan, selectedMonths);

  return (
    <div className="space-y-6">
      <PageHeader title="Plan & Billing" />

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
          ✅ Subscription activated! A confirmation email will be sent with your contract details.
        </div>
      )}

      {/* ACTIVE CONTRACT BANNER */}
      {activeContract && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex justify-between items-start flex-wrap gap-3">
            <div>
              <p className="font-bold text-blue-800">
                {activeContract.plan_name} Plan — {activeContract.contract_length_months === 1 ? "Monthly" : `${activeContract.contract_length_months}-Month Contract`}
              </p>
              <p className="text-sm text-blue-600 mt-1">
                ${activeContract.price_per_month.toFixed(2)}/mo · Renews {activeContract.end_date}
                {activeContract.auto_renew ? " · Auto-renew ON" : " · Auto-renew OFF"}
              </p>
              {daysUntilRenewal(activeContract.end_date) <= activeContract.renewal_reminder_days && (
                <p className="text-xs text-orange-600 mt-1 font-medium">
                  ⚠️ Renews in {daysUntilRenewal(activeContract.end_date)} days
                </p>
              )}
            </div>
            <span className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">Active</span>
          </div>
        </div>
      )}

      {/* TABS */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { key: "plans", label: "Plans & Pricing" },
          { key: "contracts", label: "My Contracts" },
          { key: "history", label: "Billing History" },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* PLANS TAB */}
      {activeTab === "plans" && (
        <div className="space-y-6">
          {/* PLAN CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map((plan) => (
              <div key={plan.type}
                onClick={() => { setSelectedPlan(plan.type); setShowCheckout(true); }}
                className={`border-2 rounded-xl p-5 cursor-pointer transition-all relative ${selectedPlan === plan.type ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300 bg-white"}`}>
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-medium">
                    Most Popular
                  </span>
                )}
                <p className="font-bold text-gray-800 text-lg">{plan.name}</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">
                  ${plan.monthlyPrice}
                  <span className="text-sm font-normal text-gray-500">/mo</span>
                </p>
                <ul className="mt-4 space-y-1.5">
                  {plan.features.map((f) => (
                    <li key={f} className="text-xs text-gray-600 flex items-center gap-2">
                      <span className="text-green-500 font-bold">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button className={`w-full mt-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedPlan === plan.type ? "bg-blue-600 text-white" : "border border-blue-300 text-blue-600 hover:bg-blue-50"}`}>
                  {selectedPlan === plan.type ? "Selected" : "Select Plan"}
                </button>
              </div>
            ))}
          </div>

          {/* CONTRACT LENGTH */}
          <Section title="Contract Length & Savings">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {CONTRACT_OPTIONS.map((option) => {
                const p = calculatePrice(selectedPlan, option.months);
                return (
                  <button key={option.months} onClick={() => setSelectedMonths(option.months)}
                    className={`border-2 rounded-xl p-3 text-center transition-all ${selectedMonths === option.months ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}>
                    <p className="text-sm font-bold text-gray-800">{option.label}</p>
                    <p className="text-lg font-bold text-blue-600 mt-1">${p.monthly.toFixed(0)}<span className="text-xs text-gray-400">/mo</span></p>
                    {option.discount > 0 ? (
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                        Save {option.discount}%
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">No contract</span>
                    )}
                    {p.savings > 0 && (
                      <p className="text-xs text-green-600 mt-1">Save ${p.savings.toFixed(0)}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* CHECKOUT */}
          {showCheckout && (
            <Section title="Complete Your Subscription">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ORDER SUMMARY */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <p className="font-semibold text-gray-700">Order Summary</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Plan</span>
                      <span className="font-medium">{PLANS.find((p) => p.type === selectedPlan)?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Contract</span>
                      <span className="font-medium">{CONTRACT_OPTIONS.find((c) => c.months === selectedMonths)?.label}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Monthly Rate</span>
                      <span className="font-medium">${pricing.monthly.toFixed(2)}/mo</span>
                    </div>
                    {pricing.discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount</span>
                        <span>-{pricing.discount}% (Save ${pricing.savings.toFixed(2)})</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-base">
                      <span>Total Due</span>
                      <span className="text-blue-600">${pricing.total.toFixed(2)}</span>
                    </div>
                    {selectedMonths > 1 && (
                      <p className="text-xs text-gray-400">
                        Billed as ${pricing.total.toFixed(2)} for {selectedMonths} months
                      </p>
                    )}
                  </div>
                </div>

                {/* OPTIONS */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Payment Method</label>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                      {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
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
                        <p className="text-sm font-medium text-gray-700">
                          {autoRenew ? "Auto-renew enabled" : "Auto-renew disabled"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {autoRenew ? "Your plan will renew automatically" : "You will be notified before expiry"}
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Email reminder {reminderDays} days before renewal
                      </label>
                      <input type="range" min={7} max={90} step={7} value={reminderDays}
                        onChange={(e) => setReminderDays(parseInt(e.target.value))}
                        className="w-full" />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>7 days</span>
                        <span>30 days</span>
                        <span>90 days</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
                    📧 A renewal reminder email will be sent {reminderDays} days before your contract ends to {autoRenew ? "confirm auto-renewal" : "prompt manual renewal"}.
                  </div>

                  <Button onClick={handleSubscribe} loading={saving} className="w-full">
                    Subscribe — ${pricing.total.toFixed(2)} {selectedMonths > 1 ? `for ${selectedMonths} months` : "/month"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowCheckout(false)} className="w-full">
                    Cancel
                  </Button>
                </div>
              </div>
            </Section>
          )}
        </div>
      )}

      {/* CONTRACTS TAB */}
      {activeTab === "contracts" && (
        <div className="space-y-4">
          {loading && <p className="text-gray-400 text-sm">Loading...</p>}
          {!loading && contracts.length === 0 && (
            <Section title="No Active Contracts">
              <p className="text-gray-400 text-sm">No subscriptions yet.</p>
              <Button onClick={() => setActiveTab("plans")} className="mt-3">View Plans</Button>
            </Section>
          )}
          {contracts.map((contract) => {
            const days = daysUntilRenewal(contract.end_date);
            const isExpiringSoon = days <= contract.renewal_reminder_days && days > 0;
            return (
              <div key={contract.id} className={`border rounded-xl p-5 bg-white ${contract.status === "cancelled" ? "border-gray-200 opacity-60" : isExpiringSoon ? "border-orange-200" : "border-gray-100"}`}>
                <div className="flex justify-between items-start flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-800">{contract.plan_name} Plan</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${contract.status === "active" ? "bg-green-100 text-green-700" : contract.status === "cancelled" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                        {contract.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {contract.contract_length_months === 1 ? "Monthly" : `${contract.contract_length_months}-Month Contract`} ·
                      ${contract.price_per_month.toFixed(2)}/mo · ${contract.total_price.toFixed(2)} total
                    </p>
                    {contract.discount_percent > 0 && (
                      <p className="text-xs text-green-600 mt-0.5">
                        {contract.discount_percent}% contract discount applied
                      </p>
                    )}
                    <div className="flex gap-4 mt-2 text-xs text-gray-400">
                      <span>Start: {contract.start_date}</span>
                      <span>End: {contract.end_date}</span>
                      <span>Payment: {contract.payment_method}</span>
                    </div>
                    {isExpiringSoon && (
                      <p className="text-xs text-orange-600 font-medium mt-1">
                        ⚠️ Renews in {days} days — reminder set for {contract.renewal_reminder_days} days before
                      </p>
                    )}
                    {days < 0 && contract.status === "active" && (
                      <p className="text-xs text-red-600 font-medium mt-1">⚠️ Contract expired {Math.abs(days)} days ago</p>
                    )}
                  </div>

                  {contract.status === "active" && (
                    <div className="flex flex-col gap-2 items-end">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Auto-renew</span>
                        <button onClick={() => toggleAutoRenew(contract.id, contract.auto_renew)}
                          className={`w-10 h-5 rounded-full transition-all relative ${contract.auto_renew ? "bg-blue-500" : "bg-gray-300"}`}>
                          <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${contract.auto_renew ? "left-6" : "left-1"}`} />
                        </button>
                      </div>
                      <button onClick={() => cancelContract(contract.id)}
                        className="text-xs text-red-400 hover:text-red-600">
                        Cancel Contract
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {!loading && (
            <Button variant="outline" onClick={() => setActiveTab("plans")}>
              + New Subscription
            </Button>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === "history" && (
        <Section title="Billing History">
          {contracts.length === 0 ? (
            <p className="text-gray-400 text-sm">No billing history yet.</p>
          ) : (
            <div className="space-y-2">
              {contracts.map((contract) => (
                <div key={contract.id} className="flex justify-between items-center border border-gray-100 rounded-lg p-3 bg-white text-sm">
                  <div>
                    <p className="font-medium text-gray-800">{contract.plan_name} — {contract.contract_length_months === 1 ? "Monthly" : `${contract.contract_length_months}-Month`}</p>
                    <p className="text-xs text-gray-400">{contract.start_date} → {contract.end_date} · {contract.payment_method}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-800">${contract.total_price.toFixed(2)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${contract.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {contract.status}
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