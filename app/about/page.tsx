import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About ABA AI Assistant — Built for ABA Therapy Clinics",
  description:
    "Learn about ABA AI Assistant, the HIPAA-compliant practice management platform built specifically for RBTs, BCBAs, and ABA therapy clinics.",
  openGraph: {
    title: "About ABA AI Assistant",
    description:
      "Built by someone who understands ABA therapy documentation firsthand. We help clinicians spend less time on paperwork and more time with clients.",
    url: "https://aba-ai-assistant.com/about",
  },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-bold text-gray-900 text-lg">ABA AI</span>
          </Link>
          <Link href="/login" className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
            Sign In
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-20">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">About ABA AI Assistant</h1>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-600">
          <p className="text-lg">
            ABA AI Assistant was built by someone who understands the challenges of ABA therapy documentation firsthand.
            We saw clinicians spending hours on paperwork instead of time with clients, and we knew there had to be a better way.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-10">Our Mission</h2>
          <p>
            To give ABA therapy clinics the tools they need to document efficiently, stay compliant, and focus on what matters most — helping their clients reach their goals.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-10">What We Do</h2>
          <p>
            ABA AI Assistant is a comprehensive practice management platform built specifically for ABA therapy clinics.
            From session notes and goal tracking to billing and progress reports, we handle the documentation so you can handle the therapy.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-10">
            {[
              { icon: "🔒", title: "HIPAA Compliant", desc: "Built with security and compliance at the core. Electronic BAA signing, encrypted data, and audit logs." },
              { icon: "🤖", title: "AI-Powered", desc: "Anthropic Claude AI helps generate clinical-grade session notes and progress reports in seconds." },
              { icon: "📱", title: "Works Everywhere", desc: "Mobile, tablet, and desktop. Use it in the clinic, at school, or in the community." },
              { icon: "👥", title: "Built for Teams", desc: "Role-based access for admins, BCBAs, RBTs, student analysts, and parents." },
            ].map(item => (
              <div key={item.title} className="border border-gray-100 rounded-xl p-5">
                <div className="text-2xl mb-2">{item.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mt-10">Our Commitment</h2>
          <p>
            We are committed to continuous improvement based on feedback from the ABA community.
            Every feature we build is designed with clinicians in mind.
          </p>

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-8 mt-10 text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Have questions or feedback?</h3>
            <p className="text-gray-500 mb-4">We&apos;d love to hear from you.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/contact" className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors">
                Contact Us
              </Link>
              <Link href="/suggestions" className="border border-gray-200 text-gray-700 px-6 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-50 transition-colors">
                Submit a Suggestion
              </Link>
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-gray-100 px-6 py-8 text-center text-xs text-gray-400">
        <div className="flex flex-wrap justify-center gap-4 mb-2">
          <Link href="/" className="hover:text-gray-600">Home</Link>
          <Link href="/contact" className="hover:text-gray-600">Contact</Link>
          <Link href="/privacy" className="hover:text-gray-600">Privacy</Link>
          <Link href="/hipaa" className="hover:text-gray-600">HIPAA</Link>
        </div>
        <p>© {new Date().getFullYear()} ABA AI Assistant. All rights reserved.</p>
      </footer>
    </div>
  );
}