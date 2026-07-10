"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PublicNav from "@/components/layout/PublicNav";

function ConfirmForm() {
  const params = useSearchParams();
  const token = params?.get("token") ?? "";
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/access-requests/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, notes }),
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
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Request submitted!</h1>
        <p className="text-gray-500">
          Thank you! We will review your request and reach out shortly to confirm details and get you set up.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-16">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Almost done!</h1>
        <p className="text-gray-500">
          Add any notes or questions for our team, then submit your request for review.
        </p>
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 space-y-5">
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-1">
            Notes or Questions (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything you'd like us to know? Number of clinicians, locations, questions about the plan, preferred start date, etc."
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm h-32 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Request"}
        </button>
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <PublicNav />
      <Suspense fallback={<div className="text-center py-24 text-gray-400">Loading...</div>}>
        <ConfirmForm />
      </Suspense>
    </div>
  );
}
