import { useEffect } from "react";
import { Stack, router } from "expo-router";
import { supabase } from "../lib/supabase";

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

  return <Stack screenOptions={{ headerShown: false }} />;
}