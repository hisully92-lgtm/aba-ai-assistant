"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";

type TelehealthConfig = {
  id?: string;
  platform: string;
  is_active: boolean;
  use_hosted: boolean;
  api_key: string;
  domain: string;
  room_url: string;
  notes: string;
};

const PLATFORMS = [
  {
    id: "daily",
    name: "Daily.co",
    icon: "🎥",
    desc: "API-based HIPAA-compliant video rooms embedded directly in ABA AI Assistant. Best for a seamless in-app experience.",
    hipaa: true,
    baa: "Requires $500/mo HIPAA plan",
    pricing: "$0.004/participant/min — 10,000 free minutes/month",
    hosted: true,
    fields: [
      { key: "api_key", label: "Daily.co API Key", type: "password", placeholder: "Your Daily.co API key" },
      { key: "domain", label: "Daily Domain", type: "text", placeholder: "yourname.daily.co" },
    ],
    setupUrl: "https://dashboard.daily.co",
    docs: "https://docs.daily.co",
  },
  {
    id: "doxy",
    name: "Doxy.me",
    icon: "🏥",
    desc: "Browser-based telehealth built for healthcare. Free plan available with BAA. Patients join via a simple link — no downloads.",
    hipaa: true,
    baa: "Free BAA on all plans",
    pricing: "Free plan available · Paid from $29/provider/month",
    hosted: false,
    fields: [
      { key: "room_url", label: "Your Doxy.me Room URL", type: "text", placeholder: "https://doxy.me/yourname" },
    ],
    setupUrl: "https://doxy.me",
    docs: "https://help.doxy.me",
  },
  {
    id: "zoom",
    name: "Zoom for Healthcare",
    icon: "📹",
    desc: "Familiar Zoom interface with HIPAA compliance. Must be on the Zoom for Healthcare plan — standard Zoom is NOT compliant.",
    hipaa: true,
    baa: "Zoom for Healthcare plan required",
    pricing: "Contact Zoom for Healthcare pricing",
    hosted: false,
    fields: [
      { key: "room_url", label: "Personal Meeting Room URL", type: "text", placeholder: "https://zoom.us/j/your-meeting-id" },
      { key: "api_key", label: "Zoom API Key (optional)", type: "password", placeholder: "For programmatic room creation" },
      { key: "domain", label: "Zoom Account Domain", type: "text", placeholder: "yourorg.zoom.us" },
    ],
    setupUrl: "https://zoom.us/healthcare",
    docs: "https://marketplace.zoom.us/docs",
  },
  {
    id: "vsee",
    name: "VSee",
    icon: "🔵",
    desc: "HIPAA and BAA-certified telehealth with white-label options. Supports custom subdomains, waiting rooms, and SMS notifications.",
    hipaa: true,
    baa: "BAA included",
    pricing: "Free basic plan · Premium from $49/month + $200 setup",
    hosted: false,
    fields: [
      { key: "room_url", label: "VSee Clinic URL", type: "text", placeholder: "https://vsee.com/yourname" },
      { key: "api_key", label: "VSee API Key (optional)", type: "password", placeholder: "For VSee Clinic API" },
    ],
    setupUrl: "https://vsee.com",
    docs: "https://vsee.com/vseehealth",
  },
  {
    id: "goto",
    name: "GoTo Meeting",
    icon: "🟢",
    desc: "HIPAA-compliant conferencing with AI summaries, multi-channel communication, and workflow automation.",
    hipaa: true,
    baa: "BAA available on paid plans",
    pricing: "Quote-based — contact GoTo for healthcare pricing",
    hosted: false,
    fields: [
      { key: "room_url", label: "GoTo Meeting Room URL", type: "text", placeholder: "https://meet.goto.com/yourroom" },
      { key: "api_key", label: "GoTo API Key (optional)", type: "password", placeholder: "For programmatic scheduling" },
    ],
    setupUrl: "https://www.goto.com/meeting",
    docs: "https://developer.goto.com",
  },
];

const emptyConfig = (platform: string): TelehealthConfig => ({
  platform,
  is_active: false,
  use_hosted: false,
  api_key: "",
  domain: "",
  room_url: "",
  notes: "",
});

