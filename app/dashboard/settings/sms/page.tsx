"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Template = {
  id: string;
  trigger_type: string;
  name: string;
  message_template: string;
  timing_hours: number;
  enabled: boolean;
};

type SMSLog = {
  id: string;
  to_number: string;
  message: string;
  trigger_type: string;
  status: string;
  created_at: string;
};

const TRIGGER_TYPES = [
  { value: "appointment_reminder", label: "Appointment Reminder", desc: "Sent before scheduled sessions" },
  { value: "session_cancelled", label: "Session Cancelled", desc: "Sent when a session is cancelled" },
  { value: "auth_expiring", label: "Authorization Expiring", desc: "Sent when insurance auth is expiring" },
  { value: "staff_invite", label: "Staff Invite", desc: "Sent when a new staff member is invited" },
  { value: "parent_update", label: "Parent Update", desc: "Sent to parents with session updates" },
  { value: "custom", label: "Custom Message", desc: "Manual message blast" },
];

const VARIABLES = ["{client_name}", "{date}", "{time}", "{clinician}", "{clinic_name}", "{days_remaining}"];

const DEFAULT_TEMPLATES = [
  {
    trigger_type: "appointment_reminder",
    name: "Appointment Reminder",
    message_template: "Hi! This is a reminder from {clinic_name} that {client_name} has an appointment on {date} at {time} with {clinician}. Reply STOP to unsubscribe.",
    timing_hours: 24,
    enabled: true,
  },
  {
    trigger_type: "session_cancelled",
    name: "Session Cancelled",
    message_template: "{clinic_name}: The session for {client_name} on {date} at {time} has been cancelled. Please contact us to reschedule. Reply STOP to unsubscribe.",
    timing_hours: 0,
    enabled: true,
  },
  {
    trigger_type: "auth_expiring",
    name: "Authorization Expiring",
    message_template: "{clinic_name}: The insurance authorization for {client_name} expires in {days_remaining} days. Please contact us to renew. Reply STOP to unsubscribe.",
    timing_hours: 0,
    enabled: true,
  },
  {
    trigger_type: "staff_invite",
    name: "Staff Invite",
    message_template: "You have been invited to join {clinic_name} on ABA AI Assistant. Check your email for your magic link to get started!",
    timing_hours: 0,
    enabled: true,
  },
  {
    trigger_type: "parent_update",
    name: "Parent Update",
    message_template: "{clinic_name}: {client_name} had a great session today with {clinician}. Log in to your parent portal to see the full update!",
    timing_hours: 0,
    enabled: true,
  },
];

