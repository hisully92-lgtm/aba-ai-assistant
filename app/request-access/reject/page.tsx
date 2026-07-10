"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function RejectPage() {
  const params = useSearchParams();
  const token = params?.get("token") ?? "";
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);

  async function handleReject() {
    await fetch("/api/access-requests/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, reason }),
    });
    setSent(true);
  }

  if (sent) return <div style={{ padding: 40 }}>Rejection sent.</div>;

  return (
    <div style={{ padding: 40, maxWidth: 480 }}>
      <h2>Reject this request</h2>
      <textarea
        placeholder="Reason (shown to the clinic)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        style={{ width: "100%", height: 120, marginTop: 12 }}
      />
      <button onClick={handleReject} style={{ marginTop: 12, padding: "10px 20px" }}>
        Send Rejection
      </button>
    </div>
  );
}
