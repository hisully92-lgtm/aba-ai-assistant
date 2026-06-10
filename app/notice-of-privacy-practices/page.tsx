export default function NoticeOfPrivacyPracticesPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-md p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notice of Privacy Practices</h1>
          <p className="text-gray-500 text-sm mt-2">Effective Date: January 1, 2025 · ABA AI Assistant</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <p className="font-bold mb-1">THIS NOTICE DESCRIBES HOW MEDICAL INFORMATION ABOUT YOU MAY BE USED AND DISCLOSED AND HOW YOU CAN GET ACCESS TO THIS INFORMATION. PLEASE REVIEW IT CAREFULLY.</p>
        </div>

        {[
          {
            title: "Who We Are",
            content: "ABA AI Assistant is a clinical documentation and practice management platform used by Applied Behavior Analysis (ABA) therapy providers. We act as a Business Associate under HIPAA, meaning we handle Protected Health Information (PHI) on behalf of ABA clinics that use our platform.",
          },
          {
            title: "What Information We Collect",
            content: "We collect and store information that ABA clinics enter into our platform, including: client names, dates of birth, diagnoses, treatment goals, session notes, behavioral data, insurance information, and caregiver contact information. This information is entered by clinic staff and is considered Protected Health Information (PHI) under HIPAA.",
          },
          {
            title: "How We Use Your Information",
            content: "PHI stored in our platform is used exclusively for: providing clinical documentation services to your ABA therapy provider, generating reports and summaries requested by your provider, supporting billing and insurance authorization processes, and maintaining audit logs for compliance purposes. We do not sell, rent, or share your PHI with third parties for marketing purposes.",
          },
          {
            title: "How We Protect Your Information",
            content: "We implement the following safeguards: all data is encrypted in transit using TLS 1.2+, all data is encrypted at rest using AES-256 encryption, access is controlled through role-based permissions (only authorized staff see your records), all PHI access is logged with timestamps and user identifiers, automatic session timeouts prevent unauthorized access on unattended devices, and each clinic's data is completely isolated from other organizations.",
          },
          {
            title: "Your Rights",
            content: "You have the right to: request access to your PHI, request corrections to inaccurate information, request restrictions on how your information is used, receive an accounting of disclosures, and request a copy of this notice. To exercise these rights, contact your ABA therapy provider directly.",
          },
          {
            title: "Business Associate Agreements",
            content: "All ABA clinics using our platform sign a Business Associate Agreement (BAA) during account setup. This agreement requires clinics to use our platform only for lawful purposes and to comply with HIPAA regulations.",
          },
          {
            title: "Data Retention",
            content: "PHI is retained as long as your therapy provider maintains an active account with us. Upon account termination, data is retained for 7 years in accordance with HIPAA requirements, then securely deleted. Providers may request earlier deletion subject to applicable law.",
          },
          {
            title: "Breach Notification",
            content: "In the event of a breach of unsecured PHI, we will notify affected clinics within 60 days of discovery. Clinics are responsible for notifying affected patients in accordance with HIPAA Breach Notification Rule.",
          },
          {
            title: "Contact Us",
            content: "For questions about this notice or our privacy practices, contact us at: privacy@aba-ai-assistant.com or support@aba-ai-assistant.com",
          },
        ].map((section) => (
          <div key={section.title} className="border-t border-gray-100 pt-6">
            <h2 className="text-lg font-bold text-gray-800 mb-2">{section.title}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{section.content}</p>
          </div>
        ))}

        <div className="border-t border-gray-100 pt-6 text-xs text-gray-400">
          This notice was last updated January 1, 2025. ABA AI Assistant reserves the right to update this notice. Updated versions will be posted at aba-ai-assistant.com/notice-of-privacy-practices.
        </div>
      </div>
    </main>
  );
}