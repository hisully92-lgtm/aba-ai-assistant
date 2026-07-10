"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function InvitePage() {
 const params = useParams();
  const token = (params?.token ?? "") as string;
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit() {
    const res = await fetch("/api/invite/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    if (res.ok) {
      router.push("/login?welcome=true");
    } else {
      const data = await res.json();
      setError(data.error || "Something went wrong");
    }
  }

  return (
    <div style={{ padding: 40, maxWidth: 400, margin: "0 auto" }}>
      <h2>Set Up Your Account</h2>
      <input
        type="password"
        placeholder="Create a password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: "100%", padding: 10, marginTop: 12 }}
      />
      {error && <p style={{ color: "red" }}>{error}</p>}
      <button onClick={handleSubmit} style={{ marginTop: 12, padding: "10px 20px" }}>
        Complete Setup
      </button>
    </div>
  );
}