"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";

const PLANS = [
  { id: "starter", name: "Starter", price: 199, desc: "1 clinician, up to 10 clients, 1 location" },
  { id: "basic", name: "Basic", price: 299, desc: "Up to 3 clinicians, up to 25 clients, 1 location" },
  { id: "professional", name: "Professional", price: 449, desc: "Up to 5 clinicians, unlimited clients, 2 locations", popular: true },
  { id: "growth", name: "Growth", price: 649, desc: "Up to 25 clinicians, unlimited clients, 5 locations" },
  { id: "enterprise", name: "Enterprise", price: 849, desc: "Up to 75 clinicians, unlimited clients, 15 locations" },
  { id: "clinic", name: "Clinic", price: 1099, desc: "Unlimited clinicians, clients, and locations" },
];

const FAQS = [
  { q: "Is there a free trial?", a: "Yes, contracts of 3 months or longer include a free first month. Month-to-month plans do not include a free trial." },
  { q: "Can I cancel anytime?", a: "Yes. Cancel anytime from your billing settings." },
  { q: "Is ABA AI HIPAA compliant?", a: "Yes. All data is encrypted, access is role-based, and a Business Associate Agreement (BAA) is signed during onboarding." },
  { q: "What happens to my data if I cancel?", a: "Your data is retained for 7 years per HIPAA requirements. You can export all data before canceling." },
  { q: "Do you offer discounts for nonprofits?", a: "Yes, contact hello@aba-ai-assistant.com for nonprofit and multi-clinic pricing." },
];

export default function UpgradePage() {
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  async function handleRequestUpgrade(planId: string, planName: string) {
    setSending(planId);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      let companyId = "";
      let companyName = "Unknown";

      if (user) {
        const { data: companyUser } = await supabase
          .from("company_users")
          .select("company_id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        if (companyUser?.company_id) {
          companyId = companyUser.company_id;
          const { data: company } = await supabase
            .from("companies")
            .select("name")
            .eq("id", companyUser.company_id)
            .single();
          companyName = company?.name || "Unknown";
        }
      }

      await fetch("/api/request-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          companyName,
          currentPlan: "current",
          requestedPlan: planId,
          resourceType: "upgrade request (" + planName + ")",
        }),
      });
      setSent(planId);
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      <div className="text-center">
        <PageHeader title="Choose Your Plan" />
        <p className="text-gray-500 mt-2">Request a plan and our team will reach out to get you set up.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {PLANS.map((plan) => (
          <div key={plan.id} className={"relative border-2 rounded-2xl p-6 bg-white flex flex-col " + (plan.popular ? "border-blue-500" : "border-gray-200")}>
            {plan.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full bg-blue-600 text-white whitespace-nowrap">
                Most Popular
              </span>
            )}
            <div className="mb-4">
              <p className="text-lg font-bold text-gray-800">{plan.name}</p>
              <div className="flex items-end gap-1 mt-1">
                <p className="text-3xl font-black text-gray-900">${plan.price}</p>
                <p className="text-sm text-gray-400 mb-1">/month</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 flex-1 mb-6">{plan.desc}</p>

            <button
              type="button"
              disabled={sending === plan.id || sent === plan.id}
              onClick={() => handleRequestUpgrade(plan.id, plan.name)}
              className={"w-full py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 " + (plan.popular ? "bg-blue-600 text-white hover:bg-blue-700" : "border-2 border-blue-300 text-blue-600 hover:bg-blue-50")}>
              {sent === plan.id ? "Requested" : sending === plan.id ? "Sending..." : "Request " + plan.name}
            </button>
          </div>
        ))}
      </div>

      <Section title="Frequently Asked Questions">
        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex justify-between items-center p-4 text-left hover:bg-gray-50 transition-colors">
                <p className="text-sm font-medium text-gray-800">{faq.q}</p>
                <span className="text-gray-400 shrink-0 ml-2">{openFaq === i ? "-" : "+"}</span>
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
