export default function DataRetentionPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-md p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Data Retention Policy</h1>
          <p className="text-gray-500 text-sm mt-2">Effective Date: January 1, 2025 · ABA AI Assistant</p>
        </div>

        {[
          {
            title: "Overview",
            content: "This policy describes how ABA AI Assistant retains, archives, and deletes data. As a platform handling Protected Health Information (PHI), our retention practices comply with HIPAA requirements and applicable state laws.",
          },
          {
            title: "Clinical Records (PHI)",
            rows: [
              { type: "Session notes", retention: "7 years from date of service" },
              { type: "Client profiles", retention: "7 years from last service date" },
              { type: "BIP plans", retention: "7 years from creation" },
              { type: "Incident reports", retention: "7 years from incident date" },
              { type: "Progress reports", retention: "7 years from creation" },
              { type: "Assessment records", retention: "7 years from assessment date" },
              { type: "Insurance records", retention: "7 years from date of service" },
            ],
          },
          {
            title: "Administrative Records",
            rows: [
              { type: "Audit logs", retention: "6 years (HIPAA requirement)" },
              { type: "HIPAA agreements (BAA)", retention: "6 years from signing" },
              { type: "Staff credentials", retention: "Duration of employment + 3 years" },
              { type: "Billing records", retention: "7 years" },
              { type: "Access logs", retention: "6 years" },
            ],
          },
          {
            title: "System Data",
            rows: [
              { type: "Session recordings", retention: "7 days (configurable up to 30 days)" },
              { type: "AI usage logs", retention: "1 year" },
              { type: "System logs", retention: "90 days" },
              { type: "Backup data", retention: "30 days of rolling backups" },
            ],
          },
          {
            title: "Account Termination",
            content: "When a clinic terminates their account: active data access is immediately revoked, PHI is retained for 7 years in compliance with HIPAA, clinics may request data export before termination, after the retention period, all data is securely deleted using NIST 800-88 compliant methods.",
          },
          {
            title: "Data Deletion Requests",
            content: "Clinics may request deletion of specific records subject to applicable law. Deletion requests that conflict with HIPAA retention requirements may be denied. To request data deletion, contact support@aba-ai-assistant.com.",
          },
          {
            title: "Security of Retained Data",
            content: "All retained data, including archived records, is encrypted at rest using AES-256 encryption. Access to archived data is restricted to authorized personnel only and all access is logged.",
          },
        ].map((section) => (
          <div key={section.title} className="border-t border-gray-100 pt-6">
            <h2 className="text-lg font-bold text-gray-800 mb-2">{section.title}</h2>
            {"rows" in section ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 text-gray-600 font-medium">Data Type</th>
                      <th className="text-left py-2 text-gray-600 font-medium">Retention Period</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows?.map((row) => (
                      <tr key={row.type} className="border-b border-gray-100">
                        <td className="py-2 text-gray-700">{row.type}</td>
                        <td className="py-2 text-gray-500">{row.retention}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-600 leading-relaxed">{section.content}</p>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}