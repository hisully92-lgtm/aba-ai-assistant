"use client";

import { useState } from "react";
import Link from "next/link";
import PublicNav from "@/components/layout/PublicNav";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    icon: "1",
    desc: "For small ABA teams of 2 or more getting started — purchased by your organization",
    monthly: 129,
    tiers: [
      { label: "Monthly", months: 1, price: 199, savings: 0 },
      { label: "3 Months", months: 3, price: 189, savings: 30 },
      { label: "6 Months", months: 6, price: 179, savings: 120 },
      { label: "9 Months", months: 9, price: 169, savings: 270 },
      { label: "12 Months (Annual)", months: 12, price: 159, savings: 480 },
    ],
    features: ["Up to 2 clinicians", "Up to 10 clients", "1 location", "Basic data collection", "Session notes", "Progress reports", "Email support", "HIPAA BAA included"],
    highlight: false,
    cta: "Select Starter",
  },
  {
    id: "basic",
    name: "Basic",
    icon: "2",
    desc: "For small practices with a growing client base",
    monthly: 199,
    tiers: [
      { label: "Monthly", months: 1, price: 299, savings: 0 },
      { label: "3 Months", months: 3, price: 284, savings: 45 },
      { label: "6 Months", months: 6, price: 269, savings: 180 },
      { label: "9 Months", months: 9, price: 254, savings: 405 },
      { label: "12 Months (Annual)", months: 12, price: 239, savings: 720 },
    ],
    features: ["Up to 3 clinicians", "Up to 25 clients", "1 location", "All data collection tools", "AI session notes", "Parent portal", "Priority support", "HIPAA BAA included"],
    highlight: false,
    cta: "Select Basic",
  },
  {
    id: "professional",
    name: "Professional",
    icon: "3",
    desc: "For growing practices with multiple clinicians",
    monthly: 249,
    tiers: [
      { label: "Monthly", months: 1, price: 449, savings: 0 },
      { label: "3 Months", months: 3, price: 427, savings: 66 },
      { label: "6 Months", months: 6, price: 404, savings: 270 },
      { label: "9 Months", months: 9, price: 382, savings: 603 },
      { label: "12 Months (Annual)", months: 12, price: 359, savings: 1080 },
    ],
    features: ["Up to 5 clinicians", "Unlimited clients", "Up to 2 locations", "All data collection tools", "AI session notes + treatment plans", "Insurance billing + authorizations", "SAFMEDS + student hub", "Parent portal", "Visual analytics + graphs", "Priority support"],
    highlight: true,
    cta: "Select Professional",
  },
  {
    id: "growth",
    name: "Growth",
    icon: "4",
    desc: "For mid-size clinics with growing teams",
    monthly: 349,
    tiers: [
      { label: "Monthly", months: 1, price: 649, savings: 0 },
      { label: "3 Months", months: 3, price: 617, savings: 96 },
      { label: "6 Months", months: 6, price: 584, savings: 390 },
      { label: "9 Months", months: 9, price: 552, savings: 873 },
      { label: "12 Months (Annual)", months: 12, price: 519, savings: 1560 },
    ],
    features: ["Up to 25 clinicians", "Unlimited clients", "Up to 5 locations", "Everything in Professional", "Advanced reporting", "Multi-location dashboard", "Team performance analytics", "Dedicated onboarding support"],
    highlight: false,
    cta: "Select Growth",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    icon: "5",
    desc: "For large multi-location organizations",
    monthly: 499,
    tiers: [
      { label: "Monthly", months: 1, price: 849, savings: 0 },
      { label: "3 Months", months: 3, price: 807, savings: 126 },
      { label: "6 Months", months: 6, price: 764, savings: 510 },
      { label: "9 Months", months: 9, price: 722, savings: 1143 },
      { label: "12 Months (Annual)", months: 12, price: 679, savings: 2040 },
    ],
    features: ["Up to 75 clinicians", "Unlimited clients", "Up to 15 locations", "Everything in Growth", "EDI 837 claim submission", "QuickBooks integration", "Custom branding", "Advanced analytics", "Dedicated account manager"],
    highlight: false,
    cta: "Select Enterprise",
  },
  {
    id: "clinic",
    name: "Clinic",
    icon: "6",
    desc: "For established clinics needing unlimited everything",
    monthly: 599,
    tiers: [
      { label: "Monthly", months: 1, price: 1099, savings: 0 },
      { label: "3 Months", months: 3, price: 1044, savings: 165 },
      { label: "6 Months", months: 6, price: 989, savings: 660 },
      { label: "9 Months", months: 9, price: 934, savings: 1485 },
      { label: "12 Months (Annual)", months: 12, price: 879, savings: 2640 },
    ],
    features: ["Unlimited clinicians", "Unlimited clients", "Unlimited locations", "Everything in Enterprise", "White-label options", "API access", "Developer dashboard access", "Full custom branding", "Priority dedicated support"],
    highlight: false,
    cta: "Select Clinic",
  },
];

