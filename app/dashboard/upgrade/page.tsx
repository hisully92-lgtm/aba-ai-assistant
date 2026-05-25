"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { usePlan } from "@/lib/billing/usePlan";

type PricingPlan = {
  id: string;
  name: string;
  price: number;
  pricePerSeat: number;
  includedSeats: number;
  trialDays: number;
  highlighted: boolean;
  features: string[];
};

const PRICING_PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 0,
    pricePerSeat: 0,
    includedSeats: 1,
    trialDays: 0,
    highlighted: false,
    features: [
      "1 user seat",
      "Up to 5 clients",
      "Session notes",
      "Behavior logging",
      "Basic reports",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    pricePerSeat: 20,
    includedSeats: 5,
    trialDays: 14,
    highlighted: true,
    features: [
      "5 user seats included",
      "$20/month per additional seat",
      "Unlimited clients",
      "AI session notes",
      "AI clinical summaries",
      "Insurance billing",
      "SAFMEDS study tool",
      "Parent portal",
      "Advanced analytics",
      "Export approvals",
      "14-day free trial",
    ],
  },
  {
    id: "clinic",
    name: "Clinic",
    price: 149,
    pricePerSeat: 15,
    includedSeats: 15,
    trialDays: 30,
    highlighted: false,
    features: [
      "15 user seats included",
      "$15/month per additional seat",
      "Everything in Pro",
      "Multi-location support",
      "Compliance exports",
      "Churn risk dashboard",
      "Priority support",
      "Custom onboarding",
      "30-day free trial",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 0,
    pricePerSeat: 10,
    includedSeats: 999,
    trialDays: 30,
    highlighted: false,
    features: [
      "Unlimited seats",
      "$10/month per seat",
      "Everything in Clinic",
      "Custom integrations",
      "Dedicated support",
      "SLA guarantee",
      "Custom contracts",
      "30-day free trial",
    ],
  },
];

const FAQ = [
  { q: "What counts as a seat?", a: "Each active team member (BCBA, RBT, admin, etc.) needs one seat." },
  { q: "Can I change plans?", a: "Yes, upgrade or downgrade anytime. Changes take effect immediately." },
  { q: "What happens after my trial?", a: "You'll be prompted to add payment. Your data is preserved either way." },
  { q: "Is there a contract?", a: "No long-term contracts. Cancel anytime." },
  { q: "Is billing secure?", a: "Yes. Payments are processed securely through Square." },
];

