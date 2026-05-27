"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Recording = {
  id: string;
  session_id: string | null;
  room_name: string | null;
  recording_url: string | null;
  duration_seconds: number;
  consent_obtained: boolean;
  storage_provider: string;
  status: string;
  expires_at: string | null;
  created_at: string;
};

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [consentForm, setConsentForm] = useState(false);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("telehealth_recordings")
      .select("*")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

    setRecordings(data ?? []);
    setLoading(false);
  }

  async function updateConsent(id: string, consent: boolean) {
    await supabase.from("telehealth_recordings").update({ consent_obtained: consent }).eq("id", id);
    setRecordings((prev) => prev.map((r) => r.id === id ? { ...r, consent_obtained: consent } : r));
  }

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function statusColor(status: string) {
    if (status === "available") return "bg-green-100 text-green-700";
    if (status === "processing") return "bg-yellow-100 text-yellow-700";
    if (status === "expired") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-500";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Telehealth Recordings" />

      {/* LEGAL NOTICE */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <p className="text-sm font-bold text-yellow-800 mb-2">⚖️ Important Legal Notice</p>
        <div className="text-xs text-yellow-700 space-y-1">
          <p>• Recording telehealth sessions requires written informed consent from all participants including clients and/or guardians.</p>
          <p>• Laws vary by state — some require one-party consent, others require all-party consent.</p>
          <p>• All recordings must be stored in HIPAA-compliant storage and treated as Protected Health Information (PHI).</p>
          <p>• Recordings must be included in your Notice of Privacy Practices.</p>
          <p>• Consult your legal counsel and malpractice insurance before enabling session recording.</p>
        </div>
      </div>

      {/* SETUP STEPS */}
      <Section title="🔌 Recording Setup (Daily.co)">
        <div className="space-y-3">
          {[
            { step: "1", text: "Sign up for a Daily.co HIPAA-compliant plan (required for session recording)", link: "https://daily.co", status: "pending" },
            { step: "2", text: "Enable cloud recording in your Daily.co dashboard settings", link: null, status: "pending" },
            { step: "3", text: "Add DAILY_API_KEY to your Vercel environment variables", link: null, status: "pending" },
            { step: "4", text: "Configure recording retention period (default: 7 days for HIPAA)", link: null, status: "pending" },
            { step: "5", text: "Obtain written consent from clients/guardians before recording any session", link: null, status: "required" },
            { step: "6", text: "Document consent in client records and link to recording", link: null, status: "required" },
          ].map((item) => (
            <div key={item.step} className={`flex items-center gap-3 border rounded-lg p-3 ${item.status === "required" ? "border-orange-200 bg-orange-50" : "border-gray-100 bg-white"}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${item.status === "required" ? "bg-orange-500 text-white" : "bg-blue-100 text-blue-600"}`}>
                {item.step}
              </span>
              <p className={`text-sm flex-1 ${item.status === "required" ? "text-orange-700 font-medium" : "text-gray-600"}`}>
                {item.text}
              </p>
              {item.link && (
                <a href={item.link} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline shrink-0">Open →</a>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 bg-gray-900 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-400 mb-2">Add to .env.local & Vercel</p>
          <code className="text-xs text-green-400 whitespace-pre">{`DAILY_API_KEY=your_daily_api_key
DAILY_DOMAIN=yourname.daily.co
DAILY_RECORDING_RETENTION_DAYS=7`}</code>
        </div>
      </Section>

      {/* CONSENT TEMPLATE */}
      <Section title="📄 Consent Form Template">
        <Button variant="outline" onClick={() => setConsentForm(!consentForm)}>
          {consentForm ? "Hide Template" : "View Consent Template"}
        </Button>

        {consentForm && (
          <div className="mt-4 border border-gray-200 rounded-xl p-4 bg-gray-50 text-sm text-gray-700 space-y-3">
            <p className="font-bold text-gray-800">TELEHEALTH SESSION RECORDING CONSENT</p>
            <p>I, the undersigned, hereby provide consent for my/my child's ABA therapy sessions conducted via telehealth to be recorded for the following purposes:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Clinical supervision and quality assurance</li>
              <li>Treatment planning and progress review</li>
              <li>Staff training (with identifying information removed)</li>
            </ul>
            <p>I understand that:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Recordings will be stored securely and treated as Protected Health Information</li>
              <li>Recordings will be retained for [X] days and then deleted</li>
              <li>I may withdraw this consent at any time in writing</li>
              <li>Declining consent will not affect the quality of services provided</li>
            </ul>
            <p className="text-xs text-gray-400 mt-2">
              Customize this template with your organization's name, retention policy, and legal counsel review before use.
            </p>
            <Button variant="outline" onClick={() => {
              const text = document.querySelector(".consent-text")?.textContent ?? "";
              navigator.clipboard.writeText(text);
            }}>
              📋 Copy Template
            </Button>
          </div>
        )}
      </Section>

      {/* RECORDINGS LIST */}
      <Section title={`Recordings (${recordings.length})`}>
        {loading && <p className="text-gray-400 text-sm">Loading...</p>}
        {!loading && recordings.length === 0 && (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">🎥</p>
            <p className="text-gray-500 text-sm">No recordings yet.</p>
            <p className="text-gray-400 text-xs mt-1">Recordings will appear here once Daily.co is configured and sessions are recorded.</p>
          </div>
        )}
        <div className="space-y-3">
          {recordings.map((rec) => (
            <div key={rec.id} className={`border rounded-xl p-4 bg-white ${!rec.consent_obtained ? "border-orange-200" : "border-gray-100"}`}>
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <p className="font-medium text-gray-800">{rec.room_name ?? "Session Recording"}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(rec.created_at).toLocaleDateString()}
                    {rec.duration_seconds > 0 && ` · ${formatDuration(rec.duration_seconds)}`}
                    {` · ${rec.storage_provider}`}
                  </p>
                  {rec.expires_at && (
                    <p className="text-xs text-orange-600 mt-0.5">
                      Expires: {new Date(rec.expires_at).toLocaleDateString()}
                    </p>
                  )}
                  {!rec.consent_obtained && (
                    <p className="text-xs text-red-600 mt-0.5 font-medium">⚠️ Consent not documented</p>
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(rec.status)}`}>
                    {rec.status}
                  </span>
                  <button onClick={() => updateConsent(rec.id, !rec.consent_obtained)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${rec.consent_obtained ? "border-green-300 text-green-600 bg-green-50" : "border-orange-300 text-orange-600"}`}>
                    {rec.consent_obtained ? "✓ Consent" : "Add Consent"}
                  </button>
                  {rec.recording_url && (
                    <a href={rec.recording_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline">▶ View</Button>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}