import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white font-sans">

      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-bold text-gray-900 text-lg">ABA AI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="#features" className="text-sm text-gray-500 hover:text-gray-800 hidden sm:block">Features</Link>
            <Link href="#pricing" className="text-sm text-gray-500 hover:text-gray-800 hidden sm:block">Pricing</Link>
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

      {/* HERO */}
      <section className="px-6 pt-20 pb-24 text-center bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold mb-6">
            ✨ Built for ABA clinicians, by people who get it
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
            ABA therapy documentation,{" "}
            <span className="text-blue-600">finally made simple</span>
          </h1>
          <p className="text-lg text-gray-500 mb-10 max-w-xl mx-auto">
            ABA AI helps RBTs, BCBAs, and clinic admins write session notes, track goals,
            manage authorizations, and generate progress reports — all in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login?signup=true"
              className="bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold text-base hover:bg-blue-700 transition-colors">
              Start Free →
            </Link>
            <Link href="/contact"
              className="border border-gray-200 text-gray-700 px-8 py-3 rounded-xl font-semibold text-base hover:bg-gray-50 transition-colors">
              Request More Info
            </Link>
          </div>
          <p className="text-xs text-gray-400 mt-4">No credit card required · HIPAA compliant · Free to start</p>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="px-6 py-10 bg-white border-y border-gray-100">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-6">Trusted by ABA clinics</p>
          <div className="flex flex-wrap justify-center gap-8 text-gray-400 text-sm font-medium">
            {["RBT Teams", "BCBA Supervisors", "Clinic Admins", "Parent Coaches", "School Programs"].map(tag => (
              <span key={tag} className="flex items-center gap-1">
                <span className="text-blue-400">✓</span> {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="px-6 py-24 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything your clinic needs</h2>
            <p className="text-gray-500 max-w-xl mx-auto">From session notes to progress reports, ABA AI covers your whole workflow so you can spend more time with clients.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: "📋", title: "Smart Session Notes", desc: "Role-based templates for RBTs, BCBAs, supervisors, and parents. SOAP notes built in. Timer tracks exact start and end times." },
              { icon: "🎯", title: "Goal Tracking", desc: "Set baselines, targets, and mastery criteria. Track generalization across settings. Auto-flags mastered goals." },
              { icon: "🤖", title: "AI Progress Reports", desc: "Generate clinical-grade progress reports in seconds using your session data. Review, edit, and print with signature lines." },
              { icon: "⏱️", title: "Time Tracking", desc: "Clock in and out of sessions. Track billable hours by session type, client, and day. See weekly summaries at a glance." },
              { icon: "📍", title: "Geofence Clock-In", desc: "Verify staff are on-site before sessions start. Supports home, school, community, and telehealth locations automatically." },
              { icon: "🔒", title: "HIPAA Compliant", desc: "Built with security first. Electronic BAA signing, role-based access, clinic isolation, and audit logs included." },
              { icon: "👥", title: "Clinic Management", desc: "Invite staff with role codes, manage locations, assign clients, and oversee your whole team from one admin panel." },
              { icon: "📊", title: "Analytics & Graphs", desc: "Visualize behavior trends, goal progress, and session data with professional ABA graphs. Export to CSV or print." },
              { icon: "📱", title: "Works on Any Device", desc: "Fully responsive on mobile, tablet, and desktop. Use it in the clinic, at home, or in the community." },
            ].map(feature => (
              <div key={feature.title} className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-md transition-shadow">
                <div className="text-3xl mb-3">{feature.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-6 py-24 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Up and running in minutes</h2>
          <p className="text-gray-500 mb-16">No onboarding calls. No IT setup. Just sign up and go.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { step: "1", title: "Create your clinic", desc: "Sign up, name your clinic, and sign the HIPAA BAA electronically. Takes under 2 minutes." },
              { step: "2", title: "Invite your team", desc: "Share your clinic code with staff. They join instantly with role-based access automatically applied." },
              { step: "3", title: "Start documenting", desc: "Add clients, log sessions, track goals, and generate reports — all from day one." },
            ].map(step => (
              <div key={step.step} className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4">
                  {step.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="px-6 py-24 bg-blue-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-16">Clinicians love it</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { quote: "I used to spend 45 minutes after each session writing notes. Now it takes 5. The templates are exactly what we needed.", name: "Sarah M.", role: "BCBA, Private Practice" },
              { quote: "The geofence clock-in has completely solved our billing audit problems. We always have proof of where staff were.", name: "James T.", role: "Clinic Director" },
              { quote: "As an RBT, I love that I can use templates and the AI fills in the clinical language. My supervisor is impressed.", name: "Aisha K.", role: "RBT, School Program" },
            ].map(t => (
              <div key={t.name} className="bg-white rounded-2xl p-6 border border-blue-100">
                <p className="text-sm text-gray-600 leading-relaxed mb-4">&ldquo;{t.quote}&rdquo;</p>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="px-6 py-24 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple, honest pricing</h2>
          <p className="text-gray-500 mb-16">Start free. Upgrade when you need more.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {[
              {
                name: "Starter",
                price: "Free",
                period: "forever",
                desc: "Perfect for solo clinicians getting started",
                features: ["Up to 5 clients", "Unlimited session notes", "Goal tracking", "Progress reports", "Time tracking", "HIPAA BAA included"],
                cta: "Get Started Free",
                href: "/login?signup=true",
                highlight: false,
              },
              {
                name: "Pro",
                price: "$49",
                period: "per month",
                desc: "For growing clinics and teams",
                features: ["Unlimited clients", "Full team management", "Role-based access codes", "Geofence clock-in", "Analytics & graphs", "Priority support"],
                cta: "Start Pro Trial",
                href: "/login?signup=true",
                highlight: true,
              },
            ].map(plan => (
              <div key={plan.name} className={`rounded-2xl p-8 border text-left ${plan.highlight ? "border-blue-500 bg-blue-600 text-white" : "border-gray-200 bg-white"}`}>
                <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${plan.highlight ? "text-blue-200" : "text-gray-400"}`}>{plan.name}</p>
                <div className="flex items-end gap-1 mb-1">
                  <p className={`text-4xl font-extrabold ${plan.highlight ? "text-white" : "text-gray-900"}`}>{plan.price}</p>
                  <p className={`text-sm mb-1 ${plan.highlight ? "text-blue-200" : "text-gray-400"}`}>/{plan.period}</p>
                </div>
                <p className={`text-sm mb-6 ${plan.highlight ? "text-blue-100" : "text-gray-500"}`}>{plan.desc}</p>
                <ul className="space-y-2 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className={`flex items-center gap-2 text-sm ${plan.highlight ? "text-blue-100" : "text-gray-600"}`}>
                      <span className={plan.highlight ? "text-blue-300" : "text-blue-500"}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href}
                  className={`block text-center py-3 rounded-xl font-semibold text-sm transition-colors ${plan.highlight ? "bg-white text-blue-600 hover:bg-blue-50" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="px-6 py-20 bg-blue-600">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to simplify your documentation?</h2>
          <p className="text-blue-100 mb-8">Join ABA clinics already using ABA AI to save hours every week.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login?signup=true"
              className="bg-white text-blue-600 px-8 py-3 rounded-xl font-semibold text-base hover:bg-blue-50 transition-colors inline-block">
              Get Started Free →
            </Link>
            <Link href="/contact"
              className="border border-white/30 text-white px-8 py-3 rounded-xl font-semibold text-base hover:bg-white/10 transition-colors inline-block">
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-6 py-12 bg-gray-900 text-gray-400">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xs">A</span>
                </div>
                <span className="font-bold text-white text-base">ABA AI</span>
              </div>
              <p className="text-sm max-w-xs">Modern documentation tools built for the ABA therapy community.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
              <div>
                <p className="text-white font-semibold mb-3">Product</p>
                <div className="space-y-2">
                  <Link href="#features" className="block hover:text-white transition-colors">Features</Link>
                  <Link href="#pricing" className="block hover:text-white transition-colors">Pricing</Link>
                  <Link href="/login" className="block hover:text-white transition-colors">Sign In</Link>
                  <Link href="/login?signup=true" className="block hover:text-white transition-colors">Get Started</Link>
                </div>
              </div>
              <div>
                <p className="text-white font-semibold mb-3">Legal</p>
                <div className="space-y-2">
                  <Link href="/privacy" className="block hover:text-white transition-colors">Privacy Policy</Link>
                  <Link href="/terms" className="block hover:text-white transition-colors">Terms of Service</Link>
                  <Link href="/hipaa" className="block hover:text-white transition-colors">HIPAA</Link>
                </div>
              </div>
              <div>
                <p className="text-white font-semibold mb-3">Company</p>
                <div className="space-y-2">
                  <Link href="/about" className="block hover:text-white transition-colors">About Us</Link>
                  <Link href="/contact" className="block hover:text-white transition-colors">Contact Us</Link>
                  <Link href="/suggestions" className="block hover:text-white transition-colors">Suggestions</Link>
                  <a href="https://www.yelp.com/biz/aba-ai-assistant" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors">⭐ Yelp Reviews</a>
                  <a href="https://g.page/r/aba-ai-assistant/review" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors">⭐ Google Reviews</a>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs">
            <p>© {new Date().getFullYear()} ABA AI. All rights reserved.</p>
            <p>HIPAA compliant · Secure · Built for clinicians</p>
          </div>
        </div>
      </footer>
    </div>
  );
}