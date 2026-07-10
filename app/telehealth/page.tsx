export default function TelehealthPage() {
  return (
    <div style={{ padding: 40, maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
      <div
        style={{
          background: "#1a1a2e",
          color: "#fff",
          padding: "10px 20px",
          borderRadius: 8,
          display: "inline-block",
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 24,
        }}
      >
        🚀 Coming Soon
      </div>
      <h1>Telehealth Sessions</h1>
      <p style={{ color: "#666", fontSize: 16, marginTop: 16, lineHeight: 1.6 }}>
        We're building secure, HIPAA-compliant video sessions directly into ABA AI Assistant —
        so you can run remote sessions, take notes in real time, and keep everything tied to
        the client's record automatically.
      </p>
      <p style={{ color: "#666", fontSize: 16, marginTop: 16, lineHeight: 1.6 }}>
        Want early access when it launches? Reach out and we'll keep you posted.
      </p>
      <a
        href="mailto:hello@aba-ai-assistant.com?subject=Telehealth Early Access"
        style={{
          display: "inline-block",
          marginTop: 24,
          padding: "12px 24px",
          background: "#1a1a2e",
          color: "#fff",
          textDecoration: "none",
          borderRadius: 8,
        }}
      >
        Get Notified
      </a>
    </div>
  );
}