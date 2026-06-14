import { useEffect, useState } from "react";
import { Stack, router } from "expo-router";
import { supabase } from "../lib/supabase";
import { View, ActivityIndicator, Text } from "react-native";

export default function RootLayout() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace("/(auth)/login");
      setLoading(false);
    }, 3000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      if (session) {
        router.replace("/(tabs)/home");
      } else {
        router.replace("/(auth)/login");
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace("/(tabs)/home");
      } else {
        router.replace("/(auth)/login");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1a2234" }}>
        <View style={{ width: 64, height: 64, backgroundColor: "#2563eb", borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900" }}>A</Text>
        </View>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "900", marginBottom: 8 }}>ABA AI</Text>
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 24 }} />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}