import { supabase } from "@/lib/supabase/client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function isPushSupported(): Promise<boolean> {
  return "serviceWorker" in navigator && "PushManager" in window;
}

export async function subscribeToPush(): Promise<{ success: boolean; error?: string }> {
  if (!(await isPushSupported())) return { success: false, error: "Push notifications aren't supported on this browser." };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { success: false, error: "Notification permission denied." };

  try {
    const registration = await navigator.serviceWorker.ready;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }

    const subJson = subscription.toJSON();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return { success: false, error: "Not logged in." };

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.error ?? "Failed to save subscription." };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Could not subscribe." };
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!(await isPushSupported())) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe();
}