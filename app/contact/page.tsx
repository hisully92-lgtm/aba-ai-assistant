"use client";

import { useState } from "react";
import Link from "next/link";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "hisully92@gmail.com",
          subject: `Contact Form: ${subject || "General Inquiry"} — from ${name}`,
          body: `
            <h2>New Contact Form Submission</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Subject:</strong> ${subject || "General Inquiry"}</p>
            <p><strong>Message:</strong></p>
            <p>${message.replace(/\n/g, "<br>")}</p>
          `,
        }),
      });

      // Also send confirmation to user
      await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          subject: "We received your message — ABA AI Assistant",
          body: `
            <h2>Thanks for reaching out, ${name}!</h2>
            <p>We received your message and will get back to you within 1-2 business days.</p>
            <p><strong>Your message:</strong></p>
            <p>${message.replace(/\n/g, "<br>")}</p>
            <p>In the meantime, feel free to explore <a href="https://aba-ai-assistant.com">ABA AI Assistant</a>.</p>
          `,
        }),
      });

      setSent(true);
    } catch {
      setError("Something went wrong. Please email us directly at support@aba-ai-assistant.com");
    } finally {
      setLoading(false);
    }
  }

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

      <div className="max-w-2xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Get in Touch</h1>
          <p className="text-gray-500">Have questions? Want a demo? Need more information? We&apos;re here to help.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {[
            { icon: "📧", label: "Email", value: "support@aba-ai-assistant.com", href: "mailto:support@aba-ai-assistant.com" },
            { icon: "⭐", label: "Yelp", value: "Leave a review", href: "https://www.yelp.com/biz/aba-ai-assistant" },
            { icon: "⭐", label: "Google", value: "Leave a review", href: "https://g.page/r/aba-ai-assistant/review" },
          ].map(item => (
            <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer"
              className="border border-gray-100 rounded-xl p-4 text-center hover:border-blue-200 hover:bg-blue-50 transition-all">
              <div className="text-2xl mb-1">{item.icon}</div>
              <p className="text-xs font-semibold text-gray-700">{item.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.value}</p>
            </a>
          ))}
        </div>

        {sent ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Message sent!</h2>
            <p className="text-gray-500 text-sm">We&apos;ll get back to you within 1-2 business days. Check your email for a confirmation.</p>
            <Link href="/" className="inline-block mt-4 text-blue-600 text-sm hover:underline">← Back to home</Link>
          </div>
        ) : (
          <div className="border border-gray-100 rounded-2xl p-8 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">Send us a message</h2>
            {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600 mb-4">{error}</div>}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Name *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Email *</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@clinic.com"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Subject</label>
                <select value={subject} onChange={e => setSubject(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="">Select a topic...</option>
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="Request a Demo">Request a Demo</option>
                  <option value="Pricing Question">Pricing Question</option>
                  <option value="Technical Support">Technical Support</option>
                  <option value="HIPAA / Compliance">HIPAA / Compliance</option>
                  <option value="Partnership">Partnership</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Message *</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="How can we help you?"
                  rows={5}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <button onClick={handleSubmit} disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {loading ? "Sending..." : "Send Message →"}
              </button>
            </div>
          </div>
        )}
      </div>

      <footer className="border-t border-gray-100 px-6 py-8 text-center text-xs text-gray-400">
        <div className="flex flex-wrap justify-center gap-4 mb-2">
          <Link href="/" className="hover:text-gray-600">Home</Link>
          <Link href="/about" className="hover:text-gray-600">About</Link>
          <Link href="/suggestions" className="hover:text-gray-600">Suggestions</Link>
          <Link href="/privacy" className="hover:text-gray-600">Privacy</Link>
        </div>
        <p>© {new Date().getFullYear()} ABA AI Assistant. All rights reserved.</p>
      </footer>
    </div>
  );
}