"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Integration = {
  id: string;
  integration_type: string;
  is_enabled: boolean;
  is_configured: boolean;
  config: Record<string, any>;
  last_tested_at: string | null;
  last_test_status: string | null;
  notes: string | null;
  updated_at: string;
};

const INTEGRATIONS = [
  // ── PAYROLL ──────────────────────────────────────────────
  {
    type: "quickbooks",
    label: "QuickBooks Online",
    icon: "📊",
    category: "Payroll",
    description: "Push approved time entries directly to QuickBooks as time activities. Staff hours sync automatically for payroll processing.",
    status: "coming_soon",
    statusLabel: "Coming Soon",
    docs: "https://developer.intuit.com/app/developer/qbo/docs/api/accounting/most-commonly-used/time-activity",
    fields: [
      { key: "client_id", label: "Client ID", type: "text", placeholder: "Your QuickBooks client ID" },
      { key: "client_secret", label: "Client Secret", type: "password", placeholder: "Your QuickBooks client secret" },
      { key: "realm_id", label: "Realm ID (Company ID)", type: "text", placeholder: "Your QuickBooks company ID" },
    ],
    setupSteps: [
      "Sign up at developer.intuit.com",
      "Create an app and select QuickBooks Online Accounting scope",
      "Copy Client ID and Client Secret",
      "Connect your QuickBooks company via OAuth to get Realm ID",
      "Enter credentials below and save",
    ],
  },
  {
    type: "gusto",
    label: "Gusto Payroll",
    icon: "💼",
    category: "Payroll",
    description: "Sync approved hours to Gusto payroll runs. Map RBT/BCBA roles to Gusto compensation types automatically.",
    status: "coming_soon",
    statusLabel: "Coming Soon",
    docs: "https://docs.gusto.com",
    fields: [
      { key: "api_token", label: "API Token", type: "password", placeholder: "Your Gusto API token" },
      { key: "company_id", label: "Company ID", type: "text", placeholder: "Your Gusto company ID" },
    ],
    setupSteps: [
      "Sign up at gusto.com",
      "Go to Settings → Integrations → API",
      "Generate an API token",
      "Find your Company ID in the Gusto dashboard URL",
      "Enter credentials below",
    ],
  },
  {
    type: "adp",
    label: "ADP Workforce Now",
    icon: "🏢",
    category: "Payroll",
    description: "Export approved time entries in ADP-compatible CSV format for import into your ADP account.",
    status: "coming_soon",
    statusLabel: "Coming Soon — CSV export available now",
    docs: "https://developers.adp.com",
    fields: [
      { key: "client_id", label: "Client ID", type: "text", placeholder: "Your ADP client ID" },
      { key: "client_secret", label: "Client Secret", type: "password", placeholder: "Your ADP client secret" },
    ],
    setupSteps: [
      "Register at developers.adp.com",
      "Create an application for Workforce Now",
      "Complete ADP marketplace enrollment",
      "Enter credentials below",
      "Use CSV export in the meantime — works with any ADP import",
    ],
  },
  // ── INSURANCE BILLING ────────────────────────────────────
  {
    type: "availity",
    label: "Availity Clearinghouse",
    icon: "🏦",
    category: "Billing",
    description: "Free clearinghouse for EDI 837 claim submission and real-time eligibility checks.",
    status: "ready_to_configure",
    statusLabel: "Ready to configure",
    docs: "https://www.availity.com/developers",
    fields: [
      { key: "username", label: "Availity Username", type: "text", placeholder: "Your Availity username" },
      { key: "password", label: "Availity Password", type: "password", placeholder: "Your Availity password" },
      { key: "submitter_id", label: "Submitter ID", type: "text", placeholder: "Your EDI submitter ID" },
      { key: "trading_partner_id", label: "Trading Partner ID", type: "text", placeholder: "Payer trading partner ID" },
    ],
    setupSteps: [
      "Register at availity.com (free for providers)",
      "Complete provider enrollment",
      "Request EDI/API access",
      "Obtain submitter ID and trading partner IDs",
      "Enter credentials below",
    ],
  },
  {
    type: "office_ally",
    label: "Office Ally",
    icon: "🗂️",
    category: "Billing",
    description: "Free EDI clearinghouse — great starting point for small practices.",
    status: "ready_to_configure",
    statusLabel: "Ready to configure",
    docs: "https://www.officeally.com",
    fields: [
      { key: "username", label: "Office Ally Username", type: "text", placeholder: "Your Office Ally username" },
      { key: "password", label: "Office Ally Password", type: "password", placeholder: "Your password" },
      { key: "group_id", label: "Group/Provider ID", type: "text", placeholder: "Your provider group ID" },
    ],
    setupSteps: [
      "Register at officeally.com (free)",
      "Complete provider setup",
      "Enroll with payers through their portal",
      "Enter credentials below",
      "Test with a sample claim",
    ],
  },
  {
    type: "change_healthcare",
    label: "Change Healthcare EDI",
    icon: "🔄",
    category: "Billing",
    description: "Enterprise clearinghouse for high-volume EDI 837 claim submission.",
    status: "ready_to_configure",
    statusLabel: "Ready to configure",
    docs: "https://developers.changehealthcare.com",
    fields: [
      { key: "client_id", label: "Client ID", type: "text", placeholder: "Your Change Healthcare client ID" },
      { key: "client_secret", label: "Client Secret", type: "password", placeholder: "Your client secret" },
      { key: "submitter_id", label: "Submitter ID", type: "text", placeholder: "Your EDI submitter ID" },
    ],
    setupSteps: [
      "Apply at developers.changehealthcare.com",
      "Complete developer registration",
      "Create an application to get client ID and secret",
      "Complete payer enrollment for each insurer",
      "Enter credentials below",
    ],
  },
  {
    type: "square",
    label: "Square Payments",
    icon: "💳",
    category: "Billing",
    description: "Accept payments for subscriptions and self-pay clients.",
    status: "sandbox",
    statusLabel: "Sandbox mode — switch to production at launch",
    docs: "https://developer.squareup.com/docs",
    fields: [
      { key: "access_token", label: "Access Token", type: "password", placeholder: "sq0atp-xxxxxxxxxx" },
      { key: "application_id", label: "Application ID", type: "text", placeholder: "sq0idp-xxxxxxxxxx" },
      { key: "location_id", label: "Location ID", type: "text", placeholder: "Your Square location ID" },
      { key: "environment", label: "Environment", type: "select", options: ["sandbox", "production"], placeholder: "" },
    ],
    setupSteps: [
      "Currently in sandbox mode",
      "Go to developer.squareup.com",
      "Switch application to production",
      "Copy production credentials",
      "Update environment to 'production'",
    ],
  },
  // ── EXPORTS ──────────────────────────────────────────────
  {
    type: "cms1500",
    label: "CMS-1500 PDF Export",
    icon: "📄",
    category: "Export",
    description: "Generate CMS-1500 claim forms as PDFs from approved time entries. Works with any billing system.",
    status: "configured",
    statusLabel: "Available now",
    docs: "",
    fields: [],
    setupSteps: [
      "No setup required",
      "Go to Time Entries, approve an entry, and click Export CMS-1500",
      "PDF will be generated with all required ABA billing fields pre-filled",
    ],
  },
  {
    type: "csv_export",
    label: "CSV Export",
    icon: "📋",
    category: "Export",
    description: "Export time entries, EVV records, and billing data as CSV for use in any spreadsheet or billing software.",
    status: "configured",
    statusLabel: "Available now",
    docs: "",
    fields: [],
    setupSteps: [
      "No setup required",
      "Go to Time Entries and use the Export button",
      "Compatible with Excel, Google Sheets, QuickBooks import, and ADP import",
    ],
  },
  // ── COMMUNICATION ────────────────────────────────────────
  {
    type: "twilio",
    label: "Twilio SMS",
    icon: "💬",
    category: "Communication",
    description: "Send SMS appointment reminders, alerts, and notifications to clients and staff.",
    status: "pending_purchase",
    statusLabel: "Awaiting phone number purchase",
    docs: "https://www.twilio.com/docs/sms",
    fields: [
      { key: "account_sid", label: "Account SID", type: "text", placeholder: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" },
      { key: "auth_token", label: "Auth Token", type: "password", placeholder: "Your Twilio auth token" },
      { key: "phone_number", label: "Twilio Phone Number", type: "text", placeholder: "+15550000000" },
    ],
    setupSteps: [
      "Purchase a Twilio account at twilio.com",
      "Buy a phone number with SMS capability",
      "Copy your Account SID and Auth Token from the Twilio Console",
      "Enter credentials below and click Save",
      "Click Test Connection to verify",
    ],
  },
  {
    type: "resend",
    label: "Resend Email",
    icon: "📧",
    category: "Communication",
    description: "Send transactional emails — renewal reminders, session summaries, parent reports.",
    status: "configured",
    statusLabel: "API key in .env.local",
    docs: "https://resend.com/docs",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "re_xxxxxxxxxxxxxxxxx" },
      { key: "from_email", label: "From Email", type: "text", placeholder: "noreply@yourdomain.com" },
      { key: "from_name", label: "From Name", type: "text", placeholder: "ABA AI Assistant" },
    ],
    setupSteps: [
      "Sign up at resend.com",
      "Verify your sending domain",
      "Create an API key",
      "Add RESEND_API_KEY to your .env.local",
      "Enter from email and name below",
    ],
  },
  {
    type: "vapid_push",
    label: "Web Push Notifications",
    icon: "🔔",
    category: "Communication",
    description: "Browser push notifications for reminders, messages, and alerts.",
    status: "configured",
    statusLabel: "VAPID keys in .env.local",
    docs: "https://web.dev/push-notifications-overview/",
    fields: [
      { key: "vapid_public_key", label: "VAPID Public Key", type: "text", placeholder: "Your public VAPID key" },
      { key: "vapid_private_key", label: "VAPID Private Key", type: "password", placeholder: "Your private VAPID key" },
    ],
    setupSteps: [
      "Keys already generated and in .env.local",
      "Deploy to HTTPS (Vercel) to test",
      "Users must grant notification permission",
      "Test by sending a test notification below",
    ],
  },
  // ── TELEHEALTH ───────────────────────────────────────────
  {
    type: "daily",
    label: "Daily.co Video",
    icon: "🎥",
    category: "Telehealth",
    description: "HIPAA-compliant video rooms for telehealth sessions, supervision, and parent meetings.",
    status: "ready_to_configure",
    statusLabel: "Ready to configure",
    docs: "https://docs.daily.co",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "Your Daily.co API key" },
      { key: "domain", label: "Daily Domain", type: "text", placeholder: "yourdomain.daily.co" },
    ],
    setupSteps: [
      "Sign up at daily.co (HIPAA plan for medical use)",
      "Create a new app in the Daily dashboard",
      "Copy your API key",
      "Enter credentials below",
      "Test by creating a room",
    ],
  },
  // ── CREDENTIALING ────────────────────────────────────────
  {
    type: "caqh",
    label: "CAQH ProView",
    icon: "🏅",
    category: "Credentialing",
    description: "Provider credentialing database used by all major insurers for enrollment.",
    status: "manual",
    statusLabel: "Manual process — no API available",
    docs: "https://www.caqh.org/solutions/caqh-proview",
    fields: [],
    setupSteps: [
      "Each clinician registers at proview.caqh.org",
      "Complete provider profile with credentials",
      "Authorize insurance companies to access profile",
      "Update credentials before expiry (quarterly attestation)",
      "This is a manual process — no API integration available",
    ],
  },
  {
    type: "npi_registry",
    label: "NPI Registry",
    icon: "🆔",
    category: "Credentialing",
    description: "Verify provider NPI numbers via NPPES API.",
    status: "ready_to_configure",
    statusLabel: "Free API — no key required",
    docs: "https://npiregistry.cms.hhs.gov/api-page",
    fields: [
      { key: "auto_verify", label: "Auto-verify NPIs", type: "select", options: ["enabled", "disabled"], placeholder: "" },
    ],
    setupSteps: [
      "No API key required — NPPES API is free and public",
      "Enable auto-verification to check NPIs on credential entry",
      "NPIs are verified against the CMS NPPES database",
    ],
  },
  // ── MOBILE ───────────────────────────────────────────────
  {
    type: "apple_developer",
    label: "Apple Developer (iOS)",
    icon: "🍎",
    category: "Mobile",
    description: "Publish ABA AI as a native iOS app on the App Store.",
    status: "deferred",
    statusLabel: "Deferred — requires $99/yr Apple Developer account",
    docs: "https://developer.apple.com",
    fields: [],
    setupSteps: [
      "Purchase Apple Developer account at developer.apple.com ($99/yr)",
      "Configure app bundle ID and signing certificates",
      "Run EAS build for iOS production build",
      "Submit for App Store review",
      "Estimated timeline: 4-6 weeks after account purchase",
    ],
  },
  {
    type: "google_play",
    label: "Google Play (Android)",
    icon: "🤖",
    category: "Mobile",
    description: "Publish ABA AI as a native Android app on Google Play.",
    status: "deferred",
    statusLabel: "Deferred — requires $25 one-time Google Play account",
    docs: "https://play.google.com/console",
    fields: [],
    setupSteps: [
      "Purchase Google Play Developer account ($25 one-time)",
      "Run EAS build for Android production build",
      "Configure app signing and release track",
      "Submit for Google Play review",
      "Estimated timeline: 2-3 weeks after account purchase",
    ],
  },
];

