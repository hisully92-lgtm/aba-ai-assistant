"use client";

import { useState } from "react";
import Link from "next/link";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    icon: "🌱",
    desc: "Perfect for solo practitioners just getting started",
    monthly: 129,
    tiers: [
      { label: "Monthly", months: 1, price: 129, savings: 0 },
      { label: "3 Months", months: 3, price: 122, savings: 21 },
      { label: "6 Months", months: 6, price: 116, savings: 78 },
      { label: "9 Months", months: 9, price: 110, savings: 171 },
      { label: "12 Months (Annual)", months: 12, price: 99, savings: 360 },
    ],
    features: [
      "1 clinician",
      "Up to 10 clients",
      "1 location",
      "Basic data collection",
      "Session notes",
      "Progress reports",
      "Email support",
      "HIPAA BAA included",
    ],
    highlight: false,
    cta: "Select Starter",
  },
  {
    id: "professional",
    name: "Professional",
    icon: "⚡",
    desc: "For growing practices with multiple clinicians",
    monthly: 249,
    tiers: [
      { label: "Monthly", months: 1, price: 249, savings: 0 },
      { label: "3 Months", months: 3, price: 236, savings: 39 },
      { label: "6 Months", months: 6, price: 224, savings: 150 },
      { label: "9 Months", months: 9, price: 212, savings: 333 },
      { label: "12 Months (Annual)", months: 12, price: 199, savings: 600 },
    ],
    features: [
      "Up to 5 clinicians",
      "Unlimited clients",
      "Up to 2 locations",
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
    id: "growth",
    name: "Growth",
    icon: "📈",
    desc: "For mid-size clinics with growing teams",
    monthly: 349,
    tiers: [
      { label: "Monthly", months: 1, price: 349, savings: 0 },
      { label: "3 Months", months: 3, price: 331, savings: 54 },
      { label: "6 Months", months: 6, price: 314, savings: 210 },
      { label: "9 Months", months: 9, price: 297, savings: 468 },
      { label: "12 Months (Annual)", months: 12, price: 279, savings: 840 },
    ],
    features: [
      "Up to 25 clinicians",
      "Unlimited clients",
      "Up to 5 locations",
      "Everything in Professional",
      "Advanced reporting",
      "Multi-location dashboard",
      "Team performance analytics",
      "Dedicated onboarding support",
    ],
    highlight: false,
    cta: "Select Growth",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    icon: "🏢",
    desc: "For large multi-location organizations",
    monthly: 499,
    tiers: [
      { label: "Monthly", months: 1, price: 499, savings: 0 },
      { label: "3 Months", months: 3, price: 474, savings: 75 },
      { label: "6 Months", months: 6, price: 449, savings: 300 },
      { label: "9 Months", months: 9, price: 424, savings: 675 },
      { label: "12 Months (Annual)", months: 12, price: 399, savings: 1200 },
    ],
    features: [
      "Up to 75 clinicians",
      "Unlimited clients",
      "Up to 15 locations",
      "Everything in Growth",
      "EDI 837 claim submission",
      "QuickBooks integration",
      "Custom branding",
      "Advanced analytics",
      "Dedicated account manager",
    ],
    highlight: false,
    cta: "Select Enterprise",
  },
  {
    id: "clinic",
    name: "Clinic",
    icon: "🏥",
    desc: "For established clinics needing unlimited everything",
    monthly: 599,
    tiers: [
      { label: "Monthly", months: 1, price: 599, savings: 0 },
      { label: "3 Months", months: 3, price: 569, savings: 90 },
      { label: "6 Months", months: 6, price: 539, savings: 360 },
      { label: "9 Months", months: 9, price: 509, savings: 810 },
      { label: "12 Months (Annual)", months: 12, price: 499, savings: 1200 },
    ],
    features: [
      "Unlimited clinicians",
      "Unlimited clients",
      "Unlimited locations",
      "Everything in Enterprise",
      "White-label options",
      "API access",
      "Developer dashboard access",
      "Full custom branding",
      "Priority dedicated support",
    ],
    highlight: false,
    cta: "Select Clinic",
  },
];

