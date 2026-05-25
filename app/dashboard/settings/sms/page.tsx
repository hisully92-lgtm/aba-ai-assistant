"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { sendSMS } from "@/lib/sms";

export default function SMSSettingsPage() {
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", user.id)
        .single();

      if (data?.phone) setPhone(data.phone);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { error: saveError } = await supabase
      .from("profiles")
      .update({ phone } as any)
      .eq("id", user.id);

    if (saveError) {
      setError(saveError.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  async function handleTest() {
    if (!phone) { setError("Please save a phone number first."); return; }
    setTesting(true);
    setTestResult(null);
    setError(null);

    const result = await sendSMS({
      to: phone,
      message: "ABA AI Assistant: This is a test SMS notification. Your SMS alerts are working!",
    });

    if (result.success) {
      setTestResult("✓ Test SMS sent successfully!");
    } else {
      setError(result.error ?? "SMS test failed");
    }
    setTesting(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="SMS Notifications">
        <p className="text-gray-500 text-sm">Receive text message alerts for important events.</p>
      </PageHeader>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
      {saved && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">✓ Phone number saved.</div>}
      {testResult && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">{testResult}</div>}

      <Section title="Phone Number">
        <div className="space-y-3 max-w-md">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Mobile Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <p className="text-xs text-gray-400 mt-1">Include country code (e.g. +1 for US)</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} loading={saving}>Save Number</Button>
            <Button variant="outline" onClick={handleTest} loading={testing}>Send Test SMS</Button>
          </div>
        </div>
      </Section>

      <Section title="SMS Alerts">
        <div className="space-y-2">
          {[
            { label: "Supervisor ping alerts", desc: "When a team member pings you" },
            { label: "Session reminders", desc: "30 minutes before scheduled sessions" },
            { label: "Export approvals", desc: "When your export is approved or rejected" },
            { label: "Error report reviewed", desc: "When supervisor reviews your error report" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg bg-white">
              <div>
                <p className="text-sm font-medium text-gray-700">{item.label}</p>
                <p className="text-xs text-gray-400">{item.desc}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                Ready
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          <p className="font-medium mb-1">Setup Required</p>
          <p>To activate SMS, add these to your <code>.env.local</code>:</p>
          <code className="block mt-2 text-xs bg-yellow-100 p-2 rounded">
            TWILIO_ACCOUNT_SID=your_sid{"\n"}
            TWILIO_AUTH_TOKEN=your_token{"\n"}
            TWILIO_PHONE_NUMBER=+1234567890
          </code>
          <p className="mt-2">Sign up free at <strong>twilio.com</strong></p>
        </div>
      </Section>
    </div>
  );
}