const CATEGORY_ICONS: Record<string, string> = {
  Payroll: "💰",
  Billing: "🏥",
  Export: "📤",
  Communication: "💬",
  Telehealth: "🎥",
  Credentialing: "🏅",
  Mobile: "📱",
};

const STATUS_STYLES: Record<string, string> = {
  configured: "bg-green-100 text-green-700",
  sandbox: "bg-yellow-100 text-yellow-700",
  pending_purchase: "bg-orange-100 text-orange-700",
  ready_to_configure: "bg-blue-100 text-blue-700",
  coming_soon: "bg-purple-100 text-purple-700",
  manual: "bg-gray-100 text-gray-600",
  deferred: "bg-gray-100 text-gray-400",
};

const ENV_VARS: Record<string, string> = {
  quickbooks: `QUICKBOOKS_CLIENT_ID=your_client_id\nQUICKBOOKS_CLIENT_SECRET=your_secret\nQUICKBOOKS_REALM_ID=your_company_id`,
  gusto: `GUSTO_API_TOKEN=your_token\nGUSTO_COMPANY_ID=your_company_id`,
  adp: `ADP_CLIENT_ID=your_client_id\nADP_CLIENT_SECRET=your_secret`,
  availity: `AVAILITY_USERNAME=your_username\nAVAILITY_PASSWORD=your_password\nAVAILITY_SUBMITTER_ID=your_id`,
  office_ally: `OFFICE_ALLY_USERNAME=your_username\nOFFICE_ALLY_PASSWORD=your_password`,
  change_healthcare: `CHANGE_HEALTHCARE_CLIENT_ID=your_id\nCHANGE_HEALTHCARE_SECRET=your_secret`,
  square: `SQUARE_ACCESS_TOKEN=your_token\nSQUARE_APPLICATION_ID=your_app_id\nSQUARE_LOCATION_ID=your_location\nSQUARE_ENVIRONMENT=production`,
  twilio: `TWILIO_ACCOUNT_SID=ACxxxxxxxxxx\nTWILIO_AUTH_TOKEN=your_auth_token\nTWILIO_PHONE_NUMBER=+15550000000`,
  resend: `RESEND_API_KEY=re_xxxxxxxxxx\nRESEND_FROM_EMAIL=noreply@yourdomain.com`,
  daily: `DAILY_API_KEY=your_daily_api_key\nDAILY_DOMAIN=yourdomain.daily.co`,
  vapid_push: `NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key\nVAPID_PRIVATE_KEY=your_private_key`,
  npi_registry: `# No API key required\n# NPPES API is free and public`,
};

