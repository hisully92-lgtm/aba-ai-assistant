import Link from "next/link";

export default function HipaaPage() {
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
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold mb-6">
          🔒 HIPAA Compliant Platform
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">HIPAA Compliance</h1>
        <p className="text-gray-400 text-sm mb-10">Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>

        <div className="space-y-8 text-gray-700 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Our HIPAA Commitment</h2>
            <p>ABA AI is built from the ground up for healthcare providers in the ABA therapy space. We understand that the data you enter into our platform is among the most sensitive information that exists — it involves children, families, and clinical diagnoses. We take that responsibility seriously.</p>
            <p className="mt-2">ABA AI operates as a HIPAA Business Associate, and we execute a Business Associate Agreement (BAA) with every clinic that uses our platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Business Associate Agreement (BAA)</h2>
            <p>A BAA is required under HIPAA whenever a covered entity shares PHI with a vendor or service provider. ABA AI&apos;s BAA is presented electronically during clinic onboarding and includes:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Permitted uses and disclosures of PHI</li>
              <li>Our obligation to implement appropriate safeguards</li>
              <li>Breach notification requirements (within 60 days of discovery)</li>
              <li>Provisions for return or destruction of PHI upon termination</li>
              <li>Obligations of our subcontractors and agents</li>
            </ul>
            <p className="mt-3">The BAA is electronically signed by an authorized representative of your clinic during account setup and stored in your account records.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Technical Safeguards</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              {[
                { icon: "🔐", title: "Encryption in Transit", desc: "All data transmitted between your device and our servers is encrypted using TLS 1.2 or higher." },
                { icon: "💾", title: "Encryption at Rest", desc: "All PHI stored in our database is encrypted at rest using AES-256 encryption." },
                { icon: "👤", title: "Access Controls", desc: "Role-based access ensures staff only see what they need. Clinic data is fully isolated from other organizations." },
                { icon: "📋", title: "Audit Logging", desc: "All access to PHI is logged with timestamps, user IDs, and action types for compliance review." },
                { icon: "🏢", title: "Clinic Isolation", desc: "Each clinic's data is logically separated. No user can access data from another clinic." },
                { icon: "🔑", title: "Secure Authentication", desc: "Magic link authentication eliminates password reuse risks. Session tokens expire automatically." },
              ].map(item => (
                <div key={item.title} className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{item.icon}</span>
                    <p className="font-semibold text-gray-800 text-sm">{item.title}</p>
                  </div>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Administrative Safeguards</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Designated HIPAA Privacy and Security Officers</li>
              <li>Regular workforce training on HIPAA requirements</li>
              <li>Access management procedures for hiring and termination</li>
              <li>Periodic risk assessments and security reviews</li>
              <li>Incident response and breach notification procedures</li>
              <li>Vendor and subcontractor management with BAA requirements</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Physical Safeguards</h2>
            <p>ABA AI is hosted on Supabase and Vercel infrastructure which maintains SOC 2 Type II compliance. Physical safeguards for our infrastructure include:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Data centers with physical access controls and security monitoring</li>
              <li>Redundant systems to ensure data availability</li>
              <li>Secure data destruction procedures</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Breach Notification</h2>
            <p>In the event of a breach involving PHI, ABA AI will:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Notify affected covered entities within 60 days of discovery</li>
              <li>Provide details about the nature and scope of the breach</li>
              <li>Describe what information was involved</li>
              <li>Outline steps taken to contain the breach and prevent recurrence</li>
              <li>Cooperate fully with any regulatory investigations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Your Responsibilities</h2>
            <p>As a covered entity using ABA AI, your clinic is responsible for:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Obtaining required patient authorizations before entering PHI</li>
              <li>Managing staff access and promptly revoking access upon termination</li>
              <li>Using strong, unique passwords and protecting login credentials</li>
              <li>Reporting suspected breaches or security incidents to us promptly</li>
              <li>Complying with your own HIPAA obligations as a covered entity</li>
              <li>Ensuring devices used to access ABA AI are appropriately secured</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Questions & HIPAA Contact</h2>
            <p>For HIPAA-related questions, to request a copy of our BAA, or to report a potential security incident:</p>
            <div className="mt-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <p className="font-medium text-gray-800">ABA AI HIPAA Compliance Team</p>
              <p className="mt-1">Email: <a href="mailto:hipaa@abaai.app" className="text-blue-600 hover:underline">hipaa@abaai.app</a></p>
              <p className="mt-1 text-xs text-gray-500">We respond to all HIPAA inquiries within 2 business days.</p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-100 flex gap-4 text-sm text-gray-400">
          <Link href="/privacy" className="hover:text-gray-600">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-gray-600">Terms of Service</Link>
          <Link href="/" className="hover:text-gray-600">Home</Link>
        </div>
      </div>
    </div>
  );
}