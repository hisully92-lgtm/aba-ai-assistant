"use client";
import { useState } from "react";

export default function RequestAccessPage() {
  const [form, setForm] = useState({
    orgName: "",
    contactName: "",
    contactEmail: "",
    verificationType: "ein",
    verificationValue: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
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
  }

  if (submitted) {
    return (
      <div style={{ padding: 40, maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
        <h2>Check your email!</h2>
        <p>We've sent you a link to choose your plan. Once selected, our team will review your request shortly.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 40, maxWidth: 480, margin: "0 auto" }}>
      <h2>Request Access</h2>
      <p style={{ color: "#666", marginBottom: 24 }}>
        ABA AI Assistant is available to ABA therapy clinics and organizations.
        Tell us about your organization to get started.
      </p>
      <form onSubmit={handleSubmit}>
        <label style={{ display: "block", marginTop: 16 }}>Organization Name</label>
        <input
          required
          value={form.orgName}
          onChange={(e) => setForm({ ...form, orgName: e.target.value })}
          style={{ width: "100%", padding: 10, marginTop: 4 }}
        />

        <label style={{ display: "block", marginTop: 16 }}>Your Name</label>
        <input
          required
          value={form.contactName}
          onChange={(e) => setForm({ ...form, contactName: e.target.value })}
          style={{ width: "100%", padding: 10, marginTop: 4 }}
        />

        <label style={{ display: "block", marginTop: 16 }}>Email</label>
        <input
          required
          type="email"
          value={form.contactEmail}
          onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
          style={{ width: "100%", padding: 10, marginTop: 4 }}
        />

        <label style={{ display: "block", marginTop: 16 }}>Verification Type</label>
        <select
          value={form.verificationType}
          onChange={(e) => setForm({ ...form, verificationType: e.target.value })}
          style={{ width: "100%", padding: 10, marginTop: 4 }}
        >
          <option value="ein">EIN</option>
          <option value="bcba">BCBA Certification Number</option>
        </select>

        <label style={{ display: "block", marginTop: 16 }}>
          {form.verificationType === "ein" ? "EIN (XX-XXXXXXX)" : "BCBA Certification Number"}
        </label>
        <input
          required
          value={form.verificationValue}
          onChange={(e) => setForm({ ...form, verificationValue: e.target.value })}
          style={{ width: "100%", padding: 10, marginTop: 4 }}
        />

        {error && <p style={{ color: "red", marginTop: 12 }}>{error}</p>}

        <button
          type="submit"
          style={{ marginTop: 24, padding: "12px 24px", width: "100%", background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 8 }}
        >
          Submit Request
        </button>
      </form>
    </div>
  );
}