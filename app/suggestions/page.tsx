"use client";
import PublicNav from "@/components/layout/PublicNav";

import { useState } from "react";
import Link from "next/link";

const CATEGORIES = [
  "Feature Request",
  "Bug Report", 
  "UI/UX Improvement",
  "New Integration",
  "Billing/Pricing",
  "Documentation",
  "Other",
];

export default function SuggestionsPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [priority, setPriority] = useState("medium");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!suggestion.trim()) { setError("Please enter your suggestion."); return; }
    setLoading(true);
    setError("");

    try {
      await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "hisully92@gmail.com",
          subject: `💡 New Suggestion: ${category || "General"} — ${priority} priority`,
          body: `
            <h2>New Suggestion Submitted</h2>
            <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p><strong>From:</strong> ${name || "Anonymous"} ${email ? `(${email})` : ""}</p>
              <p><strong>Category:</strong> ${category || "General"}</p>
              <p><strong>Priority:</strong> ${priority}</p>
              <p><strong>Suggestion:</strong></p>
              <p>${suggestion.replace(/\n/g, "<br>")}</p>
            </div>
          `,
        }),
      });
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      <PublicNav />

      <div className="max-w-2xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <div className="text-4xl mb-4">💡</div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Share Your Ideas</h1>
          <p className="text-gray-500">Help us build the best ABA practice management platform. Your suggestions directly shape our roadmap.</p>
        </div>

        {sent ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">🙏</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Thank you!</h2>
            <p className="text-gray-500 text-sm">Your suggestion has been submitted and will be reviewed by our team. We appreciate your feedback!</p>
            <div className="flex gap-3 justify-center mt-4">
              <button onClick={() => { setSent(false); setSuggestion(""); setCategory(""); setName(""); setEmail(""); }}
                className="text-sm text-blue-600 hover:underline">Submit another</button>
              <Link href="/" className="text-sm text-gray-400 hover:underline">← Back to home</Link>
            </div>
          </div>
        ) : (
          <div className="border border-gray-100 rounded-2xl p-8 shadow-sm">
            {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600 mb-4">{error}</div>}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Your Name (optional)</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Anonymous"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Email (optional)</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="For follow-up"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="">Select a category...</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Priority</label>
                <div className="flex gap-2">
                  {[
                    { value: "low", label: "💚 Low", desc: "Nice to have" },
                    { value: "medium", label: "💛 Medium", desc: "Would help" },
                    { value: "high", label: "🔴 High", desc: "Really need this" },
                  ].map(p => (
                    <button key={p.value} type="button" onClick={() => setPriority(p.value)}
                      className={`flex-1 border rounded-lg p-2 text-xs font-medium transition-all ${priority === p.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-blue-300"}`}>
                      <div>{p.label}</div>
                      <div className="text-gray-400 font-normal">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Your Suggestion *</label>
                <textarea value={suggestion} onChange={e => setSuggestion(e.target.value)}
                  placeholder="Describe your idea or feedback in detail. What problem does it solve? How would it work?"
                  rows={6}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>

              <button onClick={handleSubmit} disabled={loading || !suggestion.trim()}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-40 transition-colors">
                {loading ? "Submitting..." : "Submit Suggestion →"}
              </button>
            </div>
          </div>
        )}
      </div>

      <footer className="border-t border-gray-100 px-6 py-8 text-center text-xs text-gray-400">
        <div className="flex flex-wrap justify-center gap-4 mb-2">
          <Link href="/" className="hover:text-gray-600">Home</Link>
          <Link href="/contact" className="hover:text-gray-600">Contact</Link>
          <Link href="/about" className="hover:text-gray-600">About</Link>
          <Link href="/privacy" className="hover:text-gray-600">Privacy</Link>
        </div>
        <p>© {new Date().getFullYear()} ABA AI Assistant. All rights reserved.</p>
      </footer>
    </div>
  );
}