export default function PricingPage() {
  const [selectedTiers, setSelectedTiers] = useState<Record<string, number>>({
    starter: 0, professional: 0, growth: 0, enterprise: 0, clinic: 0,
  });

  function setTier(planId: string, tierIndex: number) {
    setSelectedTiers(prev => ({ ...prev, [planId]: tierIndex }));
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
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
            <Link href="/onboarding"
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Simple, honest pricing</h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Start with a 30-day free trial. No charge until your trial ends.
          </p>
          <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-full text-sm font-medium mt-4">
            🎉 First month free — card required but not charged until trial ends
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Extra locations beyond your plan limit: <strong>+$29/mo per location</strong>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {PLANS.map(plan => {
            const tierIndex = selectedTiers[plan.id] ?? 0;
            const tier = plan.tiers[tierIndex];
            return (
              <div key={plan.id} className={`relative rounded-2xl border-2 p-6 flex flex-col ${
                plan.highlight ? "border-blue-500 shadow-xl shadow-blue-100" : "border-gray-200"
              }`}>
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full whitespace-nowrap">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-3xl mb-3">{plan.icon}</div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">{plan.name}</h2>
                <p className="text-xs text-gray-500 mb-4">{plan.desc}</p>

                <div className="mb-4">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                    Contract Length
                  </label>
                  <select
                    value={tierIndex}
                    onChange={e => setTier(plan.id, parseInt(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300">
                    {plan.tiers.map((t, i) => (
                      <option key={i} value={i}>
                        {t.label} — ${t.price}/mo{t.savings > 0 ? ` (Save $${t.savings})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-6">
                  <span className="text-3xl font-extrabold text-blue-600">${tier.price}</span>
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
                    <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                      <span className="text-blue-500 shrink-0 mt-0.5">✓</span> {f}
                    </li>
                  ))}
                </ul>

                <Link href={`/onboarding?plan=${plan.id}&months=${tier.months}`}
                  className={`block text-center py-2.5 rounded-xl font-semibold text-sm transition-colors ${
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

        {/* COMPARISON TABLE */}
        <div className="mt-20 overflow-x-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Plan Comparison</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Feature</th>
                {PLANS.map(p => (
                  <th key={p.id} className="text-center py-3 px-4 font-bold text-gray-800">{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Clinicians", values: ["1", "Up to 5", "Up to 25", "Up to 75", "Unlimited"] },
                { label: "Clients", values: ["Up to 10", "Unlimited", "Unlimited", "Unlimited", "Unlimited"] },
                { label: "Locations", values: ["1", "2", "5", "15", "Unlimited"] },
                { label: "Session Notes", values: ["✓", "✓", "✓", "✓", "✓"] },
                { label: "AI Features", values: ["—", "✓", "✓", "✓", "✓"] },
                { label: "Insurance Billing", values: ["—", "✓", "✓", "✓", "✓"] },
                { label: "EDI 837 Claims", values: ["—", "—", "—", "✓", "✓"] },
                { label: "Custom Branding", values: ["—", "—", "—", "✓", "✓"] },
                { label: "White-Label", values: ["—", "—", "—", "—", "✓"] },
                { label: "API Access", values: ["—", "—", "—", "—", "✓"] },
                { label: "Monthly Price", values: ["$129", "$249", "$349", "$499", "$599"] },
                { label: "Annual Price", values: ["$99/mo", "$199/mo", "$279/mo", "$399/mo", "$499/mo"] },
              ].map((row, i) => (
                <tr key={row.label} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                  <td className="py-3 px-4 text-gray-600 font-medium">{row.label}</td>
                  {row.values.map((v, j) => (
                    <td key={j} className={`py-3 px-4 text-center ${v === "—" ? "text-gray-300" : "text-gray-800"}`}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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
              { q: "What if I need more locations than my plan allows?", a: "You can add extra locations for $29/mo per location beyond your plan limit, or upgrade to a higher plan." },
              { q: "Are there setup fees?", a: "No setup fees. Sign up and be running in minutes." },
              { q: "Do you offer nonprofit discounts?", a: "Yes — contact us for nonprofit pricing options." },
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
