import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">A</span>
            </div>
            <span className="font-bold text-gray-900">ABA AI</span>
          </Link>
          <Link href="/login" className="text-sm text-blue-600 hover:underline">Sign In</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-gray-400 text-sm mb-10">Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>

        <div className="space-y-8 text-gray-700 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using ABA AI (&ldquo;the Service&rdquo;), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service. These terms apply to all users including clinic administrators, clinicians, and other staff members.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">2. Description of Service</h2>
            <p>ABA AI is a clinical documentation and practice management platform designed for Applied Behavior Analysis (ABA) therapy providers. The Service includes session note documentation, goal tracking, progress reporting, time tracking, staff management, and related tools.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">3. Account Registration</h2>
            <p>You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. You must notify us immediately of any unauthorized use of your account.</p>
            <p className="mt-2">Each clinic is responsible for managing access for its staff members and ensuring all users comply with these Terms of Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">4. Acceptable Use</h2>
            <p>You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree not to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Use the Service in any way that violates applicable laws or regulations</li>
              <li>Enter false, misleading, or fraudulent clinical information</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Use the Service to store or transmit malicious code</li>
              <li>Reverse engineer or attempt to extract source code</li>
              <li>Resell or sublicense access to the Service</li>
              <li>Use the Service in a manner that could harm clients or their families</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">5. Clinical Responsibility</h2>
            <p>ABA AI is a documentation tool and does not provide clinical advice, diagnosis, or treatment recommendations. All clinical decisions remain the sole responsibility of the licensed professionals using the Service.</p>
            <p className="mt-2">AI-generated content (including progress reports and session note suggestions) is provided as a writing aid only and must be reviewed, verified, and approved by a qualified clinician before use in official records.</p>
            <p className="mt-2">You are responsible for ensuring that your use of the Service complies with all applicable professional licensing requirements, clinical practice standards, and payer guidelines.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">6. HIPAA and Privacy</h2>
            <p>By using the Service to store Protected Health Information (PHI), you agree to execute a Business Associate Agreement (BAA) with ABA AI. The BAA is presented during onboarding and governs the handling of PHI.</p>
            <p className="mt-2">You are responsible for obtaining all necessary patient authorizations and consents required by HIPAA and applicable state law before entering PHI into the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">7. Subscription and Billing</h2>
            <p>Access to certain features requires a paid subscription. Subscription fees are billed in advance on a monthly or annual basis. All fees are non-refundable except as required by law or as stated in our refund policy.</p>
            <p className="mt-2">We reserve the right to change pricing with 30 days&apos; notice. Continued use after a price change constitutes acceptance of the new pricing.</p>
            <p className="mt-2">Free plan limitations apply as described on our pricing page. We reserve the right to modify free plan features at any time.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">8. Data Ownership</h2>
            <p>You retain ownership of all data you enter into the Service, including client records and clinical documentation. By using the Service, you grant ABA AI a limited license to store, process, and display your data as necessary to provide the Service.</p>
            <p className="mt-2">We will not access your clinical data except as necessary to provide technical support, maintain the Service, or comply with legal obligations.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">9. Intellectual Property</h2>
            <p>The ABA AI platform, including its software, design, and features, is owned by ABA AI and protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works based on the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">10. Termination</h2>
            <p>You may cancel your account at any time. We may suspend or terminate your account for violation of these Terms, non-payment, or other reasons at our discretion with reasonable notice.</p>
            <p className="mt-2">Upon termination, you may request an export of your data within 30 days. After 30 days, we may delete your data in accordance with our retention policies and your BAA.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">11. Disclaimers</h2>
            <p>The Service is provided &ldquo;as is&rdquo; without warranties of any kind. We do not warrant that the Service will be uninterrupted, error-free, or completely secure. We are not responsible for any clinical outcomes resulting from use of the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">12. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, ABA AI shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of data, revenue, or clinical records, arising from your use of the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">13. Changes to Terms</h2>
            <p>We may update these Terms of Service at any time. We will notify you of material changes via email or platform notification. Continued use of the Service after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">14. Contact</h2>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <p className="font-medium text-gray-800">ABA AI</p>
              <p>Email: <a href="mailto:legal@abaai.app" className="text-blue-600 hover:underline">legal@abaai.app</a></p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-100 flex gap-4 text-sm text-gray-400">
          <Link href="/privacy" className="hover:text-gray-600">Privacy Policy</Link>
          <Link href="/hipaa" className="hover:text-gray-600">HIPAA Policy</Link>
          <Link href="/" className="hover:text-gray-600">Home</Link>
        </div>
      </div>
    </div>
  );
}