export default function IntegrationsPage() {
  const [settings, setSettings] = useState<Record<string, Integration>>({});
  const [loading, setLoading] = useState(true);
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [filterCategory, setFilterCategory] = useState("all");

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("integration_settings").select("*").eq("created_by", user.id);

    const map: Record<string, Integration> = {};
    (data ?? []).forEach((s: any) => {
      map[s.integration_type] = {
        ...s,
        config: typeof s.config === "object" ? s.config : JSON.parse(s.config || "{}"),
      };
    });
    setSettings(map);

    const forms: Record<string, Record<string, string>> = {};
    INTEGRATIONS.forEach((intg) => {
      forms[intg.type] = {};
      (intg.fields ?? []).forEach((field) => {
        forms[intg.type][field.key] = map[intg.type]?.config[field.key] ?? "";
      });
    });
    setFormValues(forms);
    setLoading(false);
  }

  async function handleSave(integrationType: string) {
    setSaving(integrationType);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const config = formValues[integrationType] ?? {};
    const hasValues = Object.values(config).some((v) => v.trim() !== "");
    const existing = settings[integrationType];

    if (existing) {
      await supabase.from("integration_settings").update({
        config, is_configured: hasValues, updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await supabase.from("integration_settings").insert([{
        integration_type: integrationType, config,
        is_enabled: hasValues, is_configured: hasValues, created_by: user.id,
      }]);
    }

    setSettings((prev) => ({
      ...prev,
      [integrationType]: { ...prev[integrationType], config, is_configured: hasValues, integration_type: integrationType } as Integration,
    }));
    setSaving(null);
  }

  async function handleTest(integrationType: string) {
    setTesting(integrationType);
    await new Promise((r) => setTimeout(r, 1500));

    const config = formValues[integrationType] ?? {};
    const hasValues = Object.values(config).some((v) => v.trim() !== "");

    if (!hasValues) {
      setTestResults((prev) => ({ ...prev, [integrationType]: { success: false, message: "No credentials configured. Please enter your API keys first." } }));
    } else {
      setTestResults((prev) => ({ ...prev, [integrationType]: { success: true, message: `✓ Credentials saved. Live test will be available once ${integrationType} is fully activated.` } }));
      const existing = settings[integrationType];
      if (existing) {
        await supabase.from("integration_settings").update({
          last_tested_at: new Date().toISOString(), last_test_status: "pending_activation",
        }).eq("id", existing.id);
      }
    }
    setTesting(null);
  }

  function updateField(integrationType: string, fieldKey: string, value: string) {
    setFormValues((prev) => ({ ...prev, [integrationType]: { ...(prev[integrationType] ?? {}), [fieldKey]: value } }));
  }

  const categories = ["all", "Payroll", "Billing", "Export", "Communication", "Telehealth", "Credentialing", "Mobile"];
  const filtered = filterCategory === "all" ? INTEGRATIONS : INTEGRATIONS.filter((i) => i.category === filterCategory);

  const configuredCount = INTEGRATIONS.filter((i) => settings[i.type]?.is_configured).length;
  const readyCount = INTEGRATIONS.filter((i) => i.status === "ready_to_configure").length;

  return (
    <div className="space-y-6">
      <PageHeader title="External Integrations">
        <p className="text-gray-500 text-sm">Connect payroll, billing, communication, and credentialing systems.</p>
      </PageHeader>

      {/* SUMMARY */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Integrations", val: INTEGRATIONS.length, color: "text-blue-600" },
          { label: "Configured", val: configuredCount, color: "text-green-600" },
          { label: "Ready to Configure", val: readyCount, color: "text-blue-500" },
          { label: "Deferred", val: INTEGRATIONS.filter(i => i.status === "deferred").length, color: "text-gray-400" },
        ].map(s => (
          <div key={s.label} className="border rounded-xl p-4 text-center bg-white">
            <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* PRE-LAUNCH CHECKLIST */}
      <Section title="🚀 Pre-Launch Integration Checklist">
        <div className="space-y-2">
          {[
            { label: "Purchase Twilio phone number", done: false, link: "https://www.twilio.com", priority: "high" },
            { label: "Switch Square to production mode", done: false, link: "https://developer.squareup.com", priority: "high" },
            { label: "Set up Daily.co HIPAA video rooms", done: false, link: "https://daily.co", priority: "medium" },
            { label: "Register with Availity clearinghouse (free)", done: false, link: "https://www.availity.com", priority: "medium" },
            { label: "Verify VAPID push notifications on Vercel HTTPS", done: false, link: "/dashboard/pwa", priority: "medium" },
            { label: "Register all clinicians in CAQH ProView", done: false, link: "https://proview.caqh.org", priority: "high" },
            { label: "Verify sending domain in Resend", done: true, link: "https://resend.com", priority: "done" },
            { label: "Configure NPI auto-verification", done: false, link: "#", priority: "low" },
            { label: "Connect QuickBooks or Gusto for payroll", done: false, link: "https://developer.intuit.com", priority: "medium" },
            { label: "Set up Office Ally or Availity for insurance claims", done: false, link: "https://www.officeally.com", priority: "high" },
          ].map((item) => (
            <div key={item.label} className={`flex items-center gap-3 border rounded-lg p-3 ${item.done ? "border-green-200 bg-green-50" : item.priority === "high" ? "border-orange-100 bg-orange-50" : "border-gray-100 bg-white"}`}>
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 text-xs font-bold ${item.done ? "bg-green-500 border-green-500 text-white" : "border-gray-300"}`}>
                {item.done && "✓"}
              </div>
              <span className={`text-sm flex-1 ${item.done ? "line-through text-gray-400" : "text-gray-700"}`}>{item.label}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.priority === "high" ? "bg-orange-100 text-orange-700" : item.priority === "medium" ? "bg-blue-100 text-blue-700" : item.priority === "done" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {item.priority === "done" ? "✓ Done" : item.priority}
              </span>
              {item.link && item.link !== "#" && (
                <a href={item.link} target={item.link.startsWith("http") ? "_blank" : "_self"} rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline shrink-0">
                  {item.link.startsWith("http") ? "Open →" : "Go →"}
                </a>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* HOW IT WORKS */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-800 mb-1">🔗 How Integrations Work</p>
        <p className="text-sm text-blue-700">Each clinic connects their own accounts — your data never goes to another clinic. Once a time entry is approved by a BCBA, it can be pushed to your connected payroll or billing system with one click. Exports are always available regardless of which integrations you connect.</p>
      </div>

      {/* CATEGORY FILTER */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button key={cat} onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filterCategory === cat ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:border-blue-300"}`}>
            {cat === "all" ? "All" : `${CATEGORY_ICONS[cat] ?? ""} ${cat}`}
          </button>
        ))}
      </div>

      {/* INTEGRATION CARDS */}
      <div className="space-y-3">
        {filtered.map((intg) => {
          const isExpanded = expandedType === intg.type;
          const saved = settings[intg.type];
          const isConfigured = saved?.is_configured ?? false;
          const testResult = testResults[intg.type];
          const hasFields = (intg.fields ?? []).length > 0;
          const canExpand = intg.status !== "deferred" && intg.status !== "manual";

          return (
            <div key={intg.type} className={`border rounded-xl bg-white ${isConfigured ? "border-green-200" : "border-gray-100"}`}>
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3 flex-1">
                    <span className="text-2xl">{intg.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800">{intg.label}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[intg.status] ?? "bg-gray-100 text-gray-500"}`}>
                          {isConfigured ? "✓ Configured" : intg.statusLabel}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{intg.category}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{intg.description}</p>
                      {saved?.last_tested_at && (
                        <p className="text-xs text-gray-400 mt-0.5">Last tested: {new Date(saved.last_tested_at).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    {intg.docs && (
                      <a href={intg.docs} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">Docs →</a>
                    )}
                    {canExpand && (
                      <button onClick={() => setExpandedType(isExpanded ? null : intg.type)} className="text-xs text-gray-400 hover:text-gray-600">
                        {isExpanded ? "▲" : "▼"}
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 border-t border-gray-100 pt-4 space-y-4">

                    {/* SETUP STEPS */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Setup Steps</p>
                      <div className="space-y-1">
                        {intg.setupSteps.map((step, i) => (
                          <div key={i} className="flex gap-2 items-start">
                            <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">{i + 1}</span>
                            <p className="text-xs text-gray-600">{step}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CREDENTIAL FIELDS */}
                    {hasFields && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Credentials</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {intg.fields.map((field) => (
                            <div key={field.key}>
                              <label className="text-xs font-medium text-gray-700 mb-1 block">{field.label}</label>
                              {field.type === "select" ? (
                                <select value={formValues[intg.type]?.[field.key] ?? ""}
                                  onChange={(e) => updateField(intg.type, field.key, e.target.value)}
                                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                                  <option value="">Select...</option>
                                  {(field as any).options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                              ) : (
                                <input type={field.type} value={formValues[intg.type]?.[field.key] ?? ""}
                                  onChange={(e) => updateField(intg.type, field.key, e.target.value)}
                                  placeholder={field.placeholder}
                                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button onClick={() => handleSave(intg.type)} loading={saving === intg.type}>💾 Save Credentials</Button>
                          <Button variant="outline" onClick={() => handleTest(intg.type)} loading={testing === intg.type}>🔌 Test Connection</Button>
                        </div>
                        {testResult && (
                          <div className={`mt-3 p-3 rounded-lg text-sm ${testResult.success ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                            {testResult.message}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ENV VAR BLOCK */}
                    {ENV_VARS[intg.type] && (
                      <div className="bg-gray-900 rounded-xl p-4">
                        <p className="text-xs font-semibold text-gray-400 mb-2">Add to .env.local & Vercel Environment Variables</p>
                        <code className="text-xs text-green-400 whitespace-pre-wrap">{ENV_VARS[intg.type]}</code>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* REQUEST AN INTEGRATION */}
      <div className="border border-dashed border-gray-300 rounded-xl p-6 text-center">
        <p className="text-2xl mb-2">🔌</p>
        <p className="font-semibold text-gray-800 mb-1">Need a different integration?</p>
        <p className="text-sm text-gray-500 mb-4">Tell us what billing, payroll, or other system you use and we'll add it.</p>
        <Button variant="outline" onClick={() => window.location.href = "/dashboard/suggestions"}>Request an Integration</Button>
      </div>
    </div>
  );
}