export default function SMSSettingsPage() {
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [logs, setLogs] = useState<SMSLog[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [clinicName, setClinicName] = useState("");
  const [activeTab, setActiveTab] = useState<"settings" | "templates" | "blast" | "logs">("settings");
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [blastMessage, setBlastMessage] = useState("");
  const [blastTarget, setBlastTarget] = useState<"all" | "admins" | "clinicians" | "parents">("all");
  const [blasting, setBlasting] = useState(false);
  const [blastResult, setBlastResult] = useState<string | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: profile }, { data: companyUser }] = await Promise.all([
      supabase.from("profiles").select("phone").eq("id", user.id).single(),
      supabase.from("company_users").select("company_id, companies(name)").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle(),
    ]);

    if (profile?.phone) setPhone(profile.phone);
    const cid = companyUser?.company_id ?? null;
    setCompanyId(cid);
    setClinicName((companyUser?.companies as any)?.name ?? "");

    if (cid) {
      const [{ data: templateData }, { data: logData }] = await Promise.all([
        supabase.from("sms_templates").select("*").eq("company_id", cid).order("trigger_type"),
        supabase.from("sms_logs").select("*").eq("company_id", cid).order("created_at", { ascending: false }).limit(20),
      ]);

      if (templateData && templateData.length > 0) {
        setTemplates(templateData);
      } else {
        // Load default templates
        setTemplates(DEFAULT_TEMPLATES.map(t => ({ ...t, id: "", })) as any);
      }
      setLogs(logData ?? []);
    }
    setLoadingTemplates(false);
  }

  async function handleSavePhone() {
    setSaving(true);
    setError(null);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { error: saveError } = await supabase.from("profiles").update({ phone } as any).eq("id", user.id);
    if (saveError) { setError(saveError.message); } else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    setSaving(false);
  }

  async function handleTest() {
    if (!phone) { setError("Please save a phone number first."); return; }
    setTesting(true);
    setTestResult(null);
    setError(null);

    const res = await fetch("/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: phone,
        message: `${clinicName || "ABA AI Assistant"}: This is a test SMS notification. Your SMS alerts are working! ✓`,
        companyId,
        triggerType: "test",
      }),
    });

    const data = await res.json();
    if (data.success) { setTestResult("✓ Test SMS sent successfully!"); }
    else { setError(data.error ?? "SMS test failed"); }
    setTesting(false);
  }

  async function handleSaveTemplate() {
    if (!editingTemplate || !companyId) return;
    setSavingTemplate(true);

    if (editingTemplate.id) {
      await supabase.from("sms_templates").update({
        name: editingTemplate.name,
        message_template: editingTemplate.message_template,
        timing_hours: editingTemplate.timing_hours,
        enabled: editingTemplate.enabled,
      }).eq("id", editingTemplate.id);
    } else {
      await supabase.from("sms_templates").insert({
        company_id: companyId,
        trigger_type: editingTemplate.trigger_type,
        name: editingTemplate.name,
        message_template: editingTemplate.message_template,
        timing_hours: editingTemplate.timing_hours,
        enabled: editingTemplate.enabled,
      });
    }

    // Reload templates
    const { data } = await supabase.from("sms_templates").select("*").eq("company_id", companyId).order("trigger_type");
    setTemplates(data ?? []);
    setEditingTemplate(null);
    setSavingTemplate(false);
  }

  async function toggleTemplate(template: Template) {
    if (!companyId) return;
    if (template.id) {
      await supabase.from("sms_templates").update({ enabled: !template.enabled }).eq("id", template.id);
      setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, enabled: !t.enabled } : t));
    }
  }

  async function handleBlast() {
    if (!blastMessage.trim() || !companyId) return;
    setBlasting(true);
    setBlastResult(null);

    // Get phone numbers based on target
    let query = supabase.from("company_users").select("user_id").eq("company_id", companyId).eq("status", "active");
    if (blastTarget === "admins") query = query.eq("role", "admin");
    else if (blastTarget === "clinicians") query = query.in("role", ["clinician", "rbt", "bt", "supervisor"]);
    else if (blastTarget === "parents") query = query.eq("role", "parent");

    const { data: users } = await query;
    if (!users || users.length === 0) { setBlastResult("No users found for selected target."); setBlasting(false); return; }

    const userIds = users.map((u: any) => u.user_id);
    const { data: profiles } = await supabase.from("profiles").select("phone").in("id", userIds).not("phone", "is", null);

    if (!profiles || profiles.length === 0) { setBlastResult("No phone numbers found. Ask staff to add their phone number in SMS settings."); setBlasting(false); return; }

    let sent = 0;
    for (const profile of profiles) {
      if (!profile.phone) continue;
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: profile.phone,
          message: blastMessage,
          companyId,
          triggerType: "blast",
        }),
      });
      if ((await res.json()).success) sent++;
    }

    setBlastResult(`✓ Sent to ${sent} of ${profiles.length} recipients.`);
    setBlastMessage("");
    setBlasting(false);

    // Reload logs
    const { data: logData } = await supabase.from("sms_logs").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(20);
    setLogs(logData ?? []);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="SMS Notifications">
        <p className="text-gray-500 text-sm">Manage text message alerts for your clinic.</p>
      </PageHeader>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
      {saved && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">✓ Phone number saved.</div>}
      {testResult && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">{testResult}</div>}

      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {[
          { key: "settings", label: "My Number" },
          { key: "templates", label: "Templates" },
          { key: "blast", label: "Send Message" },
          { key: "logs", label: "SMS Log" },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* MY NUMBER TAB */}
      {activeTab === "settings" && (
        <Section title="My Phone Number">
          <div className="space-y-3 max-w-md">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Mobile Phone Number</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <p className="text-xs text-gray-400 mt-1">Include country code (e.g. +1 for US)</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSavePhone} loading={saving}>Save Number</Button>
              <Button variant="outline" onClick={handleTest} loading={testing}>Send Test SMS</Button>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <p className="text-sm font-semibold text-gray-700">Alert Types</p>
            {[
              { label: "Supervisor ping alerts", desc: "When a team member pings you" },
              { label: "Session reminders", desc: "30 minutes before scheduled sessions" },
              { label: "Export approvals", desc: "When your export is approved or rejected" },
              { label: "Error report reviewed", desc: "When supervisor reviews your error report" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg bg-white">
                <div>
                  <p className="text-sm font-medium text-gray-700">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.desc}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">Active</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* TEMPLATES TAB */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            Customize SMS messages sent automatically by your clinic. Use variables like {"{client_name}"}, {"{date}"}, {"{time}"}, {"{clinician}"}, {"{clinic_name}"}, {"{days_remaining}"} to personalize messages.
          </div>

          {loadingTemplates ? (
            <p className="text-gray-400 text-sm">Loading templates...</p>
          ) : (
            <div className="space-y-3">
              {TRIGGER_TYPES.map(type => {
                const template = templates.find(t => t.trigger_type === type.value);
                const defaultTemplate = DEFAULT_TEMPLATES.find(t => t.trigger_type === type.value);
                return (
                  <div key={type.value} className="border border-gray-100 rounded-xl p-4 bg-white">
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-gray-800">{type.label}</p>
                          {template ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${template.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                              {template.enabled ? "Active" : "Disabled"}
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Not saved</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mb-2">{type.desc}</p>
                        <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2 font-mono">
                          {template?.message_template ?? defaultTemplate?.message_template ?? "No template set"}
                        </p>
                        {(template?.timing_hours ?? defaultTemplate?.timing_hours ?? 0) > 0 && (
                          <p className="text-xs text-gray-400 mt-1">
                            Sends {template?.timing_hours ?? defaultTemplate?.timing_hours}h before event
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {template && (
                          <button onClick={() => toggleTemplate(template)}
                            className={`text-xs px-3 py-1.5 border rounded-lg transition-colors ${template.enabled ? "border-orange-200 text-orange-600 hover:bg-orange-50" : "border-green-200 text-green-600 hover:bg-green-50"}`}>
                            {template.enabled ? "Disable" : "Enable"}
                          </button>
                        )}
                        <button
                          onClick={() => setEditingTemplate(template ?? { id: "", trigger_type: type.value, name: type.label, message_template: defaultTemplate?.message_template ?? "", timing_hours: defaultTemplate?.timing_hours ?? 0, enabled: true })}
                          className="text-xs px-3 py-1.5 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50">
                          {template ? "Edit" : "Set Up"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* EDIT MODAL */}
          {editingTemplate && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl space-y-4">
                <h3 className="font-bold text-gray-900">Edit SMS Template</h3>

                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Template Name</label>
                  <input type="text" value={editingTemplate.name}
                    onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Message</label>
                  <textarea value={editingTemplate.message_template} rows={4}
                    onChange={e => setEditingTemplate({ ...editingTemplate, message_template: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {VARIABLES.map(v => (
                      <button key={v} type="button"
                        onClick={() => setEditingTemplate({ ...editingTemplate, message_template: editingTemplate.message_template + v })}
                        className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-100 hover:bg-blue-100">
                        {v}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{editingTemplate.message_template.length}/160 characters</p>
                </div>

                {["appointment_reminder"].includes(editingTemplate.trigger_type) && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Send how many hours before?</label>
                    <select value={editingTemplate.timing_hours}
                      onChange={e => setEditingTemplate({ ...editingTemplate, timing_hours: parseInt(e.target.value) })}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                      <option value={1}>1 hour before</option>
                      <option value={2}>2 hours before</option>
                      <option value={24}>24 hours before</option>
                      <option value={48}>48 hours before</option>
                    </select>
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditingTemplate(null)}
                    className="px-4 py-2 border rounded-lg text-sm text-gray-500 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button onClick={handleSaveTemplate} disabled={savingTemplate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                    {savingTemplate ? "Saving..." : "Save Template"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BLAST TAB */}
      {activeTab === "blast" && (
        <Section title="Send Message to Staff">
          <div className="space-y-4 max-w-lg">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Send to</label>
              <select value={blastTarget} onChange={e => setBlastTarget(e.target.value as any)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="all">All Staff</option>
                <option value="admins">Admins Only</option>
                <option value="clinicians">Clinicians & RBTs</option>
                <option value="parents">Parents Only</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Message</label>
              <textarea value={blastMessage} onChange={e => setBlastMessage(e.target.value)}
                placeholder="Type your message here..."
                rows={4}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <p className="text-xs text-gray-400 mt-1">{blastMessage.length}/160 characters</p>
            </div>

            {blastResult && (
              <div className={`rounded-lg p-3 text-sm ${blastResult.startsWith("✓") ? "bg-green-50 border border-green-200 text-green-700" : "bg-orange-50 border border-orange-200 text-orange-700"}`}>
                {blastResult}
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-700">
              Only staff who have saved their phone number in SMS Settings will receive this message.
            </div>

            <Button onClick={handleBlast} loading={blasting} disabled={!blastMessage.trim()}>
              Send Message
            </Button>
          </div>
        </Section>
      )}

      {/* LOGS TAB */}
      {activeTab === "logs" && (
        <Section title="SMS Log">
          {logs.length === 0 ? (
            <p className="text-gray-400 text-sm">No messages sent yet.</p>
          ) : (
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="border border-gray-100 rounded-xl p-3 bg-white">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <p className="text-sm text-gray-800">{log.message}</p>
                      <p className="text-xs text-gray-400 mt-1">To: {log.to_number} · {log.trigger_type}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${log.status === "sent" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                        {log.status}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">{new Date(log.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
