"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Notification = { id: string; message: string; type: string; read: boolean; created_at: string };
type NotificationPrefs = {
  notify_high_severity: boolean;
  notify_session_submitted: boolean;
  notify_session_started: boolean;
  notify_target_mastered: boolean;
  notify_missed_session: boolean;
  notify_schedule_change: boolean;
  notify_team_chat: boolean;
  severity_threshold: number;
  digest_mode: boolean;
  quiet_hours_enabled: boolean;
  quiet_start: string;
  quiet_end: string;
};

const DEFAULT_PREFS: NotificationPrefs = {
  notify_high_severity: true,
  notify_session_submitted: true,
  notify_session_started: false,
  notify_target_mastered: true,
  notify_missed_session: true,
  notify_schedule_change: true,
  notify_team_chat: true,
  severity_threshold: 2,
  digest_mode: false,
  quiet_hours_enabled: false,
  quiet_start: "20:00",
  quiet_end: "07:00",
};

const TYPE_FILTERS = ["all", "chat", "ping", "supervisor", "alert", "system"];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [role, setRole] = useState("");
  const [prefsId, setPrefsId] = useState<string | null>(null);

  useEffect(() => {
    load();
    supabase.channel("notifications-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => load())
      .subscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: notifData }, { data: companyUser }, { data: prefData }] = await Promise.all([
      supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("company_users").select("role").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle(),
      supabase.from("notification_preferences").select("*").eq("user_id", user.id).limit(1).maybeSingle(),
    ]);

    setNotifications(notifData ?? []);
    setRole(companyUser?.role ?? "");
    if (prefData) {
      setPrefsId(prefData.id);
      setPrefs({
        notify_high_severity: prefData.notify_high_severity,
        notify_session_submitted: prefData.notify_session_submitted,
        notify_session_started: prefData.notify_session_started,
        notify_target_mastered: prefData.notify_target_mastered,
        notify_missed_session: prefData.notify_missed_session,
        notify_schedule_change: prefData.notify_schedule_change,
        notify_team_chat: prefData.notify_team_chat,
        severity_threshold: prefData.severity_threshold,
        digest_mode: prefData.digest_mode,
        quiet_hours_enabled: prefData.quiet_hours_enabled,
        quiet_start: prefData.quiet_start,
        quiet_end: prefData.quiet_end,
      });
    }
    setLoading(false);
  }

  async function savePrefs() {
    setSavingPrefs(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data: companyUser } = await supabase.from("company_users").select("company_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();

    if (prefsId) {
      await supabase.from("notification_preferences").update(prefs).eq("id", prefsId);
    } else {
      const { data } = await supabase.from("notification_preferences").insert({ ...prefs, user_id: user.id, company_id: companyUser?.company_id }).select().single();
      if (data) setPrefsId(data.id);
    }
    setSavingPrefs(false);
    setShowPrefs(false);
  }

  async function markAllRead() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  async function deleteNotification(id: string) {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  function typeIcon(type: string) {
    if (type === "ping") return "🔔";
    if (type === "supervisor") return "📢";
    if (type === "alert") return "⚠️";
    if (type === "chat") return "💬";
    if (type === "system") return "🔧";
    return "📬";
  }

  function typeBadge(type: string) {
    if (type === "ping") return "bg-orange-100 text-orange-700";
    if (type === "supervisor") return "bg-purple-100 text-purple-700";
    if (type === "alert") return "bg-red-100 text-red-700";
    if (type === "chat") return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-600";
  }

  const filtered = typeFilter === "all" ? notifications : notifications.filter(n => n.type === typeFilter);
  const unreadCount = notifications.filter(n => !n.read).length;
  const canConfigurePrefs = ["bcba", "supervisor", "admin", "clinical_director"].includes(role);

  return (
    <div className="space-y-6">
      <PageHeader title={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}>
        <div className="flex gap-2">
          {unreadCount > 0 && <Button variant="outline" onClick={markAllRead}>Mark all read</Button>}
          {canConfigurePrefs && <Button variant="outline" onClick={() => setShowPrefs(s => !s)}>⚙️ Preferences</Button>}
        </div>
      </PageHeader>

      {/* NOTIFICATION PREFERENCES */}
      {showPrefs && canConfigurePrefs && (
        <Section title="Notification Preferences">
          <p className="text-xs text-gray-500 mb-4">Control which notifications you receive. As a supervisor/BCBA, you can limit alerts to avoid notification overload.</p>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { key: "notify_high_severity", label: "🔴 High severity behaviors", desc: "Only behaviors at or above your threshold" },
                { key: "notify_session_submitted", label: "📋 Session notes submitted", desc: "When staff submit a session for review" },
                { key: "notify_session_started", label: "▶ Session started", desc: "When a staff member clocks in" },
                { key: "notify_target_mastered", label: "🎯 Target mastered", desc: "When a client reaches 80% accuracy" },
                { key: "notify_missed_session", label: "⚠️ Missed session", desc: "When a session is marked cancelled" },
                { key: "notify_schedule_change", label: "📅 Schedule changes", desc: "When your schedule is modified" },
                { key: "notify_team_chat", label: "💬 Team chat messages", desc: "New messages in client team chats" },
              ].map(item => (
                <label key={item.key} className="flex items-start gap-3 p-3 border border-gray-100 rounded-xl cursor-pointer hover:bg-gray-50">
                  <input type="checkbox"
                    checked={prefs[item.key as keyof NotificationPrefs] as boolean}
                    onChange={e => setPrefs(prev => ({ ...prev, [item.key]: e.target.checked }))}
                    className="mt-0.5 rounded border-gray-300" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.label}</p>
                    <p className="text-xs text-gray-400">{item.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Behavior Severity Threshold — only notify at level {prefs.severity_threshold}+
              </label>
              <input type="range" min={1} max={5} value={prefs.severity_threshold}
                onChange={e => setPrefs(prev => ({ ...prev, severity_threshold: parseInt(e.target.value) }))}
                className="w-full" />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Level 1 (all)</span><span>Level 3</span><span>Level 5 (most severe)</span>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={prefs.digest_mode} onChange={e => setPrefs(prev => ({ ...prev, digest_mode: e.target.checked }))} className="rounded border-gray-300" />
                <div>
                  <p className="text-sm font-medium text-gray-800">📊 Daily digest mode</p>
                  <p className="text-xs text-gray-400">Get one summary per day instead of instant notifications</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={prefs.quiet_hours_enabled} onChange={e => setPrefs(prev => ({ ...prev, quiet_hours_enabled: e.target.checked }))} className="rounded border-gray-300" />
                <div>
                  <p className="text-sm font-medium text-gray-800">🌙 Quiet hours</p>
                  <p className="text-xs text-gray-400">No notifications during these hours</p>
                </div>
              </label>

              {prefs.quiet_hours_enabled && (
                <div className="flex gap-4 ml-7">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">From</label>
                    <input type="time" value={prefs.quiet_start} onChange={e => setPrefs(prev => ({ ...prev, quiet_start: e.target.value }))}
                      className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">To</label>
                    <input type="time" value={prefs.quiet_end} onChange={e => setPrefs(prev => ({ ...prev, quiet_end: e.target.value }))}
                      className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={savePrefs} loading={savingPrefs}>Save Preferences</Button>
              <Button variant="outline" onClick={() => setShowPrefs(false)}>Cancel</Button>
            </div>
          </div>
        </Section>
      )}

      {/* TYPE FILTER */}
      <div className="flex flex-wrap gap-2">
        {TYPE_FILTERS.map(f => (
          <button key={f} onClick={() => setTypeFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-all ${typeFilter === f ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-300"}`}>
            {f}
          </button>
        ))}
      </div>

      <Section title={`${filtered.length} notification${filtered.length !== 1 ? "s" : ""}`}>
        {loading && <p className="text-gray-400 text-sm">Loading...</p>}
        {!loading && filtered.length === 0 && <p className="text-gray-400 text-sm">No notifications found.</p>}
        <div className="space-y-2">
          {filtered.map(n => (
            <div key={n.id} className={`border rounded-lg p-3 flex justify-between items-start transition-colors ${n.read ? "bg-white border-gray-100" : "bg-blue-50 border-blue-200"}`}>
              <div className="flex gap-3 items-start flex-1 cursor-pointer" onClick={() => !n.read && markRead(n.id)}>
                <span className="text-lg">{typeIcon(n.type)}</span>
                <div>
                  <p className={`text-sm ${n.read ? "text-gray-600" : "text-gray-800 font-medium"}`}>{n.message}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${typeBadge(n.type)}`}>{n.type}</span>
                    <p className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-2">
                {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                <button onClick={() => deleteNotification(n.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}