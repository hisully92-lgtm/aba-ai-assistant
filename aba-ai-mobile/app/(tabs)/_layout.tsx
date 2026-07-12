import { Tabs } from "expo-router";
import { View, Text } from "react-native";

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: "center", gap: 2 }}>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      <Text numberOfLines={1} style={{ fontSize: 10, color: focused ? "#2563eb" : "#9ca3af", fontWeight: focused ? "600" : "400" }}>
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarShowLabel: false,
      tabBarStyle: {
        backgroundColor: "#1a2234",
        borderTopWidth: 0,
        height: 70,
        paddingBottom: 8,
      },
    }}>
      <Tabs.Screen name="home" options={{
        tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Home" focused={focused} />,
      }} />
      <Tabs.Screen name="calendar" options={{
        tabBarIcon: ({ focused }) => <TabIcon emoji="📅" label="Cal" focused={focused} />,
      }} />
      <Tabs.Screen name="session" options={{
        tabBarIcon: ({ focused }) => <TabIcon emoji="📋" label="Session" focused={focused} />,
      }} />
      <Tabs.Screen name="notes" options={{
        tabBarIcon: ({ focused }) => <TabIcon emoji="📝👧" label="Parent" focused={focused} />,
      }} />
      <Tabs.Screen name="timers" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="timeentry" options={{ href: null }} />
    </Tabs>
  );
}