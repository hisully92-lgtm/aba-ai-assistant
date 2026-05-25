"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Notification = {
  id: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
};

const TYPE_FILTERS = ["all", "chat", "ping", "supervisor", "alert", "system"];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    load();

    // Realtime
    supabase
      .channel("notifications-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => load())
      .subscribe();
  }, []);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    setNotifications(data ?? []);
    setLoading(false);
  }

  async function markAllRead() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }

  async function deleteNotification(id: string) {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
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
    if (type === "system") return "bg-gray-100 text-gray-600";
    return "bg-gray-100 text-gray-600";
  }

  const filtered = typeFilter === "all"
    ? notifications
    : notifications.filter((n) => n.type === typeFilter);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <PageHeader title={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllRead}>Mark all read</Button>
          )}
        </div>
      </PageHeader>

      {/* TYPE FILTER */}
      <div className="flex flex-wrap gap-2">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setTypeFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-all ${
              typeFilter === f
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-blue-300"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <Section title={`${filtered.length} notification${filtered.length !== 1 ? "s" : ""}`}>
        {loading && <p className="text-gray-400 text-sm">Loading...</p>}
        {!loading && filtered.length === 0 && (
          <p className="text-gray-400 text-sm">No notifications found.</p>
        )}
        <div className="space-y-2">
          {filtered.map((n) => (
            <div
              key={n.id}
              className={`border rounded-lg p-3 flex justify-between items-start transition-colors ${
                n.read ? "bg-white border-gray-100" : "bg-blue-50 border-blue-200"
              }`}
            >
              <div
                className="flex gap-3 items-start flex-1 cursor-pointer"
                onClick={() => !n.read && markRead(n.id)}
              >
                <span className="text-lg">{typeIcon(n.type)}</span>
                <div>
                  <p className={`text-sm ${n.read ? "text-gray-600" : "text-gray-800 font-medium"}`}>
                    {n.message}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${typeBadge(n.type)}`}>
                      {n.type}
                    </span>
                    <p className="text-xs text-gray-400">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-2">
                {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                <button
                  onClick={() => deleteNotification(n.id)}
                  className="text-gray-300 hover:text-red-400 text-xs"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}