"use client";

import { useState } from "react";
import Link from "next/link";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    icon: "🌱",
    desc: "Perfect for solo practitioners just getting started",
    monthly: 59,
    tiers: [
      { label: "Monthly", months: 1, price: 59, savings: 0 },
      { label: "3 Months", months: 3, price: 56, savings: 9 },
      { label: "6 Months", months: 6, price: 53, savings: 36 },
      { label: "9 Months", months: 9, price: 51, savings: 72 },
      { label: "12 Months (Annual)", months: 12, price: 49, savings: 120 },
    ],
    features: [
      "1 clinician",
      "Up to 10 clients",
      "Basic data collection",
      "Session notes",
      "Progress reports",
      "Email support",
    ],
    highlight: false,
    cta: "Select Starter",
  },
  {
    id: "professional",
    name: "Professional",
    icon: "⚡",
    desc: "For growing practices with multiple clinicians",
    monthly: 119,
    tiers: [
      { label: "Monthly", months: 1, price: 119, savings: 0 },
      { label: "3 Months", months: 3, price: 113, savings: 18 },
      { label: "6 Months", months: 6, price: 107, savings: 72 },
      { label: "9 Months", months: 9, price: 103, savings: 144 },
      { label: "12 Months (Annual)", months: 12, price: 99, savings: 240 },
    ],
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
    highlight: true,
    cta: "Select Professional",
  },
  {
    id: "clinic",
    name: "Clinic",
    icon: "🏥",
    desc: "For established clinics and multi-location practices",
    monthly: 239,
    tiers: [
      { label: "Monthly", months: 1, price: 239, savings: 0 },
      { label: "3 Months", months: 3, price: 227, savings: 36 },
      { label: "6 Months", months: 6, price: 215, savings: 144 },
      { label: "9 Months", months: 9, price: 207, savings: 288 },
      { label: "12 Months (Annual)", months: 12, price: 199, savings: 480 },
    ],
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
    highlight: false,
    cta: "Select Clinic",
  },
];

export default function PricingPage() {
  const [selectedTiers, setSelectedTiers] = useState<Record<string, number>>({
    starter: 0,
    professional: 0,
    clinic: 0,
  });

  function setTier(planId: string, tierIndex: number) {
    setSelectedTiers(prev => ({ ...prev, [planId]: tierIndex }));
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-bold text-gray-900 text-lg">ABA AI</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/about" className="text-sm text-gray-500 hover:text-gray-800 hidden sm:block">About</Link>
            <Link href="/contact" className="text-sm text-gray-500 hover:text-gray-800 hidden sm:block">Contact</Link>
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-800 font-medium">Sign In</Link>
            <Link href="/login?signup=true"
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Simple, honest pricing</h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Start with a 30-day free trial. No charge until your trial ends.
          </p>
          <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-full text-sm font-medium mt-4">
            🎉 First month free — card required but not charged until trial ends
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {PLANS.map(plan => {
            const tierIndex = selectedTiers[plan.id] ?? 0;
            const tier = plan.tiers[tierIndex];
            return (
              <div key={plan.id} className={`relative rounded-2xl border-2 p-8 flex flex-col ${
                plan.highlight ? "border-blue-500 shadow-xl shadow-blue-100" : "border-gray-200"
              }`}>
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-3xl mb-3">{plan.icon}</div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h2>
                <p className="text-sm text-gray-500 mb-4">{plan.desc}</p>

                <div className="mb-4">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                    Contract Length
                  </label>
                  <select
                    value={tierIndex}
                    onChange={e => setTier(plan.id, parseInt(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    {plan.tiers.map((t, i) => (
                      <option key={i} value={i}>
                        {t.label} — ${t.price}/mo{t.savings > 0 ? ` (Save $${t.savings})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-blue-600">${tier.price}</span>
                  <span className="text-gray-400 text-sm">/mo</span>
                  {tier.savings > 0 && (
                    <p className="text-xs text-green-600 font-medium mt-1">
                      💰 Save ${tier.savings} total vs monthly
                    </p>
                  )}
                  {tier.months > 1 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Billed as ${tier.price * tier.months} every {tier.months} months
                    </p>
                  )}
                </div>

                <ul className="space-y-2 mb-8 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-blue-500 shrink-0">✓</span> {f}
                    </li>
                  ))}
                </ul>

                <Link href={`/login?signup=true&plan=${plan.id}&months=${tier.months}`}
                  className={`block text-center py-3 rounded-xl font-semibold text-sm transition-colors ${
                    plan.highlight
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
                  }`}>
                  {plan.cta}
                </Link>
              </div>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="mt-20 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              { q: "Is there a free trial?", a: "Yes — every plan starts with a 30-day free trial. Your card is required but not charged until the trial ends." },
              { q: "Can I change my plan later?", a: "Yes, you can upgrade or downgrade at any time from your billing settings." },
              { q: "What happens if I cancel?", a: "You can cancel anytime. Your data remains accessible until the end of your billing period." },
              { q: "Do you offer a BAA for HIPAA compliance?", a: "Yes — a Business Associate Agreement (BAA) is included with all plans." },
              { q: "Are there setup fees?", a: "No setup fees. Sign up and be running in minutes." },
              { q: "What payment methods do you accept?", a: "We accept all major credit cards through our secure payment processor." },
            ].map(faq => (
              <div key={faq.q} className="border border-gray-100 rounded-xl p-5">
                <p className="font-semibold text-gray-800 mb-1">{faq.q}</p>
                <p className="text-sm text-gray-500">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 text-center bg-blue-50 border border-blue-100 rounded-2xl p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-2">Not sure which plan is right for you?</h3>
          <p className="text-gray-500 text-sm mb-4">Contact us and we&apos;ll help you find the best fit.</p>
          <Link href="/contact"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors">
            Talk to Us →
          </Link>
        </div>
      </div>

      <footer className="border-t border-gray-100 px-6 py-8 text-center text-xs text-gray-400">
        <div className="flex flex-wrap justify-center gap-4 mb-2">
          <Link href="/" className="hover:text-gray-600">Home</Link>
          <Link href="/about" className="hover:text-gray-600">About</Link>
          <Link href="/contact" className="hover:text-gray-600">Contact</Link>
          <Link href="/privacy" className="hover:text-gray-600">Privacy</Link>
          <Link href="/hipaa" className="hover:text-gray-600">HIPAA</Link>
        </div>
        <p>© {new Date().getFullYear()} ABA AI Assistant. All rights reserved.</p>
      </footer>
    </div>
  );
}