export default function PricingPage() {
  const [selectedTiers, setSelectedTiers] = useState<Record<string, number>>({
    starter: 0, basic: 0, professional: 0, growth: 0, enterprise: 0, clinic: 0,
  });

  function setTier(planId: string, tierIndex: number) {
    setSelectedTiers(prev => ({ ...prev, [planId]: tierIndex }));
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      <PublicNav />

      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Simple, honest pricing</h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">Contracts of 3 months or longer include a free first month. No charge until your trial ends.</p>
          <p className="text-xs text-gray-400 mt-3">Extra locations beyond your plan limit: <strong>+$49/mo per location</strong></p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
          {PLANS.map(plan => {
            const tierIndex = selectedTiers[plan.id] ?? 0;
            const tier = plan.tiers[tierIndex];
            return (
              <div key={plan.id} className={"relative rounded-2xl border-2 p-6 flex flex-col " + (plan.highlight ? "border-blue-500 shadow-xl shadow-blue-100" : "border-gray-200")}>
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full whitespace-nowrap">Most Popular</span>
                  </div>
                )}
                <h2 className="text-lg font-bold text-gray-900 mb-1">{plan.name}</h2>
                <p className="text-xs text-gray-500 mb-4">{plan.desc}</p>
                <div className="mb-4">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Contract Length</label>
                  <select value={tierIndex} onChange={e => setTier(plan.id, parseInt(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300">
                    {plan.tiers.map((t, i) => (
                      <option key={i} value={i}>{t.label} - ${t.price}/mo{t.savings > 0 ? " (Save $" + t.savings + ")" : ""}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-6">
                  <span className="text-3xl font-extrabold text-blue-600">${tier.price}</span>
                  <span className="text-gray-400 text-sm">/mo</span>
                  {tier.savings > 0 && <p className="text-xs text-green-600 font-medium mt-1">Save ${tier.savings} total vs monthly</p>}
                  {tier.months > 1 && <p className="text-xs text-gray-400 mt-0.5">Billed as ${tier.price * tier.months} every {tier.months} months</p>}
                </div>
                <ul className="space-y-2 mb-8 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                      <span className="text-blue-500 shrink-0 mt-0.5">+</span> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/request-access"
                  className={"block text-center py-2.5 rounded-xl font-semibold text-sm transition-colors " + (plan.highlight ? "bg-blue-600 text-white hover:bg-blue-700" : "border-2 border-blue-600 text-blue-600 hover:bg-blue-50")}>
                  {plan.cta}
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mt-20 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              { q: "Is there a free trial?", a: "Contracts of 3 months or longer include a free first month. Month-to-month plans do not include a free trial." },
              { q: "Can I change my plan later?", a: "Yes, you can upgrade at any time from your billing settings." },
              { q: "What happens if I cancel?", a: "You can cancel anytime. Your data remains accessible until the end of your billing period." },
              { q: "Do you offer a BAA for HIPAA compliance?", a: "Yes, a Business Associate Agreement (BAA) is included with all plans." },
              { q: "What if I need more locations than my plan allows?", a: "You can add extra locations for $49/mo per location beyond your plan limit, or upgrade to a higher plan." },
              { q: "Are there setup fees?", a: "No setup fees." },
              { q: "Do you offer nonprofit discounts?", a: "Yes, contact us for nonprofit pricing options." },
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
          <Link href="/contact" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors">
            Talk to Us
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
        <p>ABA AI Assistant. All rights reserved.</p>
      </footer>
    </div>
  );
}
