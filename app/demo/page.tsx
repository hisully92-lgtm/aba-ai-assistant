"use client";

import { useState } from "react";
import PublicNav from "@/components/layout/PublicNav";

export default function DemoPage() {
  const [tab, setTab] = useState<"video" | "live">("video");

  const [form, setForm] = useState({ name: "", email: "", companyName: "", phone: "", preferredTime: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      <PublicNav />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">See ABA AI Assistant in Action</h1>
          <p className="text-gray-500">Watch a self-guided walkthrough, or schedule time with us for a live demo.</p>
        </div>

        <div className="flex justify-center gap-2 mb-10">
          <button
            onClick={() => setTab("video")}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${tab === "video" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            Watch a Demo
          </button>
          <button
            onClick={() => setTab("live")}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${tab === "live" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            Schedule a Live Walkthrough
          </button>
        </div>

        {tab === "video" && (
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-2xl aspect-video flex items-center justify-center overflow-hidden">
              {/* TODO: Replace with the actual walkthrough video once recorded.
                  Simplest options: drop an .mp4 in /public and point src at it,
                  or embed a hosted video (YouTube/Vimeo/Loom) via <iframe>. */}
              <div className="text-center text-gray-400 px-6">
                <p className="text-5xl mb-3">🎬</p>
                <p className="text-sm">Demo video coming soon</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 text-center">
              Want a personal walkthrough instead? <button onClick={() => setTab("live")} className="text-blue-600 underline">Schedule a live demo →</button>
            </p>
          </div>
        )}

        {tab === "live" && (
          <div className="bg-white border-2 border-gray-200 rounded-2xl p-8">
            {submitted ? (
              <div className="text-center space-y-3 py-8">
                <p className="text-5xl">📅</p>
                <h2 className="text-xl font-bold text-gray-900">Request received!</h2>
                <p className="text-gray-500 text-sm">We'll reach out shortly to schedule your live walkthrough.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Your Name *</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Email *</label>
                  <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Organization Name *</label>
                  <input required value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Phone (optional)</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Preferred day/time (optional)</label>
                  <input value={form.preferredTime} onChange={(e) => setForm({ ...form, preferredTime: e.target.value })}
                    placeholder="e.g. Weekday afternoons"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Anything you'd like us to know? (optional)</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm h-24 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>

                {error && <p className="text-red-600 text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Request Demo →"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
