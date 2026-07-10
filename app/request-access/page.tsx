"use client";

import { useState } from "react";
import PublicNav from "@/components/layout/PublicNav";

export default function RequestAccessPage() {
  const [form, setForm] = useState({
    orgName: "",
    contactName: "",
    contactEmail: "",
    verificationType: "ein",
    verificationValue: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/access-requests", {
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

  if (submitted) {
    return (
      <div className="min-h-screen bg-white font-sans">
        <PublicNav />
        <div className="max-w-lg mx-auto px-6 py-24 text-center">
          <div className="text-5xl mb-4">📬</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email!</h1>
          <p className="text-gray-500">
            We have sent you a link to choose your plan. Once selected, our team will review your request shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      <PublicNav />
      <div className="max-w-lg mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Request Access</h1>
          <p className="text-gray-500">
            ABA AI Assistant is available to ABA therapy clinics and organizations.
            Tell us about your organization to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border-2 border-gray-200 rounded-2xl p-8 space-y-5">
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">Organization Name</label>
            <input
              required
              value={form.orgName}
              onChange={(e) => setForm({ ...form, orgName: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">Your Name</label>
            <input
              required
              value={form.contactName}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">Email</label>
            <input
              required
              type="email"
              value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">Verification Type</label>
            <select
              value={form.verificationType}
              onChange={(e) => setForm({ ...form, verificationType: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="ein">EIN</option>
              <option value="bcba">BCBA Certification Number</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">
              {form.verificationType === "ein" ? "EIN (XX-XXXXXXX)" : "BCBA Certification Number"}
            </label>
            <input
              required
              value={form.verificationValue}
              onChange={(e) => setForm({ ...form, verificationValue: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Request"}
          </button>
        </form>
      </div>
    </div>
  );
}
