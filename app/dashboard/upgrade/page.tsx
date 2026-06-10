"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "$0",
    period: "free forever",
    color: "border-gray-200",
    badge: "",
    features: [
      "Up to 5 clients",
      "Session notes",
      "Behavior logging",
      "Basic reports",
      "1 user",
    ],
    cta: "Current Plan",
    disabled: true,
  },
  {
    id: "professional",
    name: "Professional",
    price: "$49",
    period: "per month",
    color: "border-blue-500",
    badge: "Most Popular",
    features: [
      "Unlimited clients",
      "AI session notes",
      "AI progress reports",
      "Insurance & billing tools",
      "BIP builder",
      "Parent portal",
      "Up to 10 staff",
      "Priority support",
      "30-day free trial",
    ],
    cta: "Start Free Trial",
    disabled: false,
  },
  {
    id: "clinic",
    name: "Clinic",
    price: "$149",
    period: "per month",
    color: "border-purple-400",
    badge: "Best for Groups",
    features: [
      "Everything in Professional",
      "Unlimited staff",
      "Multiple locations",
      "Advanced analytics",
      "Training library",
      "Competency tracking",
      "Custom onboarding",
      "Dedicated support",
      "30-day free trial",
    ],
    cta: "Start Free Trial",
    disabled: false,
  },
];

const FAQS = [
  { q: "Is there a free trial?", a: "Yes — Professional and Clinic plans include a 30-day free trial. No credit card required to start." },
  { q: "Can I cancel anytime?", a: "Yes. No long-term contracts. Cancel anytime from your billing settings." },
  { q: "Is ABA AI HIPAA compliant?", a: "Yes. All data is encrypted, access is role-based, and a Business Associate Agreement (BAA) is signed during onboarding." },
  { q: "What happens to my data if I cancel?", a: "Your data is retained for 7 years per HIPAA requirements. You can export all data before canceling." },
  { q: "Do you offer discounts for nonprofits?", a: "Yes — contact hello@aba-ai-assistant.com for nonprofit and multi-clinic pricing." },
];

export default function UpgradePage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  async function handleUpgrade(planId: string) {
    setLoading(planId);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) { window.location.href = "/login"; return; }
    window.location.href = `/dashboard/settings/billing?plan=${planId}`;
  }

  return (
    <div className="space-y-10 max-w-5xl mx-auto">
      <div className="text-center">
        <PageHeader title="Choose Your Plan" />
        <p className="text-gray-500 mt-2">Start free. Scale as your clinic grows. Cancel anytime.</p>
      </div>

      {/* PLANS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => (
          <div key={plan.id} className={`relative border-2 rounded-2xl p-6 bg-white flex flex-col ${plan.color}`}>
            {plan.badge && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full bg-blue-600 text-white whitespace-nowrap">
                {plan.badge}
              </span>
            )}
            <div className="mb-4">
              <p className="text-lg font-bold text-gray-800">{plan.name}</p>
              <div className="flex items-end gap-1 mt-1">
                <p className="text-3xl font-black text-gray-900">{plan.price}</p>
                <p className="text-sm text-gray-400 mb-1">/{plan.period}</p>
              </div>
            </div>

            <ul className="space-y-2 flex-1 mb-6">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-green-500 shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              type="button"
              disabled={plan.disabled || loading === plan.id}
              onClick={() => !plan.disabled && handleUpgrade(plan.id)}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                plan.disabled
                  ? "bg-gray-100 text-gray-400 cursor-default"
                  : plan.id === "professional"
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-purple-600 text-white hover:bg-purple-700"
              }`}>
              {loading === plan.id ? "Loading..." : plan.cta}
            </button>
          </div>
        ))}
      </div>

      {/* FEATURE COMPARISON */}
      <Section title="What's Included">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 text-gray-600 font-medium w-1/2">Feature</th>
                <th className="text-center py-3 text-gray-600 font-medium">Starter</th>
                <th className="text-center py-3 text-blue-600 font-semibold">Professional</th>
                <th className="text-center py-3 text-purple-600 font-semibold">Clinic</th>
              </tr>
            </thead>
            <tbody>
              {[
                { feature: "Clients", starter: "5", pro: "Unlimited", clinic: "Unlimited" },
                { feature: "Staff Users", starter: "1", pro: "10", clinic: "Unlimited" },
                { feature: "Session Notes", starter: "✓", pro: "✓", clinic: "✓" },
                { feature: "AI Session Notes", starter: "—", pro: "✓", clinic: "✓" },
                { feature: "BIP Builder", starter: "—", pro: "✓", clinic: "✓" },
                { feature: "Progress Reports", starter: "—", pro: "✓", clinic: "✓" },
                { feature: "AI Progress Reports", starter: "—", pro: "✓", clinic: "✓" },
                { feature: "Insurance & Billing", starter: "—", pro: "✓", clinic: "✓" },
                { feature: "Parent Portal", starter: "—", pro: "✓", clinic: "✓" },
                { feature: "Multiple Locations", starter: "—", pro: "—", clinic: "✓" },
                { feature: "Training Library", starter: "—", pro: "—", clinic: "✓" },
                { feature: "Advanced Analytics", starter: "—", pro: "—", clinic: "✓" },
                { feature: "HIPAA BAA", starter: "✓", pro: "✓", clinic: "✓" },
              ].map((row) => (
                <tr key={row.feature} className="border-b border-gray-100">
                  <td className="py-3 text-gray-700">{row.feature}</td>
                  <td className="py-3 text-center text-gray-500">{row.starter}</td>
                  <td className="py-3 text-center text-blue-600 font-medium">{row.pro}</td>
                  <td className="py-3 text-center text-purple-600 font-medium">{row.clinic}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* FAQ */}
      <Section title="Frequently Asked Questions">
        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex justify-between items-center p-4 text-left hover:bg-gray-50 transition-colors">
                <p className="text-sm font-medium text-gray-800">{faq.q}</p>
                <span className="text-gray-400 shrink-0 ml-2">{openFaq === i ? "▲" : "▼"}</span>
              </button>
              {openFaq === i && (
                <div className="px-4 pb-4">
                  <p className="text-sm text-gray-600">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* CONTACT */}
      <div className="text-center border border-gray-100 rounded-2xl p-8 bg-gray-50">
        <p className="text-lg font-bold text-gray-800 mb-2">Need a custom plan?</p>
        <p className="text-sm text-gray-500 mb-4">Multi-clinic groups, nonprofits, and school districts get custom pricing.</p>
        <a href="mailto:hello@aba-ai-assistant.com"
          className="inline-block px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors">
          Contact Us
        </a>
      </div>
    </div>
  );
}