"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import AppShell from "@/components/app/AppShell";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/pushClient";

type Profile = { full_name: string; role: string; email: string };

function Toggle({ checked, onChange, activeColor }: { checked: boolean; onChange: (v: boolean) => void; activeColor: string }) {
  return (
    <button onClick={() => onChange(!checked)} className="w-11 h-6 rounded-full relative transition-colors shrink-0"
      style={{ backgroundColor: checked ? activeColor : "#e5e7eb" }}>
      <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: checked ? 22 : 2 }} />
    </button>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [notifyHighSeverity, setNotifyHighSeverity] = useState(true);
  const [notifySessionSubmitted, setNotifySessionSubmitted] = useState(true);
  const [notifyTargetMastered, setNotifyTargetMastered] = useState(true);
  const [notifyChat, setNotifyChat] = useState(true);
  const [quietHours, setQuietHours] = useState(false);
  const [prefsId, setPrefsId] = useState<string | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: profileData }, { data: companyUser }, { data: prefData }] = await Promise.all([
      supabase.from("profiles").select("full_name, role").eq("id", user.id).single(),
      supabase.from("company_users").select("role, company_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle(),
      supabase.from("notification_preferences").select("*").eq("user_id", user.id).limit(1).maybeSingle(),
    ]);

    setProfile({ full_name: profileData?.full_name ?? "", role: companyUser?.role ?? profileData?.role ?? "", email: user.email ?? "" });

    if (prefData) {
      setPrefsId(prefData.id);
      setPushEnabled(prefData.push_enabled ?? true);
      setNotifyHighSeverity(prefData.notify_high_severity ?? true);
      setNotifySessionSubmitted(prefData.notify_session_submitted ?? true);
      setNotifyTargetMastered(prefData.notify_target_mastered ?? true);
      setNotifyChat(prefData.notify_team_chat ?? true);
      setQuietHours(prefData.quiet_hours_enabled ?? false);
    }
    setLoading(false);
  }

  async function savePrefs() {
    setSavingPrefs(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const updates = {
      push_enabled: pushEnabled,
      notify_high_severity: notifyHighSeverity,
      notify_session_submitted: notifySessionSubmitted,
      notify_target_mastered: notifyTargetMastered,
      notify_team_chat: notifyChat,
      quiet_hours_enabled: quietHours,
    };

    if (prefsId) {
      await supabase.from("notification_preferences").update(updates).eq("id", prefsId);
    } else {
      const { data: companyUser } = await supabase.from("company_users").select("company_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
      const { data } = await supabase.from("notification_preferences").insert({ ...updates, user_id: user.id, company_id: companyUser?.company_id }).select().single();
      if (data) setPrefsId(data.id);
    }
    setSavingPrefs(false);
    alert("Notification preferences updated.");
  }

  async function handleLogout() {
    if (!confirm("Log out?")) return;
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.replace("/app");
  }

  if (loading) {
    return <AppShell title="Profile & Settings"><div className="flex justify-center py-20"><p className="text-gray-400 text-sm">Loading...</p></div></AppShell>;
  }

  return (
    <AppShell title="Profile & Settings">
      <div className="pb-10">
        {/* PROFILE CARD */}
        <div className="flex items-center gap-4 m-4 bg-white rounded-2xl p-4 shadow-sm">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl font-extrabold shrink-0" style={{ backgroundColor: "#2563eb" }}>
            {profile?.full_name?.charAt(0)?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1">
            <p className="text-[17px] font-bold text-gray-900">{profile?.full_name || "Clinician"}</p>
            <p className="text-[13px] text-gray-500 mt-0.5">{profile?.email}</p>
            <span className="inline-block mt-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#eff6ff", color: "#2563eb" }}>
              {profile?.role?.toUpperCase()}
            </span>
          </div>
        </div>

        {/* NOTIFICATION SETTINGS */}
        <div className="px-4 pt-2">
          <p className="text-[15px] font-bold text-gray-900">Notification Preferences</p>
          <p className="text-xs text-gray-400 mb-3">Control which alerts you receive on this device.</p>

          <div className="bg-white rounded-2xl shadow-sm">
            <div className="flex items-center gap-3 p-3.5">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">Push Notifications</p>
                <p className="text-xs text-gray-400 mt-0.5">Enable all push notifications</p>
              </div>
             <Toggle checked={pushEnabled} onChange={async (v) => {
  setPushEnabled(v);
  if (v) {
    const result = await subscribeToPush();
    if (!result.success) { alert(result.error ?? "Could not enable notifications."); setPushEnabled(false); }
  } else {
    await unsubscribeFromPush();
  }
}} activeColor="#2563eb" />
            </div>

            {pushEnabled && (
              <div className="px-3.5 pb-3.5">
                <button
                  onClick={async () => {
                    const { data: { session } } = await supabase.auth.getSession();
                    const res = await fetch("/api/push/test", {
                      method: "POST",
                      headers: { Authorization: `Bearer ${session?.access_token}` },
                    });
                    alert(res.ok ? "Test sent — check for a notification!" : "Failed to send test.");
                  }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: "#eff6ff", color: "#2563eb" }}
                >
                  🔔 Send Test Notification
                </button>
              </div>
            )}

            {pushEnabled && (
              <>
                {[
                  { label: "🔴 High Severity Behaviors", desc: "Alert when serious behaviors are recorded", val: notifyHighSeverity, set: setNotifyHighSeverity, color: "#dc2626" },
                  { label: "📋 Session Submitted", desc: "When staff submit session notes", val: notifySessionSubmitted, set: setNotifySessionSubmitted, color: "#2563eb" },
                  { label: "🎯 Target Mastered", desc: "When a client reaches mastery", val: notifyTargetMastered, set: setNotifyTargetMastered, color: "#16a34a" },
                  { label: "💬 Team Chat", desc: "New messages in client team chats", val: notifyChat, set: setNotifyChat, color: "#2563eb" },
                  { label: "🌙 Quiet Hours", desc: "Silence notifications at night", val: quietHours, set: setQuietHours, color: "#7c3aed" },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-3 p-3.5 border-t border-gray-100">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{row.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{row.desc}</p>
                    </div>
                    <Toggle checked={row.val} onChange={row.set} activeColor={row.color} />
                  </div>
                ))}
              </>
            )}
          </div>

          <button onClick={savePrefs} disabled={savingPrefs} className="w-full text-white font-bold py-3.5 rounded-xl mt-3 disabled:opacity-60" style={{ backgroundColor: "#2563eb" }}>
            {savingPrefs ? "..." : "Save Preferences"}
          </button>
        </div>

        {/* APP INFO */}
        <div className="px-4 pt-6">
          <p className="text-[15px] font-bold text-gray-900 mb-3">About</p>
          <div className="bg-white rounded-2xl shadow-sm">
            {[
              { label: "App", value: "ABA AI Assistant" },
              { label: "Website", value: "aba-ai-assistant.com" },
              { label: "Support", value: "support@aba-ai-assistant.com" },
            ].map((row, i) => (
              <div key={row.label} className={`flex items-center justify-between p-3.5 ${i > 0 ? "border-t border-gray-100" : ""}`}>
                <span className="text-[13px] text-gray-500">{row.label}</span>
                <span className="text-[13px] font-medium text-gray-700">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* LOGOUT */}
        <div className="px-4 pt-6">
          <button onClick={handleLogout} disabled={loggingOut} className="w-full text-white font-bold py-4 rounded-2xl" style={{ backgroundColor: "#dc2626" }}>
            {loggingOut ? "..." : "Log Out"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
