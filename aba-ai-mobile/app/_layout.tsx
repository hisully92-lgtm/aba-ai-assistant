import { useEffect } from "react";
import { Stack, router } from "expo-router";
import { supabase } from "../lib/supabase";
import { TimerProvider } from "../lib/TimerContext";

export default function RootLayout() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/(tabs)/home");
      } else {
        router.replace("/(auth)/login");
      }
    });
  }, []);

  return (
    <TimerProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </TimerProvider>
  );
}