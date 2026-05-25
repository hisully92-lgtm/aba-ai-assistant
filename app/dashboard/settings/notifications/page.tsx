"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { subscribeToPush, unsubscribeFromPush, VAPID_PUBLIC_KEY } from "@/lib/push";

export default function NotificationSettingsPage() {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setSupported("serviceWorker" in navigator && "PushManager" in window);
    if ("Notification" in window) setPermission(Notification.permission);
    checkSubscription();
  }, []);

  async function checkSubscription() {
    if (!("serviceWorker" in navigator)) { setLoading(false); return; }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const sub = await registration.pushManager.getSubscription();
        setSubscribed(!!sub);
      }
    } catch {
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle() {
    setToggling(true);
    setError(null);
    setSuccess(null);

    if (!VAPID_PUBLIC_KEY) {
      setError("Push notifications not configured. Add NEXT_PUBLIC_VAPID_PUBLIC_KEY to your environment.");
      setToggling(false);
      return;
    }

    try {
      if (subscribed) {
        await unsubscribeFromPush();
        setSubscribed(false);
        setSuccess("Push notifications disabled.");
      } else {
        const permission = await Notification.requestPermission();
        setPermission(permission);

        if (permission !== "granted") {
          setError("Permission denied. Please allow notifications in your browser settings.");
          setToggling(false);
          return;
        }

        const sub = await subscribeToPush();
        if (sub) {
          const { data: auth } = await supabase.auth.getUser();
          const user = auth?.user;
          if (user) {
            const subJSON = sub.toJSON();
            await supabase.from("push_subscriptions").upsert({
              user_id: user.id,
              endpoint: sub.endpoint,
              p256dh: subJSON.keys?.p256dh ?? null,
              auth: subJSON.keys?.auth ?? null,
            });
          }
          setSubscribed(true);
          setSuccess("Push notifications enabled!");
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to toggle notifications");
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Notification Settings">
        <p className="text-gray-500 text-sm">Manage push notifications and alerts.</p>
      </PageHeader>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">{success}</div>}

      <Section title="Push Notifications">
        {!supported ? (
          <p className="text-gray-400 text-sm">Push notifications are not supported in this browser.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-gray-100 rounded-lg bg-white">
              <div>
                <p className="font-medium text-gray-800">Browser Push Notifications</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Receive alerts for new messages, pings, and reminders.
                </p>
                <p className="text-xs mt-1">
                  Status:{" "}
                  <span className={`font-medium ${
                    permission === "granted" ? "text-green-600"
                    : permission === "denied" ? "text-red-600"
                    : "text-yellow-600"
                  }`}>
                    {permission === "granted" ? "Allowed" : permission === "denied" ? "Blocked" : "Not set"}
                  </span>
                </p>
              </div>
              <Button
                onClick={handleToggle}
                loading={toggling || loading}
                variant={subscribed ? "danger" : "secondary"}
              >
                {subscribed ? "Disable" : "Enable"}
              </Button>
            </div>

            {permission === "denied" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                Notifications are blocked. To enable, click the lock icon in your browser address bar and allow notifications.
              </div>
            )}

            {!VAPID_PUBLIC_KEY && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600">
                <p className="font-medium mb-1">Setup Required</p>
                <p>To enable push notifications, add these to your <code>.env.local</code>:</p>
                <code className="block mt-2 text-xs bg-gray-100 p-2 rounded">
                  NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key{"\n"}
                  VAPID_PRIVATE_KEY=your_private_key
                </code>
                <p className="mt-2">Generate keys with: <code>npx web-push generate-vapid-keys</code></p>
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="In-App Notifications">
        <div className="space-y-2">
          {[
            { label: "New chat messages", enabled: true },
            { label: "Supervisor pings", enabled: true },
            { label: "Session reminders", enabled: true },
            { label: "Export approvals", enabled: true },
            { label: "Error report reviews", enabled: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg bg-white">
              <p className="text-sm text-gray-700">{item.label}</p>
              <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                Active
              </span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}