export default function UpgradePage() {
  const { plan } = usePlan();
  const [seats, setSeats] = useState(5);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [trialStarted, setTrialStarted] = useState(false);
  const [trialPlan, setTrialPlan] = useState<string | null>(null);

  async function handleUpgrade(planId: string) {
    if (planId === "enterprise") {
      window.location.href = "mailto:sales@abaai.app?subject=Enterprise Plan Inquiry";
      return;
    }

    setLoading(true);
    setSelectedPlan(planId);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId, seats }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data?.error ?? "Checkout failed");
      if (data?.url) { window.location.href = data.url; return; }

      throw new Error("No checkout URL returned");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setSelectedPlan(null);
    }
  }

  async function handleStartTrial(planId: string, trialDays: number) {
    setLoading(true);
    setSelectedPlan(planId);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) { setLoading(false); return; }

    const trialEnd = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();

    await supabase.from("profiles").update({
      plan: planId,
      subscription_status: "trial",
    } as any).eq("id", user.id);

    setTrialStarted(true);
    setTrialPlan(planId);
    setLoading(false);
    setSelectedPlan(null);
  }

  function calcTotal(p: PricingPlan) {
    if (p.id === "starter" || p.id === "enterprise") return p.price;
    const extra = Math.max(0, seats - p.includedSeats);
    return p.price + extra * p.pricePerSeat;
  }

  if (trialStarted) {
    return (
      <div className="space-y-6">
        <PageHeader title="Trial Started!" />
        <Section title="You're all set">
          <div className="text-center py-8 space-y-4">
            <p className="text-5xl">🎉</p>
            <p className="text-xl font-bold text-gray-800">
              {trialPlan?.charAt(0).toUpperCase()}{trialPlan?.slice(1)} trial activated!
            </p>
            <p className="text-gray-500">Enjoy full access. No credit card required until your trial ends.</p>
            <Button onClick={() => window.location.href = "/dashboard"}>
              Go to Dashboard →
            </Button>
          </div>
        </Section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Upgrade Your Plan">
        <p className="text-gray-500 text-sm">Choose the plan that fits your clinic.</p>
      </PageHeader>

      {/* SEAT CALCULATOR */}
      <Section title="Estimate Your Team Size">
        <div className="flex items-center gap-4 max-w-lg">
          <input
            type="range"
            min={1}
            max={50}
            value={seats}
            onChange={(e) => setSeats(parseInt(e.target.value))}
            className="flex-1"
          />
          <span className="text-lg font-bold text-blue-600 w-20 text-center">
            {seats} seat{seats !== 1 ? "s" : ""}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Drag to see pricing for your team size
        </p>
      </Section>

      {/* PRICING CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {PRICING_PLANS.map((p) => {
          const total = calcTotal(p);
          const isCurrent = plan === p.id;
          const extraSeats = Math.max(0, seats - p.includedSeats);

          return (
            <div
              key={p.id}
              className={`border rounded-2xl p-6 flex flex-col relative ${
                p.highlighted
                  ? "border-blue-500 bg-blue-50 shadow-lg"
                  : "border-gray-200 bg-white"
              }`}
            >
              {p.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 bg-blue-600 text-white rounded-full">
                  Most Popular
                </span>
              )}

              <div className="mb-4">
                {p.trialDays > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                    {p.trialDays}-day free trial
                  </span>
                )}
                <h3 className="text-lg font-bold text-gray-800 mt-2">{p.name}</h3>

                {p.id === "starter" ? (
                  <p className="text-3xl font-bold text-gray-700 mt-1">Free</p>
                ) : p.id === "enterprise" ? (
                  <p className="text-3xl font-bold text-gray-700 mt-1">Custom</p>
                ) : (
                  <div className="mt-1">
                    <p className="text-3xl font-bold text-gray-800">
                      ${total}
                      <span className="text-sm font-normal text-gray-400">/mo</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {p.includedSeats} seats included
                    </p>
                    {extraSeats > 0 && (
                      <p className="text-xs text-blue-600 mt-0.5">
                        +{extraSeats} extra × ${p.pricePerSeat} = +${extraSeats * p.pricePerSeat}/mo
                      </p>
                    )}
                  </div>
                )}
              </div>

              <ul className="space-y-1.5 flex-1 mb-6">
                {p.features.map((f) => (
                  <li key={f} className="text-xs text-gray-600 flex items-start gap-1.5">
                    <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="text-center py-2 text-sm font-medium text-green-600 border border-green-200 rounded-lg bg-green-50">
                  ✓ Current Plan
                </div>
              ) : (
                <div className="space-y-2">
                  {p.trialDays > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => handleStartTrial(p.id, p.trialDays)}
                      loading={loading && selectedPlan === p.id}
                    >
                      Start {p.trialDays}-Day Free Trial
                    </Button>
                  )}
                  <Button
                    variant={p.highlighted ? "secondary" : "outline"}
                    onClick={() => handleUpgrade(p.id)}
                    loading={loading && selectedPlan === p.id}
                  >
                    {p.id === "enterprise"
                      ? "Contact Sales"
                      : p.id === "starter"
                      ? "Downgrade"
                      : "Upgrade Now"}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <Section title="Frequently Asked Questions">
        <div className="space-y-3">
          {FAQ.map((item) => (
            <div key={item.q} className="border border-gray-100 rounded-lg p-4 bg-white">
              <p className="font-medium text-gray-800 text-sm">{item.q}</p>
              <p className="text-gray-500 text-sm mt-1">{item.a}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}