export default function TelehealthSettingsPage() {
  const [configs, setConfigs] = useState<Record<string, TelehealthConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>("daily");
  const [companyId, setCompanyId] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data: cu } = await supabase.from("company_users")
      .select("company_id").eq("user_id", user.id)
      .eq("status", "active").limit(1).maybeSingle();

    if (!cu?.company_id) return;
    setCompanyId(cu.company_id);

    const { data } = await supabase.from("company_telehealth_config")
      .select("*").eq("company_id", cu.company_id);

    const map: Record<string, TelehealthConfig> = {};
    (data ?? []).forEach((row: any) => {
      map[row.platform] = {
        id: row.id,
        platform: row.platform,
        is_active: row.is_active,
        use_hosted: row.use_hosted,
        api_key: row.api_key ?? "",
        domain: row.domain ?? "",
        room_url: row.room_url ?? "",
        notes: row.notes ?? "",
      };
    });
    setConfigs(map);
    setLoading(false);
  }

  async function handleSave(platformId: string) {
    setSaving(platformId);
    const config = configs[platformId] ?? emptyConfig(platformId);

    const payload = {
      company_id: companyId,
      platform: platformId,
      is_active: config.is_active,
      use_hosted: config.use_hosted,
      api_key: config.api_key || null,
      domain: config.domain || null,
      room_url: config.room_url || null,
      notes: config.notes || null,
      updated_at: new Date().toISOString(),
    };

    if (config.id) {
      await supabase.from("company_telehealth_config").update(payload).eq("id", config.id);
    } else {
      const { data } = await supabase.from("company_telehealth_config").insert(payload).select().single();
      if (data) {
        setConfigs(prev => ({ ...prev, [platformId]: { ...config, id: data.id } }));
      }
    }

    setSaving(null);
    setSaved(platformId);
    setTimeout(() => setSaved(null), 2000);
  }

  function updateConfig(platformId: string, field: string, value: any) {
    setConfigs(prev => ({
      ...prev,
      [platformId]: { ...(prev[platformId] ?? emptyConfig(platformId)), [field]: value },
    }));
  }

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;

  const activePlatform = PLATFORMS.find(p => configs[p.id]?.is_active);

  return (
    <div className="space-y-6">
      <PageHeader title="Telehealth Settings" />

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">🎥 Choose your telehealth platform</p>
        <p className="text-xs text-blue-700">
          Each clinic can connect their own telehealth account or request ABA AI Assistant hosted video (Daily.co).
          All platforms listed below are HIPAA-compliant with signed BAAs available.
          {activePlatform && <span className="ml-1 font-semibold">Active: {activePlatform.name}</span>}
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
        <p className="font-semibold mb-1">⚖️ HIPAA Reminder</p>
        <p>All telehealth sessions involving PHI require a signed BAA with your video provider. Standard Zoom, Google Meet, FaceTime, and Skype are NOT HIPAA compliant. Only use the platforms listed here with a signed BAA in place.</p>
      </div>

      <div className="space-y-4">
        {PLATFORMS.map(platform => {
          const config = configs[platform.id] ?? emptyConfig(platform.id);
          const isExpanded = expanded === platform.id;
          const isConfigured = !!(config.api_key || config.room_url);
          const isActive = config.is_active;

          return (
            <div key={platform.id} className={`border rounded-xl bg-white transition-all ${isActive ? "border-blue-300" : isConfigured ? "border-green-200" : "border-gray-100"}`}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <span className="text-2xl">{platform.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800">{platform.name}</p>
                        {isActive && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">✓ Active</span>}
                        {isConfigured && !isActive && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Configured</span>}
                        {platform.hosted && <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">Hosted available</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{platform.desc}</p>
                      <div className="flex gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-green-600">✓ {platform.baa}</span>
                        <span className="text-xs text-gray-400">{platform.pricing}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={platform.setupUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline shrink-0">Sign up →</a>
                    <button onClick={() => setExpanded(isExpanded ? null : platform.id)}
                      className="text-gray-400 hover:text-gray-600 text-xs">
                      {isExpanded ? "▲" : "▼"}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 border-t border-gray-100 pt-4 space-y-4">

                    {/* ACTIVE TOGGLE */}
                    <div className="flex items-center justify-between border border-gray-100 rounded-lg p-3 bg-gray-50">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Set as active platform</p>
                        <p className="text-xs text-gray-400">Only one platform can be active at a time</p>
                      </div>
                      <button onClick={() => {
                        // Deactivate all others
                        const newConfigs = { ...configs };
                        PLATFORMS.forEach(p => {
                          if (p.id !== platform.id && newConfigs[p.id]) {
                            newConfigs[p.id] = { ...newConfigs[p.id], is_active: false };
                          }
                        });
                        newConfigs[platform.id] = { ...(newConfigs[platform.id] ?? emptyConfig(platform.id)), is_active: !config.is_active };
                        setConfigs(newConfigs);
                      }}
                        className={`w-12 h-6 rounded-full transition-all relative ${config.is_active ? "bg-blue-500" : "bg-gray-300"}`}>
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${config.is_active ? "left-7" : "left-1"}`} />
                      </button>
                    </div>

                    {/* HOSTED OPTION (Daily.co only) */}
                    {platform.hosted && (
                      <div className="border border-purple-100 rounded-lg p-4 bg-purple-50">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm font-semibold text-purple-800">Use ABA AI Assistant Hosted Video</p>
                            <p className="text-xs text-purple-600 mt-0.5">We manage Daily.co on your behalf. Contact us to enable. Additional fee applies.</p>
                          </div>
                          <button onClick={() => updateConfig(platform.id, "use_hosted", !config.use_hosted)}
                            className={`w-12 h-6 rounded-full transition-all relative ${config.use_hosted ? "bg-purple-500" : "bg-gray-300"}`}>
                            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${config.use_hosted ? "left-7" : "left-1"}`} />
                          </button>
                        </div>
                        {config.use_hosted && (
                          <div className="bg-white border border-purple-200 rounded-lg p-3 text-xs text-purple-700">
                            ✓ Hosted video requested. We will contact you to complete setup. In the meantime, enter your own credentials below if available.
                          </div>
                        )}
                      </div>
                    )}

                    {/* CREDENTIAL FIELDS */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your Credentials</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {platform.fields.map(field => (
                          <div key={field.key}>
                            <label className="text-xs font-medium text-gray-700 mb-1 block">{field.label}</label>
                            <input
                              type={field.type}
                              value={(config as any)[field.key] ?? ""}
                              onChange={e => updateConfig(platform.id, field.key, e.target.value)}
                              placeholder={field.placeholder}
                              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                          </div>
                        ))}
                        <div className="md:col-span-2">
                          <label className="text-xs font-medium text-gray-700 mb-1 block">Notes (optional)</label>
                          <input
                            type="text"
                            value={config.notes}
                            onChange={e => updateConfig(platform.id, "notes", e.target.value)}
                            placeholder="e.g. Used for parent training sessions only"
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 items-center">
                      <Button onClick={() => handleSave(platform.id)} loading={saving === platform.id}>
                        Save {platform.name} Settings
                      </Button>
                      <a href={platform.docs} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline">
                        View docs →
                      </a>
                      {saved === platform.id && (
                        <span className="text-xs text-green-600 font-medium">✓ Saved</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* REQUEST HOSTED */}
      <Section title="Request Hosted Telehealth">
        <p className="text-sm text-gray-600 mb-3">
          Want ABA AI Assistant to manage telehealth on your behalf? We handle Daily.co setup, HIPAA BAA, and video room creation.
          You pay a flat monthly add-on fee instead of managing your own account.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {[
            { label: "No vendor management", icon: "✓" },
            { label: "HIPAA BAA handled", icon: "✓" },
            { label: "Embedded in your app", icon: "✓" },
          ].map(item => (
            <div key={item.label} className="border border-blue-100 rounded-lg p-3 text-sm text-blue-700 bg-blue-50 flex items-center gap-2">
              <span className="font-bold">{item.icon}</span> {item.label}
            </div>
          ))}
        </div>
        <a href="mailto:hello@aba-ai-assistant.com?subject=Hosted Telehealth Request"
          className="inline-block bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
          Request Hosted Telehealth →
        </a>
      </Section>
    </div>
  );
}
