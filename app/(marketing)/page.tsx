"use client";

import Link from "next/link";
import { useState } from "react";

const FEATURES = [
  { icon: "📋", title: "Session Notes & Data Collection", desc: "AI-powered session notes, behavior tracking, DTT, interval recording, and real-time data collection built for ABA practice." },
  { icon: "🧠", title: "Behavior Intervention Plans", desc: "Build, manage, and track BIPs with goal dashboards, visual analytics, and automated progress reports." },
  { icon: "⏱️", title: "Time Tracking & EVV", desc: "Electronic Visit Verification, drive time tracking, and automated billing approval — all in one workflow." },
  { icon: "🏦", title: "Insurance & Billing", desc: "CMS-1500 claims, authorization tracking, clearinghouse integration, and ERA/EOB posting for a complete billing circle." },
  { icon: "👥", title: "Team Management", desc: "Role-based access, competency checks, supervision logs, staff performance tracking, and payroll export." },
  { icon: "🎓", title: "40-Hour RBT Training", desc: "Built-in no-skip video training with quizzes, progress tracking, and automatic certificate generation." },
  { icon: "🤖", title: "AI Assistant", desc: "Generate treatment plans, session summaries, parent reports, and clinical documentation in seconds." },
  { icon: "📱", title: "Mobile App", desc: "Full-featured iOS and Android app for clinicians in the field — session notes, time tracking, and team chat." },
];

const PLANS = [
  { id: "starter", label: "Starter", price: 129, desc: "1 clinician · Up to 10 clients", features: ["Session notes", "Basic data collection", "Progress reports", "Email support"], highlight: false },
  { id: "professional", label: "Professional", price: 249, desc: "Up to 5 clinicians · Unlimited clients", features: ["Everything in Starter", "AI session notes", "Insurance billing", "Priority support"], highlight: true },
  { id: "growth", label: "Growth", price: 349, desc: "Up to 25 clinicians · Unlimited clients", features: ["Everything in Professional", "Advanced reporting", "Multi-location dashboard", "Onboarding support"], highlight: false },
  { id: "enterprise", label: "Enterprise", price: 499, desc: "Up to 75 clinicians · Unlimited clients", features: ["Everything in Growth", "EDI 837 claims", "QuickBooks integration", "Custom branding"], highlight: false },
  { id: "clinic", label: "Clinic", price: 599, desc: "Unlimited everything", features: ["Everything in Enterprise", "White-label options", "API access", "Dedicated support"], highlight: false },
];

