import { useEffect } from "react";
import { Stack, router } from "expo-router";
import { supabase } from "../lib/supabase";
import { TimerProvider } from "../lib/TimerContext";
import { EVVProvider } from "../lib/EVVContext";
import { prefetchForOffline, syncQueue } from "../lib/offline";

async function setupNotifications() {
  try {
    const Notifications = await import("expo-notifications");

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return;

    const token = (await Notifications.getExpoPushTokenAsync()).data;
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user || !token) return;

    const { data: companyUser } = await supabase
      .from("company_users").select("company_id")
      .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();

    const { data: existing_pref } = await supabase
      .from("notification_preferences")
      .select("id").eq("user_id", user.id).limit(1).maybeSingle();

    if (existing_pref) {
      await supabase.from("notification_preferences")
        .update({ expo_push_token: token, push_enabled: true })
        .eq("id", existing_pref.id);
    } else {
      await supabase.from("notification_preferences").insert({
        user_id: user.id,
        company_id: companyUser?.company_id,
        expo_push_token: token,
        push_enabled: true,
      });
    }

    if (companyUser?.company_id) {
      await prefetchForOffline(companyUser.company_id, user.id);
    }
    await syncQueue();
  } catch (e) {
    console.log("Notification setup error:", e);
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/(tabs)/home");
        setupNotifications();
      } else {
        router.replace("/(auth)/login");
      }
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace("/(tabs)/home");
        setupNotifications();
      } else {
        router.replace("/(auth)/login");
      }
    });
  }, []);

  return (
    <EVVProvider>
      <TimerProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </TimerProvider>
    </EVVProvider>
  );
}
