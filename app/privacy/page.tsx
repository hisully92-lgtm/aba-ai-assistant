import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — ABA AI Assistant",
  description:
    "Read ABA AI Assistant's privacy policy. We protect your clinic's data and your clients' PHI with enterprise-grade security and HIPAA compliance.",
  openGraph: {
    title: "Privacy Policy — ABA AI Assistant",
    url: "https://aba-ai-assistant.com/privacy",
  },
};

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-gray-400 text-sm mb-10">
          Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">1. Introduction</h2>
            <p>ABA AI (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is committed to protecting your privacy and the privacy of your clients. This Privacy Policy explains how we collect, use, disclose, and safeguard information when you use our platform.</p>
            <p className="mt-2">As a platform used by healthcare providers, we are subject to the Health Insurance Portability and Accountability Act (HIPAA) and take our obligations seriously.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">2. Information We Collect</h2>
            <p className="font-medium text-gray-800 mb-1">Account Information</p>
            <p>When you create an account, we collect your name, email address, professional role, and clinic information.</p>
            <p className="font-medium text-gray-800 mb-1 mt-3">Clinical Data (Protected Health Information)</p>
            <p>If you enter client data, session notes, goals, or other clinical information, this constitutes Protected Health Information (PHI) under HIPAA. This data is encrypted at rest and in transit and is only accessible to authorized members of your clinic.</p>
            <p className="font-medium text-gray-800 mb-1 mt-3">Usage Data</p>
            <p>We collect information about how you use the platform including pages visited, features used, and session duration. This data is used to improve the service and is never sold to third parties.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>To provide, operate, and maintain the ABA AI platform</li>
              <li>To process billing and manage your subscription</li>
              <li>To send important service notifications and updates</li>
              <li>To provide customer support</li>
              <li>To improve and develop new features</li>
              <li>To comply with legal obligations</li>
            </ul>
            <p className="mt-3">We do not sell, rent, or share your personal information or your clients&apos; PHI with third parties for marketing purposes.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">4. HIPAA Compliance</h2>
            <p>ABA AI acts as a Business Associate under HIPAA. We enter into a Business Associate Agreement (BAA) with each covered entity (clinic) that uses our platform. Our HIPAA safeguards include:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>End-to-end encryption for all PHI in transit (TLS 1.2+)</li>
              <li>Encryption at rest for all stored PHI</li>
              <li>Role-based access controls limiting PHI access to authorized users</li>
              <li>Audit logging of all PHI access and modifications</li>
              <li>Automatic session timeouts</li>
              <li>Breach notification procedures within HIPAA-required timelines</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">5. Data Retention</h2>
            <p>We retain your account data for as long as your account is active or as needed to provide services. Clinical data is retained according to your clinic&apos;s configuration and applicable state and federal record retention requirements.</p>
            <p className="mt-2">Upon account termination, you may request export of your data. PHI will be deleted or returned per the terms of your BAA.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">6. Data Security</h2>
            <p>We implement industry-standard security measures including:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Secure cloud infrastructure hosted on Supabase and Vercel</li>
              <li>Regular security assessments and penetration testing</li>
              <li>Employee security training and access controls</li>
              <li>Incident response procedures</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">7. Your Rights</h2>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>The right to access your personal data</li>
              <li>The right to correct inaccurate data</li>
              <li>The right to request deletion of your data</li>
              <li>The right to data portability</li>
              <li>The right to opt out of certain data processing</li>
            </ul>
            <p className="mt-3">To exercise these rights, contact us at <a href="mailto:privacy@aba-ai-assistant.com" className="text-blue-600 hover:underline">privacy@aba-ai-assistant.com</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">8. Cookies</h2>
            <p>We use essential cookies to maintain your session and authentication state. We do not use tracking cookies or third-party advertising cookies.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">9. SMS Communications</h2>

              <p>ABA AI Assistant may send SMS text messages to users who have opted in to receive notifications. By opting in, you consent to receive text messages including session reminders, appointment alerts, and clinic notifications.</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>We will never share or sell your mobile phone number to third parties</li>
                <li>Message frequency varies based on your clinic activity</li>
                <li>Message and data rates may apply</li>
                <li>To opt out, reply STOP to any message</li>
                <li>To get help, reply HELP to any message</li>
                <li>You can also opt out by updating your notification settings in the platform</li>
              </ul>

            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">10. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes via email or a prominent notice on the platform. Continued use of the platform after changes constitutes acceptance of the updated policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">10. Contact Us</h2>
            <div className="mt-2 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <p className="font-medium text-gray-800">ABA AI Assistant</p>
              <p>Email: <a href="mailto:privacy@aba-ai-assistant.com" className="text-blue-600 hover:underline">privacy@aba-ai-assistant.com</a></p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-100 flex gap-4 text-sm text-gray-400">
          <Link href="/terms" className="hover:text-gray-600">Terms of Service</Link>
          <Link href="/hipaa" className="hover:text-gray-600">HIPAA Policy</Link>
          <Link href="/" className="hover:text-gray-600">Home</Link>
        </div>
      </div>
    </div>
  );
}