const FAQS = [
  { q: "Is ABA AI HIPAA compliant?", a: "Yes. ABA AI is built on HIPAA-compliant infrastructure with signed BAA agreements, encrypted data storage, and audit logging. Full certification is in progress." },
  { q: "Do I need a credit card to start?", a: "No. You can start your 30-day free trial without a credit card. Add payment info anytime before your trial ends." },
  { q: "Can my whole team use it?", a: "Yes. Each plan supports multiple clinicians with role-based access — RBTs, BCBAs, supervisors, admins, and student analysts all have their own tailored views." },
  { q: "Does it work on mobile?", a: "Yes. ABA AI has a full-featured iOS and Android app for clinicians in the field, including session notes, time tracking, EVV, and team chat." },
  { q: "Can I import my existing client data?", a: "Yes. ABA AI supports CSV import for clients, programs, and historical session data. Our onboarding team can assist with migration." },
  { q: "What clearinghouses do you support?", a: "ABA AI integrates with Availity and Office Ally for EDI 837 claim submission, with more clearinghouses coming soon." },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleEmailSubmit() {
    if (!email.trim()) return;
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-white">

      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#1a2234] rounded-lg flex items-center justify-center text-white text-sm font-bold">A</div>
            <span className="font-bold text-gray-900 text-lg">ABA AI Assistant</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-blue-600 transition-colors">FAQ</a>
            <a href="#contact" className="hover:text-blue-600 transition-colors">Contact</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Sign In</Link>
            <Link href="/onboarding"
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="bg-gradient-to-br from-[#1a2234] via-[#1e3a5f] to-[#1a2234] text-white py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-full px-4 py-1.5 text-xs text-blue-300 mb-8">
            🚀 Now in Beta — 30-day free trial, no credit card required
          </div>
          <h1 className="text-5xl md:text-6xl font-black leading-tight mb-6">
            The Complete Practice<br />
            <span className="text-blue-400">Management Platform</span><br />
            for ABA Therapy
          </h1>
          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            Session notes, billing, EVV, team management, RBT training, and AI-powered documentation — all in one HIPAA-compliant platform built specifically for ABA clinics.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/onboarding"
              className="bg-blue-500 hover:bg-blue-400 text-white px-8 py-4 rounded-xl font-bold text-lg transition-colors">
              Start Free Trial →
            </Link>
            <a href="#features"
              className="border border-white/30 hover:border-white/60 text-white px-8 py-4 rounded-xl font-medium text-lg transition-colors">
              See Features
            </a>
          </div>
          <p className="text-gray-400 text-sm mt-6">No credit card required · 30-day free trial · Cancel anytime</p>
        </div>
      </section>

      {/* STATS */}
      <section className="bg-blue-600 py-12 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
          {[
            { value: "40+", label: "Features Built" },
            { value: "100%", label: "ABA-Specific" },
            { value: "HIPAA", label: "Compliant" },
            { value: "30 days", label: "Free Trial" },
          ].map(stat => (
            <div key={stat.label}>
              <p className="text-3xl font-black">{stat.value}</p>
              <p className="text-blue-200 text-sm mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-gray-900 mb-4">Everything Your Clinic Needs</h2>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto">
              Built by ABA professionals for ABA professionals. Every feature designed around real clinical workflows.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WORKFLOW */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-gray-900 mb-4">The Complete Billing Circle</h2>
            <p className="text-xl text-gray-500">From session to payment — fully connected and tracked.</p>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-3">
            {[
              { icon: "⏱️", label: "Time Entry & EVV" },
              { icon: "→" },
              { icon: "✅", label: "Session Review" },
              { icon: "→" },
              { icon: "📄", label: "CMS-1500" },
              { icon: "→" },
              { icon: "🔌", label: "Clearinghouse" },
              { icon: "→" },
              { icon: "💰", label: "ERA/EOB Payment" },
            ].map((step, i) => (
              step.icon === "→" ? (
                <span key={i} className="text-2xl text-gray-300 font-bold">→</span>
              ) : (
                <div key={i} className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3 text-center">
                  <p className="text-2xl mb-1">{step.icon}</p>
                  <p className="text-xs font-semibold text-blue-700">{step.label}</p>
                </div>
              )
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-gray-900 mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-gray-500">30-day free trial on all plans. No credit card required.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {PLANS.map(plan => (
              <div key={plan.id} className={`rounded-2xl p-6 border-2 transition-all flex flex-col ${plan.highlight ? "border-blue-500 bg-blue-600 text-white shadow-xl scale-105" : "border-gray-200 bg-white"}`}>
                <div className="mb-4">
                  {plan.highlight && <p className="text-xs font-bold text-blue-200 uppercase mb-2">Most Popular</p>}
                  <p className={`font-black text-xl ${plan.highlight ? "text-white" : "text-gray-900"}`}>{plan.label}</p>
                  <p className={`text-xs mt-1 ${plan.highlight ? "text-blue-200" : "text-gray-400"}`}>{plan.desc}</p>
                </div>
                <div className="mb-6">
                  <span className={`text-4xl font-black ${plan.highlight ? "text-white" : "text-gray-900"}`}>${plan.price}</span>
                  <span className={`text-sm ${plan.highlight ? "text-blue-200" : "text-gray-400"}`}>/mo</span>
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className={`text-xs flex items-start gap-2 ${plan.highlight ? "text-blue-100" : "text-gray-600"}`}>
                      <span className="shrink-0 mt-0.5">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/onboarding"
                  className={`text-center text-sm font-bold py-2.5 rounded-xl transition-colors ${plan.highlight ? "bg-white text-blue-600 hover:bg-blue-50" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
                  Start Free Trial
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-gray-400 text-sm mt-8">
            501(c)(3) nonprofits receive 20% off all plans. Contact us to verify.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-gray-900 mb-4">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <span className="font-semibold text-gray-900 text-sm">{faq.q}</span>
                  <span className="text-gray-400 text-lg shrink-0 ml-4">{openFaq === i ? "−" : "+"}</span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-gradient-to-br from-[#1a2234] to-[#1e3a5f] text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-black mb-4">Ready to Transform Your Practice?</h2>
          <p className="text-xl text-gray-300 mb-10">
            Join ABA clinics already using ABA AI Assistant. Start your free trial today.
          </p>
          {submitted ? (
            <div className="bg-green-500/20 border border-green-400/30 rounded-xl p-4 text-green-300 mb-6">
              ✓ Thanks! We'll be in touch soon.
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-6">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400" />
              <button onClick={handleEmailSubmit}
                className="bg-blue-500 hover:bg-blue-400 text-white px-6 py-3 rounded-xl font-bold transition-colors whitespace-nowrap">
                Get Early Access
              </button>
            </div>
          )}
          <Link href="/onboarding"
            className="inline-block bg-white text-[#1a2234] px-8 py-4 rounded-xl font-black text-lg hover:bg-gray-100 transition-colors">
            Start Free Trial — No Card Required →
          </Link>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="py-16 px-6 bg-gray-50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Get in Touch</h2>
          <p className="text-gray-500 mb-6">Have questions? We're here to help.</p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-600">
            <a href="mailto:hello@aba-ai-assistant.com" className="hover:text-blue-600 transition-colors">
              📧 hello@aba-ai-assistant.com
            </a>
            <a href="mailto:support@aba-ai-assistant.com" className="hover:text-blue-600 transition-colors">
              🛠️ support@aba-ai-assistant.com
            </a>
            <Link href="/dashboard/help" className="hover:text-blue-600 transition-colors">
              ❓ Help Center
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#1a2234] text-gray-400 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center text-white text-xs font-bold">A</div>
              <span className="text-white font-bold">ABA AI Assistant</span>
            </div>
            <p className="text-xs text-gray-500 max-w-xs">HIPAA-compliant practice management platform built specifically for ABA therapy clinics.</p>
          </div>
          <div className="flex flex-wrap gap-12 text-sm">
            <div className="space-y-2">
              <p className="text-white font-semibold text-xs uppercase tracking-wide">Product</p>
              <a href="#features" className="block hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="block hover:text-white transition-colors">Pricing</a>
              <Link href="/onboarding" className="block hover:text-white transition-colors">Start Trial</Link>
            </div>
            <div className="space-y-2">
              <p className="text-white font-semibold text-xs uppercase tracking-wide">Legal</p>
              <a href="/notice-of-privacy-practices" className="block hover:text-white transition-colors">Privacy Practices</a>
              <a href="/data-retention" className="block hover:text-white transition-colors">Data Retention</a>
              <a href="/security-policy" className="block hover:text-white transition-colors">Security Policy</a>
            </div>
            <div className="space-y-2">
              <p className="text-white font-semibold text-xs uppercase tracking-wide">Support</p>
              <a href="mailto:support@aba-ai-assistant.com" className="block hover:text-white transition-colors">Email Support</a>
              <Link href="/dashboard/help" className="block hover:text-white transition-colors">Help Center</Link>
              <a href="#faq" className="block hover:text-white transition-colors">FAQ</a>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-gray-700 flex flex-wrap justify-between gap-3 text-xs text-gray-500">
          <span>© {new Date().getFullYear()} ABA AI Assistant. All rights reserved.</span>
          <span>HIPAA Compliant · SOC 2 In Progress · Built for ABA Clinics</span>
        </div>
      </footer>
    </div>
  );
}