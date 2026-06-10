export default function SecurityPolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-md p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Security & Risk Analysis</h1>
          <p className="text-gray-500 text-sm mt-2">Effective Date: January 1, 2025 · ABA AI Assistant</p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
          ABA AI Assistant conducts an annual Security Risk Analysis in compliance with the HIPAA Security Rule (45 CFR § 164.308(a)(1)).
        </div>

        {[
          {
            title: "Technical Safeguards",
            items: [
              { label: "Encryption in Transit", status: "✅", detail: "TLS 1.2+ on all connections via Vercel" },
              { label: "Encryption at Rest", status: "✅", detail: "AES-256 via Supabase PostgreSQL" },
              { label: "PHI Field Encryption", status: "✅", detail: "Additional encryption on sensitive session fields" },
              { label: "Row-Level Security", status: "✅", detail: "Database-level access controls on all PHI tables" },
              { label: "Role-Based Access", status: "✅", detail: "Admin/Supervisor/RBT/Parent access tiers" },
              { label: "Session Timeout", status: "✅", detail: "Auto-logout after 30 minutes inactivity" },
              { label: "Audit Logging", status: "✅", detail: "All PHI access logged with user ID, timestamp, IP" },
              { label: "Multi-Factor Authentication", status: "✅", detail: "TOTP-based MFA available for all users" },
              { label: "Company Isolation", status: "✅", detail: "Complete data isolation between organizations" },
            ],
          },
          {
            title: "Administrative Safeguards",
            items: [
              { label: "Business Associate Agreements", status: "✅", detail: "BAA signed electronically during onboarding" },
              { label: "HIPAA Privacy Policy", status: "✅", detail: "Published at /notice-of-privacy-practices" },
              { label: "Data Retention Policy", status: "✅", detail: "Published at /data-retention" },
              { label: "Staff Access Controls", status: "✅", detail: "Role-based feature access per company settings" },
              { label: "Incident Response Plan", status: "✅", detail: "60-day breach notification procedure in BAA" },
              { label: "Vendor BAAs — Supabase", status: "⚠️", detail: "Pending — upgrade to Team plan required" },
              { label: "Vendor BAAs — Vercel", status: "⚠️", detail: "Pending — upgrade to Pro plan required" },
              { label: "Vendor BAAs — Anthropic", status: "⚠️", detail: "Pending — enterprise agreement required" },
            ],
          },
          {
            title: "Physical Safeguards",
            items: [
              { label: "Data Center Security", status: "✅", detail: "Supabase/Vercel SOC 2 certified data centers" },
              { label: "No On-Premise PHI Storage", status: "✅", detail: "All PHI stored in cloud with physical controls" },
            ],
          },
          {
            title: "Known Risks & Remediation",
            content: "The following risks have been identified and are being addressed: vendor BAAs for Supabase, Vercel, and Anthropic are pending subscription upgrades; telehealth session recording requires Daily.co HIPAA plan before activation; SMS alerts require Twilio BAA before PHI transmission.",
          },
        ].map((section) => (
          <div key={section.title} className="border-t border-gray-100 pt-6">
            <h2 className="text-lg font-bold text-gray-800 mb-3">{section.title}</h2>
            {"items" in section ? (
              <div className="space-y-2">
                {section.items?.map((item) => (
                  <div key={item.label} className="flex items-start gap-3 border border-gray-100 rounded-lg p-3 bg-gray-50">
                    <span className="text-lg shrink-0">{item.status}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-700">{item.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600 leading-relaxed">{section.content}</p>
            )}
          </div>
        ))}

        <div className="border-t border-gray-100 pt-6 text-xs text-gray-400">
          This Security Risk Analysis is reviewed and updated annually. Last reviewed: January 2025.
          Contact security@aba-ai-assistant.com for questions.
        </div>
      </div>
    </main>
  );
}